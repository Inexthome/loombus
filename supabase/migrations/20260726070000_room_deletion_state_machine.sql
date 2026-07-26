-- Persisted, retryable Room permanent-deletion state machine.
--
-- This migration creates service-role-only job and object-manifest records plus
-- atomic transition functions. It does not enable permanent deletion by itself.
-- ROOM_PERMANENT_DELETION_ENABLED remains default-off in the application.

begin;

do $$
begin
  if to_regclass('public.rooms') is null then
    raise exception 'Required table public.rooms does not exist.';
  end if;
  if to_regclass('public.room_retention_holds') is null then
    raise exception 'Required table public.room_retention_holds does not exist.';
  end if;
  if to_regclass('public.room_organizations') is null then
    raise exception 'Required table public.room_organizations does not exist.';
  end if;
end
$$;

create table if not exists public.room_deletion_jobs (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null,
  room_name text not null,
  requested_by uuid references auth.users(id) on delete set null,
  previous_room_status text not null,
  status text not null default 'building_manifest',
  room_snapshot jsonb not null default '{}'::jsonb,
  preflight_snapshot jsonb not null default '{}'::jsonb,
  object_count bigint not null default 0,
  deleted_count bigint not null default 0,
  failed_count bigint not null default 0,
  worker_attempt_count integer not null default 0,
  last_error text,
  manifest_completed_at timestamptz,
  reconciled_at timestamptz,
  room_deleted_at timestamptz,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint room_deletion_jobs_status_check check (
    status in (
      'building_manifest',
      'ready',
      'deleting_storage',
      'storage_complete',
      'finalizing',
      'completed',
      'failed',
      'cancelled'
    )
  ),
  constraint room_deletion_jobs_room_name_check check (
    char_length(room_name) between 1 and 240
  ),
  constraint room_deletion_jobs_counts_check check (
    object_count >= 0
    and deleted_count >= 0
    and failed_count >= 0
    and worker_attempt_count >= 0
  ),
  constraint room_deletion_jobs_last_error_check check (
    last_error is null or char_length(last_error) <= 4000
  )
);

create unique index if not exists room_deletion_jobs_one_active_per_room_idx
  on public.room_deletion_jobs (room_id)
  where status not in ('completed', 'cancelled');

create index if not exists room_deletion_jobs_status_updated_idx
  on public.room_deletion_jobs (status, updated_at);

create index if not exists room_deletion_jobs_room_created_idx
  on public.room_deletion_jobs (room_id, created_at desc);

create table if not exists public.room_deletion_objects (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.room_deletion_jobs(id) on delete cascade,
  room_id uuid not null,
  bucket_id text not null,
  object_path text not null,
  source_kind text not null,
  source_record_id uuid,
  source_metadata jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  last_error text,
  discovered_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  claimed_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint room_deletion_objects_status_check check (
    status in ('pending', 'deleting', 'deleted', 'failed')
  ),
  constraint room_deletion_objects_bucket_check check (
    char_length(bucket_id) between 1 and 100
  ),
  constraint room_deletion_objects_path_check check (
    char_length(object_path) between 1 and 2048
  ),
  constraint room_deletion_objects_source_check check (
    char_length(source_kind) between 1 and 100
  ),
  constraint room_deletion_objects_attempt_check check (attempt_count >= 0),
  constraint room_deletion_objects_last_error_check check (
    last_error is null or char_length(last_error) <= 4000
  ),
  unique (job_id, bucket_id, object_path)
);

create index if not exists room_deletion_objects_job_status_idx
  on public.room_deletion_objects (job_id, status, updated_at);

create index if not exists room_deletion_objects_room_idx
  on public.room_deletion_objects (room_id, created_at);

create or replace function public.touch_room_deletion_state_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_room_deletion_jobs_updated_at
  on public.room_deletion_jobs;
create trigger touch_room_deletion_jobs_updated_at
before update on public.room_deletion_jobs
for each row execute function public.touch_room_deletion_state_updated_at();

drop trigger if exists touch_room_deletion_objects_updated_at
  on public.room_deletion_objects;
create trigger touch_room_deletion_objects_updated_at
before update on public.room_deletion_objects
for each row execute function public.touch_room_deletion_state_updated_at();

alter table public.room_deletion_jobs enable row level security;
alter table public.room_deletion_objects enable row level security;

revoke all on table public.room_deletion_jobs from public, anon, authenticated;
revoke all on table public.room_deletion_objects from public, anon, authenticated;
grant select, insert, update, delete on table public.room_deletion_jobs to service_role;
grant select, insert, update, delete on table public.room_deletion_objects to service_role;

create or replace function public.room_deletion_billing_preflight_is_current(
  payload jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  verified_at timestamptz;
begin
  if coalesce(payload ->> 'billingActive', '') <> 'false' then
    return false;
  end if;

  begin
    verified_at := (payload ->> 'billingVerifiedAt')::timestamptz;
  exception when others then
    return false;
  end;

  return verified_at >= now() - interval '10 minutes'
    and verified_at <= now() + interval '1 minute';
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
    raise exception using
      errcode = 'P0002',
      message = 'Room not found.';
  end if;

  if acting_owner_id is null
    or acting_owner_id not in (room_record.owner_id, room_record.created_by)
  then
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

    if coalesce(organization_security ->> 'retentionDays', '') ~ '^[0-9]+$' then
      organization_retention_days := greatest(
        0,
        least(3650, (organization_security ->> 'retentionDays')::integer)
      );
    end if;

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
    preflight_snapshot
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
    coalesce(billing_preflight, '{}'::jsonb)
  )
  returning id into inserted_job_id;

  update public.rooms
  set status = 'deleting',
      updated_at = now()
  where id = target_room_id;

  return query select inserted_job_id, 'building_manifest'::text, true;
end;
$$;

create or replace function public.register_room_deletion_object(
  target_job_id uuid,
  target_bucket_id text,
  target_object_path text,
  target_source_kind text,
  target_source_record_id uuid default null,
  target_source_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_record public.room_deletion_jobs%rowtype;
  registered_id uuid;
begin
  select *
  into job_record
  from public.room_deletion_jobs
  where id = target_job_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Room deletion job not found.';
  end if;

  if job_record.status in ('finalizing', 'completed', 'cancelled') then
    raise exception using
      errcode = 'P0001',
      message = 'The Room deletion manifest can no longer be changed.';
  end if;

  if nullif(btrim(target_bucket_id), '') is null
    or nullif(btrim(target_object_path), '') is null
    or nullif(btrim(target_source_kind), '') is null
  then
    raise exception using
      errcode = '22023',
      message = 'Bucket, object path, and source kind are required.';
  end if;

  insert into public.room_deletion_objects as deletion_object (
    job_id,
    room_id,
    bucket_id,
    object_path,
    source_kind,
    source_record_id,
    source_metadata,
    status
  )
  values (
    job_record.id,
    job_record.room_id,
    btrim(target_bucket_id),
    btrim(target_object_path),
    left(btrim(target_source_kind), 100),
    target_source_record_id,
    coalesce(target_source_metadata, '{}'::jsonb),
    'pending'
  )
  on conflict (job_id, bucket_id, object_path)
  do update set
    source_record_id = coalesce(
      deletion_object.source_record_id,
      excluded.source_record_id
    ),
    source_metadata = deletion_object.source_metadata || excluded.source_metadata,
    source_kind = case
      when deletion_object.source_kind = excluded.source_kind
        then deletion_object.source_kind
      else 'multiple_sources'
    end,
    last_seen_at = now(),
    status = case
      when deletion_object.status = 'deleted' then 'pending'
      else deletion_object.status
    end,
    deleted_at = case
      when deletion_object.status = 'deleted' then null
      else deletion_object.deleted_at
    end,
    last_error = case
      when deletion_object.status = 'deleted' then null
      else deletion_object.last_error
    end
  returning id into registered_id;

  update public.room_deletion_jobs
  set reconciled_at = null,
      status = case
        when status = 'storage_complete' then 'deleting_storage'
        else status
      end
  where id = target_job_id;

  return registered_id;
end;
$$;

create or replace function public.mark_room_deletion_manifest_ready(
  target_job_id uuid
)
returns public.room_deletion_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_record public.room_deletion_jobs%rowtype;
  total_objects bigint;
begin
  select *
  into job_record
  from public.room_deletion_jobs
  where id = target_job_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Room deletion job not found.';
  end if;

  if job_record.status <> 'building_manifest' then
    raise exception using
      errcode = 'P0001',
      message = 'Only a manifest-building job can be marked ready.';
  end if;

  select count(*)
  into total_objects
  from public.room_deletion_objects
  where job_id = target_job_id;

  update public.room_deletion_jobs
  set status = 'ready',
      object_count = total_objects,
      deleted_count = 0,
      failed_count = 0,
      manifest_completed_at = now(),
      reconciled_at = null,
      last_error = null
  where id = target_job_id
  returning * into job_record;

  return job_record;
end;
$$;

create or replace function public.claim_room_deletion_object_batch(
  target_job_id uuid,
  requested_batch_size integer default 100
)
returns table (
  object_id uuid,
  bucket_id text,
  object_path text,
  attempt_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_record public.room_deletion_jobs%rowtype;
  bounded_batch_size integer;
begin
  bounded_batch_size := greatest(1, least(coalesce(requested_batch_size, 100), 500));

  select *
  into job_record
  from public.room_deletion_jobs
  where id = target_job_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Room deletion job not found.';
  end if;

  if job_record.status not in ('ready', 'deleting_storage') then
    raise exception using
      errcode = 'P0001',
      message = 'The Room deletion job is not ready to delete Storage objects.';
  end if;

  update public.room_deletion_jobs
  set status = 'deleting_storage',
      worker_attempt_count = worker_attempt_count + 1
  where id = target_job_id;

  return query
  with candidates as (
    select candidate.id
    from public.room_deletion_objects candidate
    where candidate.job_id = target_job_id
      and (
        candidate.status in ('pending', 'failed')
        or (
          candidate.status = 'deleting'
          and candidate.claimed_at < now() - interval '15 minutes'
        )
      )
    order by candidate.created_at, candidate.id
    for update skip locked
    limit bounded_batch_size
  )
  update public.room_deletion_objects deletion_object
  set status = 'deleting',
      claimed_at = now(),
      attempt_count = deletion_object.attempt_count + 1,
      last_error = null
  from candidates
  where deletion_object.id = candidates.id
  returning
    deletion_object.id,
    deletion_object.bucket_id,
    deletion_object.object_path,
    deletion_object.attempt_count;
end;
$$;

create or replace function public.record_room_deletion_object_result(
  target_object_id uuid,
  succeeded boolean,
  failure_message text default null
)
returns public.room_deletion_objects
language plpgsql
security definer
set search_path = ''
as $$
declare
  object_record public.room_deletion_objects%rowtype;
begin
  select *
  into object_record
  from public.room_deletion_objects
  where id = target_object_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Room deletion object not found.';
  end if;

  update public.room_deletion_objects
  set status = case when succeeded then 'deleted' else 'failed' end,
      deleted_at = case when succeeded then now() else null end,
      claimed_at = null,
      last_error = case
        when succeeded then null
        else left(coalesce(nullif(btrim(failure_message), ''), 'Storage deletion failed.'), 4000)
      end
  where id = target_object_id
  returning * into object_record;

  update public.room_deletion_jobs deletion_job
  set object_count = counts.object_count,
      deleted_count = counts.deleted_count,
      failed_count = counts.failed_count,
      last_error = case
        when succeeded then deletion_job.last_error
        else object_record.last_error
      end
  from (
    select
      count(*)::bigint as object_count,
      count(*) filter (where status = 'deleted')::bigint as deleted_count,
      count(*) filter (where status = 'failed')::bigint as failed_count
    from public.room_deletion_objects
    where job_id = object_record.job_id
  ) counts
  where deletion_job.id = object_record.job_id;

  return object_record;
end;
$$;

create or replace function public.mark_room_deletion_storage_reconciled(
  target_job_id uuid
)
returns public.room_deletion_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_record public.room_deletion_jobs%rowtype;
  total_objects bigint;
  deleted_objects bigint;
begin
  select *
  into job_record
  from public.room_deletion_jobs
  where id = target_job_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Room deletion job not found.';
  end if;

  if job_record.status not in ('ready', 'deleting_storage', 'storage_complete') then
    raise exception using
      errcode = 'P0001',
      message = 'The Room deletion job cannot be reconciled in its current state.';
  end if;

  select
    count(*)::bigint,
    count(*) filter (where status = 'deleted')::bigint
  into total_objects, deleted_objects
  from public.room_deletion_objects
  where job_id = target_job_id;

  if total_objects <> deleted_objects then
    raise exception using
      errcode = 'P0001',
      message = 'Storage reconciliation found objects that are not deleted.';
  end if;

  update public.room_deletion_jobs
  set status = 'storage_complete',
      object_count = total_objects,
      deleted_count = deleted_objects,
      failed_count = 0,
      reconciled_at = now(),
      last_error = null
  where id = target_job_id
  returning * into job_record;

  return job_record;
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

  if acting_owner_id is null
    or acting_owner_id not in (room_record.owner_id, room_record.created_by)
  then
    raise exception using errcode = '42501', message = 'Only the Room owner can refresh deletion preflight.';
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
begin
  select *
  into job_record
  from public.room_deletion_jobs
  where id = target_job_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Room deletion job not found.';
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

  if acting_owner_id is null
    or acting_owner_id not in (room_record.owner_id, room_record.created_by)
  then
    raise exception using
      errcode = '42501',
      message = 'Only the Room owner can finalize permanent deletion.';
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

    if coalesce(organization_security ->> 'retentionDays', '') ~ '^[0-9]+$' then
      organization_retention_days := greatest(
        0,
        least(3650, (organization_security ->> 'retentionDays')::integer)
      );
    end if;

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

revoke all on function public.room_deletion_billing_preflight_is_current(jsonb)
  from public, anon, authenticated;
revoke all on function public.begin_room_deletion_job(uuid, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.register_room_deletion_object(uuid, text, text, text, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.mark_room_deletion_manifest_ready(uuid)
  from public, anon, authenticated;
revoke all on function public.claim_room_deletion_object_batch(uuid, integer)
  from public, anon, authenticated;
revoke all on function public.record_room_deletion_object_result(uuid, boolean, text)
  from public, anon, authenticated;
revoke all on function public.mark_room_deletion_storage_reconciled(uuid)
  from public, anon, authenticated;
revoke all on function public.refresh_room_deletion_billing_preflight(uuid, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.finalize_room_deletion_job(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.begin_room_deletion_job(uuid, uuid, jsonb)
  to service_role;
grant execute on function public.register_room_deletion_object(uuid, text, text, text, uuid, jsonb)
  to service_role;
grant execute on function public.mark_room_deletion_manifest_ready(uuid)
  to service_role;
grant execute on function public.claim_room_deletion_object_batch(uuid, integer)
  to service_role;
grant execute on function public.record_room_deletion_object_result(uuid, boolean, text)
  to service_role;
grant execute on function public.mark_room_deletion_storage_reconciled(uuid)
  to service_role;
grant execute on function public.refresh_room_deletion_billing_preflight(uuid, uuid, jsonb)
  to service_role;
grant execute on function public.finalize_room_deletion_job(uuid, uuid)
  to service_role;

comment on table public.room_deletion_jobs is
  'Service-role-only persisted Room permanent-deletion state machine. Records survive Room deletion.';
comment on table public.room_deletion_objects is
  'Deduplicated Storage manifest and retry state for one Room deletion job.';

-- Fail closed if the service-only privacy boundary or required indexes were not
-- created exactly as expected.
do $$
declare
  jobs_rls boolean;
  objects_rls boolean;
begin
  select relation.relrowsecurity
  into jobs_rls
  from pg_catalog.pg_class relation
  join pg_catalog.pg_namespace namespace
    on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relname = 'room_deletion_jobs';

  select relation.relrowsecurity
  into objects_rls
  from pg_catalog.pg_class relation
  join pg_catalog.pg_namespace namespace
    on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relname = 'room_deletion_objects';

  if jobs_rls is distinct from true or objects_rls is distinct from true then
    raise exception 'Room deletion state tables must have RLS enabled.';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in ('room_deletion_jobs', 'room_deletion_objects')
      and grantee in ('PUBLIC', 'anon', 'authenticated')
  ) then
    raise exception 'Public or authenticated grants remain on Room deletion state tables.';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_indexes
    where schemaname = 'public'
      and indexname = 'room_deletion_jobs_one_active_per_room_idx'
  ) then
    raise exception 'The active Room deletion job uniqueness index is missing.';
  end if;
end
$$;

commit;
