begin;

create table if not exists public.discussion_feed_visits (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  last_session_started_at timestamptz,
  current_session_started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.discussion_feed_visits enable row level security;

revoke all on table public.discussion_feed_visits from anon;
revoke all on table public.discussion_feed_visits from authenticated;
grant select on table public.discussion_feed_visits to authenticated;

create policy "Members can read their Discussions visit state"
on public.discussion_feed_visits
for select
to authenticated
using (user_id = auth.uid());

create or replace function public.begin_discussions_feed_session()
returns table (
  previous_visit_at timestamptz,
  session_started_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.discussion_feed_visits%rowtype;
  v_now timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_existing
  from public.discussion_feed_visits
  where user_id = v_user_id
  for update;

  if not found then
    insert into public.discussion_feed_visits (
      user_id,
      last_session_started_at,
      current_session_started_at,
      updated_at
    ) values (
      v_user_id,
      null,
      v_now,
      v_now
    );

    return query select null::timestamptz, v_now;
    return;
  end if;

  if v_existing.current_session_started_at < v_now - interval '30 minutes' then
    update public.discussion_feed_visits
    set last_session_started_at = v_existing.current_session_started_at,
        current_session_started_at = v_now,
        updated_at = v_now
    where user_id = v_user_id;

    return query select v_existing.current_session_started_at, v_now;
    return;
  end if;

  update public.discussion_feed_visits
  set updated_at = v_now
  where user_id = v_user_id;

  return query
  select v_existing.last_session_started_at, v_existing.current_session_started_at;
end;
$$;

revoke all on function public.begin_discussions_feed_session() from public;
revoke all on function public.begin_discussions_feed_session() from anon;
grant execute on function public.begin_discussions_feed_session() to authenticated;

comment on table public.discussion_feed_visits is
  'Member-private Discussions session markers used for New Since Last Visit without cross-user visibility.';

comment on function public.begin_discussions_feed_session() is
  'Begins a Discussions browsing session after 30 minutes of inactivity and returns the prior session start for cross-device new-since-last-visit experiences.';

commit;
