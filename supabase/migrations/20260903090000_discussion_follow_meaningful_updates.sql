begin;

create table if not exists public.discussion_follows (
  user_id uuid not null references public.profiles(id) on delete cascade,
  discussion_id uuid not null references public.discussions(id) on delete cascade,
  notification_level text not null default 'major' check (notification_level in ('major', 'all_replies')),
  notify_status boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, discussion_id)
);

create index if not exists discussion_follows_discussion_id_idx
  on public.discussion_follows (discussion_id);

alter table public.discussion_follows enable row level security;

drop policy if exists "Members can read their discussion follows" on public.discussion_follows;
create policy "Members can read their discussion follows"
  on public.discussion_follows
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Members can create their discussion follows" on public.discussion_follows;
create policy "Members can create their discussion follows"
  on public.discussion_follows
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Members can update their discussion follows" on public.discussion_follows;
create policy "Members can update their discussion follows"
  on public.discussion_follows
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Members can delete their discussion follows" on public.discussion_follows;
create policy "Members can delete their discussion follows"
  on public.discussion_follows
  for delete
  to authenticated
  using (user_id = auth.uid());

create or replace function public.touch_discussion_follow_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists discussion_follows_touch_updated_at on public.discussion_follows;
create trigger discussion_follows_touch_updated_at
before update on public.discussion_follows
for each row execute function public.touch_discussion_follow_updated_at();

create or replace function public.notify_discussion_followers_of_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  discussion_title text;
  recipient record;
begin
  if new.deleted_at is not null then
    return new;
  end if;

  select d.title into discussion_title
  from public.discussions d
  where d.id = new.discussion_id
    and d.deleted_at is null;

  if discussion_title is null then
    return new;
  end if;

  for recipient in
    select f.user_id, f.notification_level
    from public.discussion_follows f
    where f.discussion_id = new.discussion_id
      and f.user_id <> new.user_id
  loop
    if recipient.notification_level = 'major'
       and exists (
         select 1
         from public.notifications n
         where n.user_id = recipient.user_id
           and n.type = 'followed_discussion'
           and n.target_type = 'discussion'
           and n.target_id = new.discussion_id
           and n.created_at > now() - interval '6 hours'
       ) then
      continue;
    end if;

    insert into public.notifications (
      user_id,
      actor_id,
      type,
      target_type,
      target_id,
      message
    ) values (
      recipient.user_id,
      new.user_id,
      'followed_discussion',
      'discussion',
      new.discussion_id,
      case
        when recipient.notification_level = 'all_replies'
          then 'New reply in “' || left(discussion_title, 120) || '”.'
        else 'New activity in “' || left(discussion_title, 120) || '”.'
      end
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists notify_discussion_followers_on_reply on public.replies;
create trigger notify_discussion_followers_on_reply
after insert on public.replies
for each row execute function public.notify_discussion_followers_of_reply();

create or replace function public.notify_discussion_followers_of_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid;
begin
  if new.deleted_at is not null
     or new.discussion_status is not distinct from old.discussion_status then
    return new;
  end if;

  actor := coalesce(auth.uid(), new.user_id);

  insert into public.notifications (
    user_id,
    actor_id,
    type,
    target_type,
    target_id,
    message
  )
  select
    f.user_id,
    actor,
    'followed_discussion',
    'discussion',
    new.id,
    case
      when new.discussion_status = 'resolved'
        then '“' || left(new.title, 120) || '” was marked resolved.'
      else '“' || left(new.title, 120) || '” was reopened.'
    end
  from public.discussion_follows f
  where f.discussion_id = new.id
    and f.notify_status = true
    and (actor is null or f.user_id <> actor);

  return new;
end;
$$;

drop trigger if exists notify_discussion_followers_on_status on public.discussions;
create trigger notify_discussion_followers_on_status
after update of discussion_status on public.discussions
for each row execute function public.notify_discussion_followers_of_status();

commit;
