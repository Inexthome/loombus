-- Final authorization, retention, and Storage-race hardening for the Room
-- deletion state machine. Apply immediately after
-- 20260726070000_room_deletion_state_machine.sql.

begin;

alter table public.room_deletion_jobs
  add column if not exists storage_quiet_until timestamptz;

update public.room_deletion_jobs
set storage_quiet_until = coalesce(started_at, created_at, now()) + interval '24 hours'
where storage_quiet_until is null;

alter table public.room_deletion_jobs
  alter column storage_quiet_until set default (now() + interval '24 hours'),
  alter column storage_quiet_until set not null;

-- Legacy post attachments were uploaded directly by authenticated Room members.
-- Keep that path available only while the owning Room is active. This prevents
-- new direct uploads after a deletion job changes the Room to `deleting`.
drop policy if exists "Room members can upload post files" on storage.objects;
create policy "Room members can upload post files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'room-post-attachments'
  and owner = auth.uid()
  and exists (
    select 1
    from public.rooms room
    where room.id = ((storage.foldername(name))[1])::uuid
      and coalesce(room.status, 'active') = 'active'
      and (
        room.owner_id = auth.uid()
        or room.created_by = auth.uid()
        or exists (
          select 1
          from public.room_members member
          where member.room_id = room.id
            and member.user_id = auth.uid()
            and coalesce(member.status, 'active')
              not in ('blocked', 'removed', 'inactive')
            and (
              member.suspended_until is null
              or member.suspended_until <= now()
            )
        )
      )
  )
);

create or replace function public.room_deletion_owner_matches(
  acting_owner_id uuid,
  stored_owner_id uuid,
  stored_creator_id uuid
)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select acting_owner_id is not null
    and (
      acting_owner_id is not distinct from stored_owner_id
      or acting_owner_id is not distinct from stored_creator_id
    );
$$;

create or replace function public.room_deletion_retention_days(
  organization_security jsonb
)
returns integer
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  raw_days text;
begin
  raw_days := btrim(coalesce(organization_security ->> 'retentionDays', ''));
  if raw_days = '' then
    return 0;
  end if;

  if raw_days !~ '^[0-9]+([.][0-9]+)?$' then
    return 0;
  end if;

  return greatest(
    0,
    least(3650, floor(raw_days::numeric)::integer)
  );
end;
$$;

create or replace function public.begin_room_deletion_job(
  target_room_id uuid,
  acting_owner_id uuid,
  billing_preflight jsonb
)
returns table (job_id uuid, job_status text, created boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  room_record public.rooms%rowtype;
  existing_job public.room_deletion_jobs%rowtype;
  organization_security jsonb := '{}'::jsonb;
  organization_retention_days integer := 0;
  retained_until timestamptz;
  inserted_job_id uuid;
begin
  select *
  into room_record
  from public.rooms
  where id = target_room_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Room not found.';
  end if;

  if not public.room_deletion_owner_matches(
    acting_owner_id,
    room_record.owner_id,
    room_record.created_by
  ) then
    raise exception using
      errcode = '42501',
      message = 'Only the Room owner can begin permanent deletion.';
  end if;

  select *
  into existing_job
  from public.room_deletion_jobs
  where room_id = target_room_id
    and status not in ('completed', 'cancelled')
  order by created_at desc
  limit 1
  for update;

  if found then
    return query select existing_job.id, existing_job.status, false;
    return;
  end if;

  if coalesce(room_record.status, '') <> 'pending_deletion' then
    raise exception using
      errcode = 'P0001',
      message = 'The Room must be pending deletion before a deletion job can begin.';
  end if;

  if room_record.deletion_scheduled_for is null
    or room_record.deletion_scheduled_for > now()
  then
    raise exception using
      errcode = 'P0001',
      message = 'The Room recovery period has not ended.';
  end if;

  if exists (
    select 1
    from public.room_retention_holds hold_record
    where hold_record.room_id = target_room_id
      and hold_record.target_type = 'room'
      and hold_record.status = 'active'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'An active Room retention hold blocks permanent deletion.';
  end if;

  if room_record.organization_id is not null then
    select organization.security
    into organization_security
    from public.room_organizations organization
    where organization.id = room_record.organization_id;

    if not found then
      raise exception using
        errcode = 'P0001',
        message = 'Organization retention policy could not be verified.';
    end if;

    if coalesce(organization_security ->> 'legalHold', 'false') = 'true' then
      raise exception using
        errcode = 'P0001',
        message = 'An organization legal hold blocks permanent deletion.';
    end if;

    organization_retention_days :=
      public.room_deletion_retention_days(organization_security);

    if organization_retention_days > 0 then
      if room_record.created_at is null then
        raise exception using
          errcode = 'P0001',
          message = 'Room creation time could not be verified for retention enforcement.';
      end if;

      retained_until := room_record.created_at
        + make_interval(days => organization_retention_days);

      if retained_until > now() then
        raise exception using
          errcode = 'P0001',
          message = 'Organization retention still protects this Room.';
      end if;
    end if;
  end if;

  if not public.room_deletion_billing_preflight_is_current(billing_preflight) then
    raise exception using
      errcode = 'P0001',
      message = 'A current inactive-billing verification is required.';
  end if;

  insert into public.room_deletion_jobs (
    room_id,
    room_name,
    requested_by,
    previous_room_status,
    status,
    room_snapshot,
    preflight_snapshot,
    storage_quiet_until
  )
  values (
    room_record.id,
    room_record.name,
    acting_owner_id,
    room_record.status,
    'building_manifest',
    jsonb_build_object(
      'roomId', room_record.id,
      'roomName', room_record.name,
      'roomType', room_record.room_type,
      'organizationId', room_record.organization_id,
      'ownerId', room_record.owner_id,
      'createdBy', room_record.created_by,
      'createdAt', room_record.created_at,
      'deletionScheduledFor', room_record.deletion_scheduled_for
    ),
    coalesce(billing_preflight, '{}'::jsonb),
    now() + interval '24 hours'
  )
  returning id into inserted_job_id;

  update public.rooms
  set status = 'deleting',
      updated_at = now()
  where id = target_room_id;

  return query select inserted_job_id, 'building_manifest'::text, true;
end;
$$;

create or replace function public.refresh_room_deletion_billing_preflight(
  target_job_id uuid,
  acting_owner_id uuid,
  billing_preflight jsonb
)
returns public.room_deletion_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_record public.room_deletion_jobs%rowtype;
  room_record public.rooms%rowtype;
begin
  select *
  into job_record
  from public.room_deletion_jobs
  where id = target_job_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Room deletion job not found.';
  end if;

  select *
  into room_record
  from public.rooms
  where id = job_record.room_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Room not found.';
  end if;

  if not public.room_deletion_owner_matches(
    acting_owner_id,
    room_record.owner_id,
    room_record.created_by
  ) then
    raise exception using
      errcode = '42501',
      message = 'Only the Room owner can refresh deletion preflight.';
  end if;

  if not public.room_deletion_billing_preflight_is_current(billing_preflight) then
    raise exception using
      errcode = 'P0001',
      message = 'A current inactive-billing verification is required.';
  end if;

  update public.room_deletion_jobs
  set preflight_snapshot = coalesce(billing_preflight, '{}'::jsonb)
  where id = target_job_id
  returning * into job_record;

  return job_record;
end;
$$;

create or replace function public.finalize_room_deletion_job(
  target_job_id uuid,
  acting_owner_id uuid
)
returns public.room_deletion_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_record public.room_deletion_jobs%rowtype;
  room_record public.rooms%rowtype;
  organization_security jsonb := '{}'::jsonb;
  organization_retention_days integer := 0;
  retained_until timestamptz;
  snapshot_owner_id uuid;
  snapshot_creator_id uuid;
begin
  select *
  into job_record
  from public.room_deletion_jobs
  where id = target_job_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Room deletion job not found.';
  end if;

  begin
    snapshot_owner_id := nullif(job_record.room_snapshot ->> 'ownerId', '')::uuid;
    snapshot_creator_id := nullif(job_record.room_snapshot ->> 'createdBy', '')::uuid;
  exception when others then
    raise exception using
      errcode = 'P0001',
      message = 'The Room deletion ownership snapshot is invalid.';
  end;

  if acting_owner_id is null
    or not (
      acting_owner_id is not distinct from job_record.requested_by
      or public.room_deletion_owner_matches(
        acting_owner_id,
        snapshot_owner_id,
        snapshot_creator_id
      )
    )
  then
    raise exception using
      errcode = '42501',
      message = 'Only the verified Room owner can finalize permanent deletion.';
  end if;

  if job_record.status = 'completed' then
    return job_record;
  end if;

  if job_record.status <> 'storage_complete'
    or job_record.reconciled_at is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'Storage must be fully reconciled before final Room deletion.';
  end if;

  if job_record.storage_quiet_until > now() then
    raise exception using
      errcode = 'P0001',
      message = 'The Storage upload quiet period has not ended.';
  end if;

  if job_record.reconciled_at < job_record.storage_quiet_until then
    raise exception using
      errcode = 'P0001',
      message = 'Storage must be reconciled again after the upload quiet period.';
  end if;

  if not public.room_deletion_billing_preflight_is_current(
    job_record.preflight_snapshot
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'A fresh inactive-billing verification is required before final deletion.';
  end if;

  if exists (
    select 1
    from public.room_deletion_objects deletion_object
    where deletion_object.job_id = target_job_id
      and deletion_object.status <> 'deleted'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Undeleted Storage objects still remain in the manifest.';
  end if;

  -- Verify every manifest path directly against Storage at finalization time.
  if exists (
    select 1
    from public.room_deletion_objects deletion_object
    join storage.objects stored_object
      on stored_object.bucket_id = deletion_object.bucket_id
     and stored_object.name = deletion_object.object_path
    where deletion_object.job_id = target_job_id
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'A manifest Storage object still exists.';
  end if;

  -- Catch orphaned or newly recreated objects under both confirmed Room-owned
  -- bucket prefixes, even when no metadata row exists.
  if exists (
    select 1
    from storage.objects stored_object
    where stored_object.bucket_id in ('room-resources', 'room-post-attachments')
      and (
        stored_object.name = job_record.room_id::text
        or stored_object.name like job_record.room_id::text || '/%'
      )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Room-prefixed Storage objects still exist.';
  end if;

  select *
  into room_record
  from public.rooms
  where id = job_record.room_id
  for update;

  if not found then
    update public.room_deletion_jobs
    set status = 'completed',
        room_deleted_at = coalesce(room_deleted_at, now()),
        completed_at = coalesce(completed_at, now()),
        last_error = null
    where id = target_job_id
    returning * into job_record;

    return job_record;
  end if;

  if not public.room_deletion_owner_matches(
    acting_owner_id,
    room_record.owner_id,
    room_record.created_by
  ) then
    raise exception using
      errcode = '42501',
      message = 'Only the current Room owner can finalize permanent deletion.';
  end if;

  if coalesce(room_record.status, '') <> 'deleting' then
    raise exception using
      errcode = 'P0001',
      message = 'The Room is not in the deletion state.';
  end if;

  if room_record.deletion_scheduled_for is null
    or room_record.deletion_scheduled_for > now()
  then
    raise exception using
      errcode = 'P0001',
      message = 'The Room recovery period has not ended.';
  end if;

  if exists (
    select 1
    from public.room_retention_holds hold_record
    where hold_record.room_id = room_record.id
      and hold_record.target_type = 'room'
      and hold_record.status = 'active'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'An active Room retention hold blocks permanent deletion.';
  end if;

  if room_record.organization_id is not null then
    select organization.security
    into organization_security
    from public.room_organizations organization
    where organization.id = room_record.organization_id;

    if not found then
      raise exception using
        errcode = 'P0001',
        message = 'Organization retention policy could not be verified.';
    end if;

    if coalesce(organization_security ->> 'legalHold', 'false') = 'true' then
      raise exception using
        errcode = 'P0001',
        message = 'An organization legal hold blocks permanent deletion.';
    end if;

    organization_retention_days :=
      public.room_deletion_retention_days(organization_security);

    if organization_retention_days > 0 then
      if room_record.created_at is null then
        raise exception using
          errcode = 'P0001',
          message = 'Room creation time could not be verified for retention enforcement.';
      end if;

      retained_until := room_record.created_at
        + make_interval(days => organization_retention_days);

      if retained_until > now() then
        raise exception using
          errcode = 'P0001',
          message = 'Organization retention still protects this Room.';
      end if;
    end if;
  end if;

  update public.room_deletion_jobs
  set status = 'finalizing'
  where id = target_job_id;

  delete from public.rooms
  where id = room_record.id;

  update public.room_deletion_jobs
  set status = 'completed',
      room_deleted_at = now(),
      completed_at = now(),
      last_error = null
  where id = target_job_id
  returning * into job_record;

  return job_record;
end;
$$;

revoke all on function public.room_deletion_owner_matches(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.room_deletion_retention_days(jsonb)
  from public, anon, authenticated;
revoke all on function public.begin_room_deletion_job(uuid, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.refresh_room_deletion_billing_preflight(uuid, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.finalize_room_deletion_job(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.begin_room_deletion_job(uuid, uuid, jsonb)
  to service_role;
grant execute on function public.refresh_room_deletion_billing_preflight(uuid, uuid, jsonb)
  to service_role;
grant execute on function public.finalize_room_deletion_job(uuid, uuid)
  to service_role;

do $$
declare
  quiet_column_nullable text;
begin
  select column_value.is_nullable
  into quiet_column_nullable
  from information_schema.columns column_value
  where column_value.table_schema = 'public'
    and column_value.table_name = 'room_deletion_jobs'
    and column_value.column_name = 'storage_quiet_until';

  if quiet_column_nullable is distinct from 'NO' then
    raise exception 'room_deletion_jobs.storage_quiet_until must be NOT NULL.';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Room members can upload post files'
      and cmd = 'INSERT'
  ) then
    raise exception 'The active-Room post-file upload policy is missing.';
  end if;
end
$$;

commit;
