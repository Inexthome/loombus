create table if not exists public.room_polls (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '' check (char_length(description) <= 4000),
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 10),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_by uuid references auth.users(id) on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.room_poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.room_polls(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  voter_id uuid not null references auth.users(id) on delete cascade,
  option_index integer not null check (option_index >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (poll_id, voter_id)
);

create index if not exists room_polls_room_status_idx on public.room_polls (room_id, status, updated_at desc);
create index if not exists room_polls_created_by_idx on public.room_polls (created_by);
create index if not exists room_poll_votes_poll_idx on public.room_poll_votes (poll_id);
create index if not exists room_poll_votes_room_idx on public.room_poll_votes (room_id);
create index if not exists room_poll_votes_voter_idx on public.room_poll_votes (voter_id);

alter table public.room_polls enable row level security;
alter table public.room_poll_votes enable row level security;

create or replace function public.user_can_access_room_polls(target_room_id uuid)
returns boolean
language sql
security definer
set search_path = 'public'
as $function$
  select
    exists (
      select 1
      from public.room_members member
      where member.room_id = target_room_id
        and member.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.rooms room
      where room.id = target_room_id
        and (room.owner_id = auth.uid() or room.created_by = auth.uid())
    );
$function$;

create or replace function public.user_can_manage_room_polls(target_room_id uuid)
returns boolean
language sql
security definer
set search_path = 'public'
as $function$
  select
    exists (
      select 1
      from public.room_members member
      where member.room_id = target_room_id
        and member.user_id = auth.uid()
        and member.role in ('owner', 'admin')
    )
    or exists (
      select 1
      from public.rooms room
      where room.id = target_room_id
        and (room.owner_id = auth.uid() or room.created_by = auth.uid())
    );
$function$;

create or replace function public.user_can_vote_room_poll(target_poll_id uuid, target_room_id uuid, target_option_index integer)
returns boolean
language sql
security definer
set search_path = 'public'
as $function$
  select
    auth.uid() is not null
    and public.user_can_access_room_polls(target_room_id)
    and exists (
      select 1
      from public.room_polls poll
      where poll.id = target_poll_id
        and poll.room_id = target_room_id
        and poll.status = 'open'
        and target_option_index >= 0
        and target_option_index < jsonb_array_length(poll.options)
    );
$function$;

drop policy if exists "Room members can view polls" on public.room_polls;
create policy "Room members can view polls"
  on public.room_polls
  for select
  using (public.user_can_access_room_polls(room_id));

drop policy if exists "Room owners and admins can create polls" on public.room_polls;
create policy "Room owners and admins can create polls"
  on public.room_polls
  for insert
  with check (
    created_by = auth.uid()
    and public.user_can_manage_room_polls(room_id)
  );

drop policy if exists "Room owners and admins can update polls" on public.room_polls;
create policy "Room owners and admins can update polls"
  on public.room_polls
  for update
  using (public.user_can_manage_room_polls(room_id))
  with check (public.user_can_manage_room_polls(room_id));

drop policy if exists "Room owners and admins can delete polls" on public.room_polls;
create policy "Room owners and admins can delete polls"
  on public.room_polls
  for delete
  using (public.user_can_manage_room_polls(room_id));

drop policy if exists "Room members can view poll votes" on public.room_poll_votes;
create policy "Room members can view poll votes"
  on public.room_poll_votes
  for select
  using (public.user_can_access_room_polls(room_id));

drop policy if exists "Room members can vote on open polls" on public.room_poll_votes;
create policy "Room members can vote on open polls"
  on public.room_poll_votes
  for insert
  with check (
    voter_id = auth.uid()
    and public.user_can_vote_room_poll(poll_id, room_id, option_index)
  );

drop policy if exists "Room members can update their own open poll vote" on public.room_poll_votes;
create policy "Room members can update their own open poll vote"
  on public.room_poll_votes
  for update
  using (
    voter_id = auth.uid()
    and public.user_can_access_room_polls(room_id)
  )
  with check (
    voter_id = auth.uid()
    and public.user_can_vote_room_poll(poll_id, room_id, option_index)
  );

drop policy if exists "Room members can delete their own poll vote" on public.room_poll_votes;
create policy "Room members can delete their own poll vote"
  on public.room_poll_votes
  for delete
  using (
    voter_id = auth.uid()
    and public.user_can_access_room_polls(room_id)
  );

create or replace function public.room_activity_summary(source_table text, source_operation text, row_data jsonb, old_data jsonb default '{}'::jsonb)
returns text
language plpgsql
stable
set search_path = 'public'
as $function$
begin
  if source_table = 'room_polls' and source_operation = 'INSERT' then
    return 'Poll created';
  elsif source_table = 'room_polls' and source_operation = 'UPDATE' then
    return 'Poll ' || coalesce(row_data ->> 'status', 'updated');
  elsif source_table = 'room_polls' and source_operation = 'DELETE' then
    return 'Poll removed';
  elsif source_table = 'room_poll_votes' and source_operation = 'INSERT' then
    return 'Poll vote submitted';
  elsif source_table = 'room_poll_votes' and source_operation = 'UPDATE' then
    return 'Poll vote updated';
  elsif source_table = 'room_poll_votes' and source_operation = 'DELETE' then
    return 'Poll vote removed';
  elsif source_table = 'room_tasks' and source_operation = 'INSERT' then
    return 'Task created';
  elsif source_table = 'room_tasks' and source_operation = 'UPDATE' then
    return 'Task ' || coalesce(row_data ->> 'status', 'updated');
  elsif source_table = 'room_tasks' and source_operation = 'DELETE' then
    return 'Task removed';
  elsif source_table = 'room_members' and source_operation = 'INSERT' then
    return 'Member added';
  elsif source_table = 'room_members' and source_operation = 'UPDATE' then
    return 'Member role updated';
  elsif source_table = 'room_members' and source_operation = 'DELETE' then
    return 'Member removed';
  elsif source_table = 'room_invites' and source_operation = 'INSERT' then
    return 'Invite created';
  elsif source_table = 'room_invites' and source_operation = 'UPDATE' then
    return 'Invite ' || coalesce(row_data ->> 'status', 'updated');
  elsif source_table = 'room_join_requests' and source_operation = 'INSERT' then
    return 'Join request submitted';
  elsif source_table = 'room_join_requests' and source_operation = 'UPDATE' then
    return 'Join request ' || coalesce(row_data ->> 'status', 'updated');
  elsif source_table = 'room_announcements' and source_operation = 'INSERT' then
    return 'Announcement posted';
  elsif source_table = 'room_announcements' and source_operation = 'UPDATE' then
    return 'Announcement updated';
  elsif source_table = 'room_resources' and source_operation = 'INSERT' then
    return 'Resource added';
  elsif source_table = 'room_resources' and source_operation = 'UPDATE' then
    return 'Resource updated';
  elsif source_table = 'room_service_listings' and source_operation = 'INSERT' then
    return 'Service listing created';
  elsif source_table = 'room_service_listings' and source_operation = 'UPDATE' then
    return 'Service listing updated';
  elsif source_table = 'room_service_requests' and source_operation = 'INSERT' then
    return 'Service request submitted';
  elsif source_table = 'room_service_requests' and source_operation = 'UPDATE' then
    return 'Service request ' || coalesce(row_data ->> 'status', 'updated');
  elsif source_table = 'room_requests' and source_operation = 'INSERT' then
    return 'Room request submitted';
  elsif source_table = 'room_requests' and source_operation = 'UPDATE' then
    return 'Room request ' || coalesce(row_data ->> 'status', 'updated');
  elsif source_table = 'room_preferences' and source_operation = 'INSERT' then
    return 'Room controls created';
  elsif source_table = 'room_preferences' and source_operation = 'UPDATE' then
    return 'Room controls updated';
  end if;

  return initcap(replace(source_table, '_', ' ')) || ' ' || lower(source_operation);
end;
$function$;

do $$
begin
  if to_regprocedure('public.install_room_activity_trigger(regclass)') is not null then
    perform public.install_room_activity_trigger('public.room_polls'::regclass);
    perform public.install_room_activity_trigger('public.room_poll_votes'::regclass);
  end if;
end $$;
