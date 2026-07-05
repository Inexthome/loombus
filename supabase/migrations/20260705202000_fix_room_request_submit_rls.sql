create or replace function public.user_can_access_room_requests(target_room_id uuid)
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

create or replace function public.user_can_manage_room_requests(target_room_id uuid)
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

drop policy if exists "Room members can view room requests" on public.room_requests;
create policy "Room members can view room requests"
  on public.room_requests
  for select
  using (public.user_can_access_room_requests(room_id));

drop policy if exists "Room members can create room requests" on public.room_requests;
create policy "Room members can create room requests"
  on public.room_requests
  for insert
  with check (
    created_by = auth.uid()
    and public.user_can_access_room_requests(room_id)
  );

drop policy if exists "Room owners and admins can update room requests" on public.room_requests;
create policy "Room owners and admins can update room requests"
  on public.room_requests
  for update
  using (public.user_can_manage_room_requests(room_id))
  with check (public.user_can_manage_room_requests(room_id));
