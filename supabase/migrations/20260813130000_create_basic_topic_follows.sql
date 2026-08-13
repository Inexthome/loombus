-- Free Basic Topic Alerts
--
-- The existing public.user_topic_alerts table is the paid Advanced Topic Alert
-- store and intentionally keeps its Premium/Admin authorization boundary.
-- This table represents the Free "follow a topic" contract used by the Signal
-- Directory. A follow produces an in-app notification when a new discussion is
-- published in that exact topic. Advanced paid alert storage and runtime remain
-- separate.

create table if not exists public.user_topic_follows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  topic text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_topic_follows_topic_length
    check (char_length(topic) between 1 and 80),
  constraint user_topic_follows_unique_user_topic
    unique (user_id, topic)
);

create index if not exists user_topic_follows_user_topic_idx
on public.user_topic_follows(user_id, topic);

create index if not exists user_topic_follows_topic_idx
on public.user_topic_follows(topic, user_id);

alter table public.user_topic_follows enable row level security;
alter table public.user_topic_follows force row level security;

drop policy if exists "Users can read their own topic follows"
on public.user_topic_follows;

create policy "Users can read their own topic follows"
on public.user_topic_follows
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can create their own topic follows"
on public.user_topic_follows;

create policy "Users can create their own topic follows"
on public.user_topic_follows
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can update their own topic follows"
on public.user_topic_follows;

create policy "Users can update their own topic follows"
on public.user_topic_follows
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can delete their own topic follows"
on public.user_topic_follows;

create policy "Users can delete their own topic follows"
on public.user_topic_follows
for delete
to authenticated
using (user_id = auth.uid());

revoke all on table public.user_topic_follows from anon;
grant select, insert, update, delete on table public.user_topic_follows to authenticated;

comment on table public.user_topic_follows is
'Free member-owned topic follows used for Basic Topic Alert in-app notifications.';

comment on column public.user_topic_follows.topic is
'Exact canonical discussion topic followed by the member.';

create or replace function public.notify_basic_topic_followers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.topic is null or btrim(new.topic) = '' then
    return new;
  end if;

  insert into public.notifications (
    user_id,
    actor_id,
    type,
    target_type,
    target_id,
    message
  )
  select
    follow.user_id,
    new.user_id,
    'topic_follow',
    'discussion',
    new.id,
    'New discussion in ' || new.topic || ': ' || new.title
  from public.user_topic_follows follow
  where follow.topic = new.topic
    and follow.user_id <> new.user_id
    -- If this member also has the paid Advanced alert enabled for the exact
    -- topic, leave delivery to the existing Advanced runtime so only one
    -- notification is produced.
    and not exists (
      select 1
      from public.user_topic_alerts advanced
      where advanced.user_id = follow.user_id
        and advanced.topic = new.topic
        and advanced.enabled = true
    )
    and not exists (
      select 1
      from public.user_blocks block_row
      where (
        block_row.blocker_id = new.user_id
        and block_row.blocked_id = follow.user_id
      ) or (
        block_row.blocker_id = follow.user_id
        and block_row.blocked_id = new.user_id
      )
    );

  return new;
end;
$$;

revoke all on function public.notify_basic_topic_followers() from public;
revoke all on function public.notify_basic_topic_followers() from anon;
revoke all on function public.notify_basic_topic_followers() from authenticated;

-- The trigger is additive and does not alter the existing application-level
-- Advanced Topic Alert delivery path.
drop trigger if exists notify_basic_topic_followers_after_discussion_insert
on public.discussions;

create trigger notify_basic_topic_followers_after_discussion_insert
after insert on public.discussions
for each row
execute function public.notify_basic_topic_followers();
