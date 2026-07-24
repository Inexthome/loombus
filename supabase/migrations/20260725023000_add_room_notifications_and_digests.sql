begin;

alter table public.notifications
  add column if not exists room_id uuid references public.rooms(id) on delete cascade;

create index if not exists notifications_user_room_created_idx
  on public.notifications (user_id, room_id, created_at desc)
  where room_id is not null;

alter table public.room_notification_preferences
  add column if not exists new_discussions_enabled boolean not null default false,
  add column if not exists announcements_enabled boolean not null default true,
  add column if not exists events_enabled boolean not null default true,
  add column if not exists email_digest_enabled boolean not null default false,
  add column if not exists email_digest_frequency text not null default 'weekly',
  add column if not exists email_digest_last_sent_at timestamptz,
  add column if not exists email_digest_unsubscribe_token uuid not null default gen_random_uuid();

alter table public.room_notification_preferences
  drop constraint if exists room_notification_preferences_email_digest_frequency_check;
alter table public.room_notification_preferences
  add constraint room_notification_preferences_email_digest_frequency_check
  check (email_digest_frequency in ('daily', 'weekly'));

create unique index if not exists room_notification_preferences_unsubscribe_token_idx
  on public.room_notification_preferences (email_digest_unsubscribe_token);
create index if not exists room_notification_preferences_digest_due_idx
  on public.room_notification_preferences (
    email_digest_enabled,
    email_digest_frequency,
    email_digest_last_sent_at
  )
  where email_digest_enabled = true;

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

create or replace function public.create_room_signal_inbox_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_name text;
  v_room_type text;
  v_notification_type text;
  v_preference_kind text;
  v_message text;
begin
  if new.audience <> 'all' then
    return new;
  end if;

  if new.event_type = 'discussion_created' then
    v_notification_type := 'room_discussion';
    v_preference_kind := 'new_discussions';
  elsif new.event_type = 'announcement_created' then
    v_notification_type := 'room_announcement';
    v_preference_kind := 'announcements';
  elsif new.event_type = 'calendar_event_created' then
    v_notification_type := 'room_event';
    v_preference_kind := 'events';
  else
    return new;
  end if;

  select
    coalesce(nullif(btrim(room.name), ''), 'Room'),
    lower(replace(coalesce(room.room_type, ''), ' ', '_'))
  into v_room_name, v_room_type
  from public.rooms room
  where room.id = new.room_id;

  if v_room_name is null then
    return new;
  end if;

  if new.event_type = 'discussion_created'
    and v_room_type in ('customer_support', 'customer-support')
  then
    return new;
  end if;

  v_message := case v_preference_kind
    when 'new_discussions' then
      'New discussion in ' || v_room_name || ': ' || left(new.title, 160)
    when 'announcements' then
      'New announcement in ' || v_room_name || ': ' || left(new.title, 160)
    else
      'New event in ' || v_room_name || ': ' || left(new.title, 180)
  end;

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
    new.actor_id,
    v_notification_type,
    new.target_type,
    new.target_id,
    new.room_id,
    v_message
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
  where recipient.user_id is distinct from new.actor_id
    and not coalesce(preference.muted, false)
    and (
      not coalesce(preference.important_only, false)
      or new.importance = 'high'
    )
    and case v_preference_kind
      when 'new_discussions' then
        coalesce(preference.new_discussions_enabled, false)
      when 'announcements' then
        coalesce(preference.announcements_enabled, true)
      else
        coalesce(preference.events_enabled, true)
    end;

  return new;
end;
$$;

drop trigger if exists room_activity_create_signal_inbox_notification
  on public.room_activity_events;
create trigger room_activity_create_signal_inbox_notification
after insert on public.room_activity_events
for each row execute function public.create_room_signal_inbox_notification();

commit;
