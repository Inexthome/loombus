-- Remove test Rooms and abandoned checkout intents owned by the three
-- specified test accounts. The user accounts themselves are preserved.
--
-- Safety boundaries:
-- - abort instead of orphaning a recurring Stripe subscription
-- - abort instead of deleting Room database rows while private Storage objects
--   still require deletion through the Supabase Storage API
-- - make Room activity logging safe when child rows are removed by a cascading
--   parent Room deletion

begin;

-- During ON DELETE CASCADE, PostgreSQL may remove the parent Room before AFTER
-- DELETE triggers run on child tables. Do not write an activity event for a Room
-- that no longer exists, because room_activity_log.room_id has a foreign key to
-- public.rooms.
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
  target_entity_id := coalesce(
    row_data ->> 'id',
    row_data ->> 'user_id',
    row_data ->> 'requester_user_id',
    row_data ->> 'invited_user_id',
    ''
  );
  next_actor_id := auth.uid();

  if target_room_id is null then
    return coalesce(NEW, OLD);
  end if;

  if not exists (
    select 1
    from public.rooms room
    where room.id = target_room_id
  ) then
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

do $$
declare
  matching_subscription_count integer;
  matching_resource_count integer;
begin
  select count(*)
    into matching_subscription_count
  from public.rooms room
  where exists (
    select 1
    from auth.users account
    where lower(account.email) in (
      '1981saint@gmail.com',
      'loombus7@gmail.com',
      'reviewer@loombus.com'
    )
      and (account.id = room.owner_id or account.id = room.created_by)
  )
    and nullif(trim(coalesce(room.stripe_subscription_id, '')), '') is not null;

  if matching_subscription_count > 0 then
    raise exception
      'Test Room cleanup stopped: % matching Room(s) still have Stripe subscription ids. Cancel those subscriptions before deleting the Room records.',
      matching_subscription_count;
  end if;

  select count(*)
    into matching_resource_count
  from public.room_resources resource
  join public.rooms room on room.id = resource.room_id
  where exists (
    select 1
    from auth.users account
    where lower(account.email) in (
      '1981saint@gmail.com',
      'loombus7@gmail.com',
      'reviewer@loombus.com'
    )
      and (account.id = room.owner_id or account.id = room.created_by)
  );

  if matching_resource_count > 0 then
    raise exception
      'Test Room cleanup stopped: % private Room resource(s) still require deletion through the Supabase Storage API.',
      matching_resource_count;
  end if;
end
$$;

delete from public.room_checkout_intents intent
using auth.users account
where intent.user_id = account.id
  and lower(account.email) in (
    '1981saint@gmail.com',
    'loombus7@gmail.com',
    'reviewer@loombus.com'
  );

delete from public.rooms room
where exists (
  select 1
  from auth.users account
  where lower(account.email) in (
    '1981saint@gmail.com',
    'loombus7@gmail.com',
    'reviewer@loombus.com'
  )
    and (account.id = room.owner_id or account.id = room.created_by)
);

commit;
