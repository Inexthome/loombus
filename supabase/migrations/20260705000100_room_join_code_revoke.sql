create or replace function public.room_revoke_join_code(target_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_room_owner(target_room_id) then
    raise exception 'not allowed';
  end if;

  update public.rooms
  set join_code = null,
      join_code_updated_at = now(),
      updated_at = now()
  where id = target_room_id;

  return true;
end;
$$;

notify pgrst, 'reload schema';
