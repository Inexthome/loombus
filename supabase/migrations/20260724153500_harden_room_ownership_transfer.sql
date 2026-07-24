begin;

create or replace function public.accept_room_ownership_transfer(
  transfer_id uuid,
  accepting_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  transfer_row public.room_ownership_transfers%rowtype;
  current_owner uuid;
begin
  if auth.role() <> 'service_role'
     and auth.uid() is distinct from accepting_user_id then
    raise exception 'The authenticated user cannot accept this ownership transfer.';
  end if;

  select *
  into transfer_row
  from public.room_ownership_transfers
  where id = transfer_id
  for update;

  if transfer_row.id is null then
    raise exception 'Ownership transfer not found.';
  end if;

  if transfer_row.status <> 'pending' then
    raise exception 'Ownership transfer is no longer pending.';
  end if;

  if transfer_row.expires_at <= now() then
    update public.room_ownership_transfers
    set status = 'expired', updated_at = now()
    where id = transfer_id;
    raise exception 'Ownership transfer has expired.';
  end if;

  if transfer_row.to_user_id <> accepting_user_id then
    raise exception 'Only the selected recipient can accept ownership.';
  end if;

  select owner_id
  into current_owner
  from public.rooms
  where id = transfer_row.room_id
  for update;

  if current_owner is distinct from transfer_row.from_user_id then
    raise exception 'Room ownership changed before this transfer was accepted.';
  end if;

  update public.rooms
  set owner_id = transfer_row.to_user_id,
      updated_at = now()
  where id = transfer_row.room_id;

  insert into public.room_members (
    room_id, user_id, role, status, joined_at, created_at, updated_at
  )
  values (
    transfer_row.room_id, transfer_row.to_user_id, 'owner', 'active', now(), now(), now()
  )
  on conflict (room_id, user_id)
  do update set
    role = 'owner',
    status = 'active',
    suspended_until = null,
    updated_at = now();

  insert into public.room_members (
    room_id, user_id, role, status, joined_at, created_at, updated_at
  )
  values (
    transfer_row.room_id, transfer_row.from_user_id, 'administrator', 'active', now(), now(), now()
  )
  on conflict (room_id, user_id)
  do update set
    role = 'administrator',
    status = 'active',
    suspended_until = null,
    updated_at = now();

  update public.room_ownership_transfers
  set status = 'accepted',
      accepted_at = now(),
      updated_at = now()
  where id = transfer_id;

  return transfer_row.room_id;
end;
$$;

revoke all on function public.accept_room_ownership_transfer(uuid, uuid) from public;
grant execute on function public.accept_room_ownership_transfer(uuid, uuid)
  to authenticated, service_role;

commit;
