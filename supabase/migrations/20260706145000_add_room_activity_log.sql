create table if not exists public.room_activity_log (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (char_length(event_type) between 1 and 120),
  entity_table text not null check (char_length(entity_table) between 1 and 120),
  entity_id text not null default '' check (char_length(entity_id) <= 160),
  summary text not null default '' check (char_length(summary) <= 500),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists room_activity_log_room_created_idx on public.room_activity_log (room_id, created_at desc);
create index if not exists room_activity_log_actor_idx on public.room_activity_log (actor_id);
create index if not exists room_activity_log_event_type_idx on public.room_activity_log (event_type);

alter table public.room_activity_log enable row level security;

create or replace function public.user_can_view_room_activity(target_room_id uuid)
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

drop policy if exists "Room owners and admins can view activity log" on public.room_activity_log;
create policy "Room owners and admins can view activity log"
  on public.room_activity_log
  for select
  using (public.user_can_view_room_activity(room_id));

create or replace function public.room_activity_summary(source_table text, source_operation text, row_data jsonb, old_data jsonb default '{}'::jsonb)
returns text
language plpgsql
stable
set search_path = 'public'
as $function$
begin
  if source_table = 'room_members' and source_operation = 'INSERT' then
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

create or replace function public.log_room_activity()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  row_data jsonb;
  old_data jsonb;
  target_room_id uuid;
  target_entity_id text;
  next_actor_id uuid;
begin
  if TG_OP = 'DELETE' then
    row_data := to_jsonb(OLD);
    old_data := to_jsonb(OLD);
  else
    row_data := to_jsonb(NEW);
    old_data := coalesce(to_jsonb(OLD), '{}'::jsonb);
  end if;

  if not (row_data ? 'room_id') then
    return coalesce(NEW, OLD);
  end if;

  target_room_id := nullif(row_data ->> 'room_id', '')::uuid;
  target_entity_id := coalesce(row_data ->> 'id', row_data ->> 'user_id', row_data ->> 'requester_user_id', row_data ->> 'invited_user_id', '');
  next_actor_id := auth.uid();

  if target_room_id is null then
    return coalesce(NEW, OLD);
  end if;

  insert into public.room_activity_log (
    room_id,
    actor_id,
    event_type,
    entity_table,
    entity_id,
    summary,
    metadata
  ) values (
    target_room_id,
    next_actor_id,
    lower(TG_TABLE_NAME || '_' || TG_OP),
    TG_TABLE_NAME,
    target_entity_id,
    public.room_activity_summary(TG_TABLE_NAME, TG_OP, row_data, old_data),
    jsonb_build_object(
      'operation', TG_OP,
      'table', TG_TABLE_NAME,
      'row', row_data,
      'old_row', old_data
    )
  );

  return coalesce(NEW, OLD);
end;
$function$;

create or replace function public.install_room_activity_trigger(target_table regclass)
returns void
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  trigger_name text;
begin
  trigger_name := replace(target_table::text, '.', '_') || '_activity_log_trigger';
  execute format('drop trigger if exists %I on %s', trigger_name, target_table);
  execute format(
    'create trigger %I after insert or update or delete on %s for each row execute function public.log_room_activity()',
    trigger_name,
    target_table
  );
end;
$function$;

select public.install_room_activity_trigger('public.room_members'::regclass);
select public.install_room_activity_trigger('public.room_invites'::regclass);
select public.install_room_activity_trigger('public.room_join_requests'::regclass);
select public.install_room_activity_trigger('public.room_announcements'::regclass);
select public.install_room_activity_trigger('public.room_resources'::regclass);
select public.install_room_activity_trigger('public.room_service_listings'::regclass);
select public.install_room_activity_trigger('public.room_service_requests'::regclass);
select public.install_room_activity_trigger('public.room_requests'::regclass);
select public.install_room_activity_trigger('public.room_preferences'::regclass);
