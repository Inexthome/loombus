alter table public.rooms
  add column if not exists join_code text,
  add column if not exists join_code_updated_at timestamptz;

create unique index if not exists rooms_join_code_unique
on public.rooms (join_code)
where join_code is not null;

create or replace function public.room_create_join_code(target_room_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_code text;
begin
  if not public.is_room_owner(target_room_id) then
    raise exception 'not allowed';
  end if;

  next_code := replace(gen_random_uuid()::text, '-', '');

  update public.rooms
  set join_code = next_code,
      join_code_updated_at = now(),
      updated_at = now()
  where id = target_room_id;

  return next_code;
end;
$$;

create or replace function public.room_accept_join_code(target_room_id uuid, target_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_room uuid;
begin
  if auth.uid() is null then
    return false;
  end if;

  select id into matched_room
  from public.rooms
  where id = target_room_id
    and join_code = target_code
    and target_code is not null
  limit 1;

  if matched_room is null then
    return false;
  end if;

  insert into public.room_members (room_id, user_id, role)
  values (matched_room, auth.uid(), 'member')
  on conflict do nothing;

  return true;
end;
$$;

notify pgrst, 'reload schema';
