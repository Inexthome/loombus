-- Service-role-only, keyset-paginated discovery for confirmed Room Storage prefixes.
-- Apply after 20260726073000_reconcile_room_deletion_worker_prerequisites.sql.

begin;

create or replace function public.list_room_deletion_storage_objects(
  target_room_id uuid,
  after_bucket_id text default null,
  after_object_path text default null,
  requested_limit integer default 500
)
returns table (bucket_id text, object_path text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  bounded_limit integer;
begin
  if target_room_id is null then
    raise exception using
      errcode = '22023',
      message = 'A Room id is required for Storage discovery.';
  end if;
  if after_bucket_id is not null
    and after_bucket_id not in ('room-resources', 'room-post-attachments')
  then
    raise exception using
      errcode = '22023',
      message = 'The Storage discovery cursor has an invalid bucket.';
  end if;

  bounded_limit := greatest(1, least(coalesce(requested_limit, 500), 500));

  return query
  select
    stored_object.bucket_id,
    stored_object.name
  from storage.objects stored_object
  where stored_object.bucket_id in ('room-resources', 'room-post-attachments')
    and (
      stored_object.name = target_room_id::text
      or stored_object.name like target_room_id::text || '/%'
    )
    and (
      after_bucket_id is null
      or stored_object.bucket_id > after_bucket_id
      or (
        stored_object.bucket_id = after_bucket_id
        and stored_object.name > coalesce(after_object_path, '')
      )
    )
  order by stored_object.bucket_id, stored_object.name
  limit bounded_limit;
end;
$$;

revoke all on function public.list_room_deletion_storage_objects(uuid, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.list_room_deletion_storage_objects(uuid, text, text, integer)
  to service_role;

comment on function public.list_room_deletion_storage_objects(uuid, text, text, integer) is
  'Service-role-only keyset scan of confirmed Room-owned Storage prefixes.';

do $$
begin
  if to_regprocedure(
    'public.list_room_deletion_storage_objects(uuid,text,text,integer)'
  ) is null then
    raise exception 'The Room deletion Storage discovery function is missing.';
  end if;

  if exists (
    select 1
    from information_schema.routine_privileges privilege
    where privilege.routine_schema = 'public'
      and privilege.routine_name = 'list_room_deletion_storage_objects'
      and lower(privilege.grantee) in ('public', 'anon', 'authenticated')
  ) then
    raise exception 'Browser execution remains on Room deletion Storage discovery.';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.list_room_deletion_storage_objects(uuid,text,text,integer)',
    'EXECUTE'
  ) then
    raise exception 'The service role cannot execute Room deletion Storage discovery.';
  end if;
end
$$;

commit;
