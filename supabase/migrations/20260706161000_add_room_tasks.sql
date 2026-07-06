create table if not exists public.room_tasks (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '' check (char_length(description) <= 4000),
  status text not null default 'open' check (status in ('open', 'in_progress', 'done', 'cancelled')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  due_at timestamptz,
  assigned_user_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists room_tasks_room_status_idx on public.room_tasks (room_id, status, updated_at desc);
create index if not exists room_tasks_assigned_user_idx on public.room_tasks (assigned_user_id);
create index if not exists room_tasks_created_by_idx on public.room_tasks (created_by);
create index if not exists room_tasks_due_at_idx on public.room_tasks (due_at);

alter table public.room_tasks enable row level security;

create or replace function public.user_can_access_room_tasks(target_room_id uuid)
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

create or replace function public.user_can_manage_room_tasks(target_room_id uuid)
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

drop policy if exists "Room members can view tasks" on public.room_tasks;
create policy "Room members can view tasks"
  on public.room_tasks
  for select
  using (public.user_can_access_room_tasks(room_id));

drop policy if exists "Room owners and admins can create tasks" on public.room_tasks;
create policy "Room owners and admins can create tasks"
  on public.room_tasks
  for insert
  with check (
    created_by = auth.uid()
    and public.user_can_manage_room_tasks(room_id)
  );

drop policy if exists "Room owners and admins can update tasks" on public.room_tasks;
create policy "Room owners and admins can update tasks"
  on public.room_tasks
  for update
  using (public.user_can_manage_room_tasks(room_id))
  with check (public.user_can_manage_room_tasks(room_id));

drop policy if exists "Room owners and admins can delete tasks" on public.room_tasks;
create policy "Room owners and admins can delete tasks"
  on public.room_tasks
  for delete
  using (public.user_can_manage_room_tasks(room_id));

create or replace function public.room_activity_summary(source_table text, source_operation text, row_data jsonb, old_data jsonb default '{}'::jsonb)
returns text
language plpgsql
stable
set search_path = 'public'
as $function$
begin
  if source_table = 'room_tasks' and source_operation = 'INSERT' then
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
    perform public.install_room_activity_trigger('public.room_tasks'::regclass);
  end if;
end $$;
