begin;

alter table public.notifications
  add column if not exists room_id uuid references public.rooms(id) on delete cascade;

create index if not exists notifications_user_room_created_idx
  on public.notifications (user_id, room_id, created_at desc)
  where room_id is not null;

create table if not exists public.room_notification_preferences (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  in_app_enabled boolean not null default true,
  new_discussions_enabled boolean not null default false,
  announcements_enabled boolean not null default true,
  events_enabled boolean not null default true,
  email_digest_enabled boolean not null default false,
  email_digest_frequency text not null default 'weekly',
  email_digest_last_sent_at timestamptz,
  email_digest_unsubscribe_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id),
  constraint room_notification_preferences_frequency_check
    check (email_digest_frequency in ('daily', 'weekly'))
);

create unique index if not exists room_notification_preferences_unsubscribe_token_idx
  on public.room_notification_preferences (email_digest_unsubscribe_token);
create index if not exists room_notification_preferences_digest_due_idx
  on public.room_notification_preferences (
    email_digest_enabled,
    email_digest_frequency,
    email_digest_last_sent_at
  )
  where email_digest_enabled = true;

alter table public.room_notification_preferences enable row level security;

create or replace function public.room_notification_access_allowed(
  p_room_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.rooms room
    where room.id = p_room_id
      and lower(coalesce(room.status, 'active')) not in ('deleted', 'deleting')
      and (
        room.owner_id = p_user_id
        or room.created_by = p_user_id
        or exists (
          select 1
          from public.room_members member
          where member.room_id = room.id
            and member.user_id = p_user_id
            and lower(coalesce(member.status, 'active')) not in (
              'blocked', 'removed', 'inactive', 'suspended'
            )
            and (
              member.suspended_until is null
              or member.suspended_until <= now()
            )
        )
      )
  );
$$;

revoke all on function public.room_notification_access_allowed(uuid, uuid) from public;
grant execute on function public.room_notification_access_allowed(uuid, uuid) to authenticated;

create policy "Room members can read their notification preferences"
on public.room_notification_preferences
for select
to authenticated
using (
  auth.uid() = user_id
  and public.room_notification_access_allowed(room_id, user_id)
);

create policy "Room members can create their notification preferences"
on public.room_notification_preferences
for insert
to authenticated
with check (
  auth.uid() = user_id
  and public.room_notification_access_allowed(room_id, user_id)
);

create policy "Room members can update their notification preferences"
on public.room_notification_preferences
for update
to authenticated
using (
  auth.uid() = user_id
  and public.room_notification_access_allowed(room_id, user_id)
)
with check (
  auth.uid() = user_id
  and public.room_notification_access_allowed(room_id, user_id)
);

create policy "Room members can delete their notification preferences"
on public.room_notification_preferences
for delete
to authenticated
using (
  auth.uid() = user_id
  and public.room_notification_access_allowed(room_id, user_id)
);

create or replace function public.set_room_notification_preferences_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists room_notification_preferences_set_updated_at
  on public.room_notification_preferences;
create trigger room_notification_preferences_set_updated_at
before update on public.room_notification_preferences
for each row execute function public.set_room_notification_preferences_updated_at();

create or replace function public.populate_notification_room_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.room_id is not null or new.target_id is null then
    return new;
  end if;

  if new.target_type = 'room_post' then
    select post.room_id into new.room_id
    from public.room_posts post
    where post.id = new.target_id;
  elsif new.target_type = 'room_post_reply' then
    select reply.room_id into new.room_id
    from public.room_post_replies reply
    where reply.id = new.target_id;
  elsif new.target_type = 'room_event' then
    select event.room_id into new.room_id
    from public.room_events event
    where event.id = new.target_id;
  elsif new.target_type = 'room_announcement' then
    select announcement.room_id into new.room_id
    from public.room_announcements announcement
    where announcement.id = new.target_id;
  elsif new.target_type = 'room_moderation_item' then
    select moderation.room_id into new.room_id
    from public.room_moderation_queue moderation
    where moderation.id = new.target_id;
  end if;

  return new;
end;
$$;

drop trigger if exists notifications_populate_room_id on public.notifications;
create trigger notifications_populate_room_id
before insert or update of target_type, target_id, room_id on public.notifications
for each row execute function public.populate_notification_room_id();

update public.notifications notification
set room_id = post.room_id
from public.room_posts post
where notification.room_id is null
  and notification.target_type = 'room_post'
  and notification.target_id = post.id;

update public.notifications notification
set room_id = reply.room_id
from public.room_post_replies reply
where notification.room_id is null
  and notification.target_type = 'room_post_reply'
  and notification.target_id = reply.id;

update public.notifications notification
set room_id = event.room_id
from public.room_events event
where notification.room_id is null
  and notification.target_type = 'room_event'
  and notification.target_id = event.id;

update public.notifications notification
set room_id = announcement.room_id
from public.room_announcements announcement
where notification.room_id is null
  and notification.target_type = 'room_announcement'
  and notification.target_id = announcement.id;

update public.notifications notification
set room_id = moderation.room_id
from public.room_moderation_queue moderation
where notification.room_id is null
  and notification.target_type = 'room_moderation_item'
  and notification.target_id = moderation.id;

create or replace function public.create_room_activity_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  room_name text;
  room_type text;
  actor_id uuid;
  activity_type text;
  target_type text;
  target_id uuid;
  activity_title text;
  preference_column text;
begin
  select room.name, lower(replace(coalesce(room.room_type, ''), ' ', '_'))
  into room_name, room_type
  from public.rooms room
  where room.id = new.room_id;

  if room_name is null then
    return new;
  end if;

  if tg_table_name = 'room_posts' then
    if room_type in ('customer_support', 'customer-support') then
      return new;
    end if;
    actor_id := new.author_id;
    activity_type := 'room_discussion';
    target_type := 'room_post';
    target_id := new.id;
    activity_title := left(coalesce(new.title, 'New Room discussion'), 160);
    preference_column := 'new_discussions';
  elsif tg_table_name = 'room_announcements' then
    actor_id := new.created_by;
    activity_type := 'room_announcement';
    target_type := 'room_announcement';
    target_id := new.id;
    activity_title := left(coalesce(new.title, 'Room announcement'), 160);
    preference_column := 'announcements';
  elsif tg_table_name = 'room_events' then
    actor_id := new.created_by;
    activity_type := 'room_event';
    target_type := 'room_event';
    target_id := new.id;
    activity_title := left(coalesce(new.title, 'Room event'), 180);
    preference_column := 'events';
  else
    return new;
  end if;

  insert into public.notifications (
    user_id,
    actor_id,
    type,
    target_type,
    target_id,
    room_id,
    message
  )
  select
    recipient.user_id,
    actor_id,
    activity_type,
    target_type,
    target_id,
    new.room_id,
    case preference_column
      when 'new_discussions' then
        'New discussion in ' || room_name || ': ' || activity_title
      when 'announcements' then
        'New announcement in ' || room_name || ': ' || activity_title
      else
        'New event in ' || room_name || ': ' || activity_title
    end
  from (
    select distinct candidate.user_id
    from (
      select member.user_id
      from public.room_members member
      where member.room_id = new.room_id
        and lower(coalesce(member.status, 'active')) not in (
          'blocked', 'removed', 'inactive', 'suspended'
        )
        and (
          member.suspended_until is null
          or member.suspended_until <= now()
        )
      union all
      select room.owner_id
      from public.rooms room
      where room.id = new.room_id
      union all
      select room.created_by
      from public.rooms room
      where room.id = new.room_id
    ) candidate
    where candidate.user_id is not null
  ) recipient
  left join public.room_notification_preferences preference
    on preference.room_id = new.room_id
   and preference.user_id = recipient.user_id
  where recipient.user_id <> actor_id
    and coalesce(preference.in_app_enabled, true)
    and case preference_column
      when 'new_discussions' then coalesce(preference.new_discussions_enabled, false)
      when 'announcements' then coalesce(preference.announcements_enabled, true)
      else coalesce(preference.events_enabled, true)
    end;

  return new;
end;
$$;

drop trigger if exists room_posts_create_activity_notifications on public.room_posts;
create trigger room_posts_create_activity_notifications
after insert on public.room_posts
for each row execute function public.create_room_activity_notifications();

drop trigger if exists room_announcements_create_activity_notifications
  on public.room_announcements;
create trigger room_announcements_create_activity_notifications
after insert on public.room_announcements
for each row execute function public.create_room_activity_notifications();

drop trigger if exists room_events_create_activity_notifications on public.room_events;
create trigger room_events_create_activity_notifications
after insert on public.room_events
for each row execute function public.create_room_activity_notifications();

commit;
