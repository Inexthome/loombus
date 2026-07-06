create table if not exists public.room_faq_entries (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  question text not null check (char_length(question) between 1 and 240),
  answer text not null check (char_length(answer) between 1 and 8000),
  category text not null default 'general' check (char_length(category) between 1 and 120),
  is_pinned boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists room_faq_entries_room_idx on public.room_faq_entries (room_id, is_pinned desc, category, question);
create index if not exists room_faq_entries_created_by_idx on public.room_faq_entries (created_by);
create index if not exists room_faq_entries_category_idx on public.room_faq_entries (category);

alter table public.room_faq_entries enable row level security;

create or replace function public.user_can_access_room_faq(target_room_id uuid)
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

create or replace function public.user_can_manage_room_faq(target_room_id uuid)
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

drop policy if exists "Room members can view FAQ entries" on public.room_faq_entries;
create policy "Room members can view FAQ entries"
  on public.room_faq_entries
  for select
  using (public.user_can_access_room_faq(room_id));

drop policy if exists "Room owners and admins can create FAQ entries" on public.room_faq_entries;
create policy "Room owners and admins can create FAQ entries"
  on public.room_faq_entries
  for insert
  with check (
    created_by = auth.uid()
    and public.user_can_manage_room_faq(room_id)
  );

drop policy if exists "Room owners and admins can update FAQ entries" on public.room_faq_entries;
create policy "Room owners and admins can update FAQ entries"
  on public.room_faq_entries
  for update
  using (public.user_can_manage_room_faq(room_id))
  with check (public.user_can_manage_room_faq(room_id));

drop policy if exists "Room owners and admins can delete FAQ entries" on public.room_faq_entries;
create policy "Room owners and admins can delete FAQ entries"
  on public.room_faq_entries
  for delete
  using (public.user_can_manage_room_faq(room_id));

create or replace function public.room_activity_summary(source_table text, source_operation text, row_data jsonb, old_data jsonb default '{}'::jsonb)
returns text
language plpgsql
stable
set search_path = 'public'
as $function$
begin
  if source_table = 'room_faq_entries' and source_operation = 'INSERT' then
    return 'FAQ entry added';
  elsif source_table = 'room_faq_entries' and source_operation = 'UPDATE' then
    return 'FAQ entry updated';
  elsif source_table = 'room_faq_entries' and source_operation = 'DELETE' then
    return 'FAQ entry removed';
  elsif source_table = 'room_directory_contacts' and source_operation = 'INSERT' then
    return 'Directory contact added';
  elsif source_table = 'room_directory_contacts' and source_operation = 'UPDATE' then
    return 'Directory contact updated';
  elsif source_table = 'room_directory_contacts' and source_operation = 'DELETE' then
    return 'Directory contact removed';
  elsif source_table = 'room_polls' and source_operation = 'INSERT' then
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
    perform public.install_room_activity_trigger('public.room_faq_entries'::regclass);
  end if;
end $$;
