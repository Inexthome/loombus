create or replace function public.user_can_access_room_members(target_room_id uuid)
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

create or replace function public.user_can_manage_room_members(target_room_id uuid)
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

alter table public.room_members enable row level security;

drop policy if exists "Room members can view room members" on public.room_members;
create policy "Room members can view room members"
  on public.room_members
  for select
  using (public.user_can_access_room_members(room_id));

drop policy if exists "Room owners and admins can add room members" on public.room_members;
create policy "Room owners and admins can add room members"
  on public.room_members
  for insert
  with check (public.user_can_manage_room_members(room_id));

drop policy if exists "Room owners and admins can update room members" on public.room_members;
create policy "Room owners and admins can update room members"
  on public.room_members
  for update
  using (public.user_can_manage_room_members(room_id))
  with check (public.user_can_manage_room_members(room_id));

drop policy if exists "Room owners and admins can remove room members" on public.room_members;
create policy "Room owners and admins can remove room members"
  on public.room_members
  for delete
  using (public.user_can_manage_room_members(room_id));
