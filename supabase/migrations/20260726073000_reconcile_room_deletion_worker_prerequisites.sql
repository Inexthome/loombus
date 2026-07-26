-- Canonical worker prerequisites for the permanent Room deletion workflow.
--
-- This migration records the production corrections verified after PR #652 and
-- adds bounded service-role batch functions used by the application worker.
-- It does not create a deletion job or enable owner-facing permanent deletion.

begin;

do $$
begin
  if to_regclass('public.room_deletion_jobs') is null
    or to_regclass('public.room_deletion_objects') is null
  then
    raise exception 'The Room deletion state machine must be installed first.';
  end if;

  if to_regprocedure('public.touch_room_deletion_state_updated_at()') is null
    or to_regprocedure('public.try_room_uuid(text)') is null
    or to_regprocedure('public.user_can_access_room_post(uuid)') is null
  then
    raise exception 'A required Room deletion or Storage authorization helper is missing.';
  end if;
end
$$;

-- Trigger helpers do not need direct browser execution.
revoke all on function public.touch_room_deletion_state_updated_at()
  from public, anon, authenticated;
grant execute on function public.touch_room_deletion_state_updated_at()
  to service_role;

-- Preserve one canonical authenticated upload policy. PostgreSQL permissive
-- policies are OR-combined, so historical duplicates must not remain.
drop policy if exists "Authorized members can upload post files"
  on storage.objects;
drop policy if exists "Room members can upload post files"
  on storage.objects;
drop policy if exists "Authorized members can upload active Room post files"
  on storage.objects;

create policy "Authorized members can upload active Room post files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'room-post-attachments'
  and owner = auth.uid()
  and exists (
    select 1
    from public.room_posts post
    join public.rooms room
      on room.id = post.room_id
    where post.id = public.try_room_uuid(
      (storage.foldername(storage.objects.name))[2]
    )
      and post.room_id = public.try_room_uuid(
        (storage.foldername(storage.objects.name))[1]
      )
      and room.status = 'active'
      and public.user_can_access_room_post(post.id)
  )
);

create or replace function public.register_room_deletion_objects_batch(
  target_job_id uuid,
  objects jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_record public.room_deletion_jobs%rowtype;
  submitted_count integer;
  affected_count bigint;
begin
  if jsonb_typeof(coalesce(objects, '[]'::jsonb)) <> 'array' then
    raise exception using
      errcode = '22023',
      message = 'Deletion objects must be a JSON array.';
  end if;

  submitted_count := jsonb_array_length(coalesce(objects, '[]'::jsonb));
  if submitted_count > 500 then
    raise exception using
      errcode = '22023',
      message = 'At most 500 deletion objects can be registered per batch.';
  end if;
  if submitted_count = 0 then
    return 0;
  end if;

  select *
  into job_record
  from public.room_deletion_jobs
  where id = target_job_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Room deletion job not found.';
  end if;
  if job_record.status in ('finalizing', 'completed', 'cancelled') then
    raise exception using
      errcode = 'P0001',
      message = 'The Room deletion manifest can no longer be changed.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(objects) as candidate(
      bucket_id text,
      object_path text,
      source_kind text,
      source_record_id uuid,
      source_metadata jsonb
    )
    where nullif(btrim(candidate.bucket_id), '') is null
      or candidate.bucket_id not in ('room-resources', 'room-post-attachments')
      or nullif(btrim(candidate.object_path), '') is null
      or not (
        candidate.object_path = job_record.room_id::text
        or candidate.object_path like job_record.room_id::text || '/%'
      )
      or nullif(btrim(candidate.source_kind), '') is null
      or (
        candidate.source_metadata is not null
        and jsonb_typeof(candidate.source_metadata) <> 'object'
      )
  ) then
    raise exception using
      errcode = '22023',
      message = 'A deletion object has an invalid bucket, path, source, or metadata payload.';
  end if;

  with submitted as (
    select
      btrim(candidate.bucket_id) as bucket_id,
      btrim(candidate.object_path) as object_path,
      left(btrim(candidate.source_kind), 100) as source_kind,
      candidate.source_record_id,
      coalesce(candidate.source_metadata, '{}'::jsonb) as source_metadata
    from jsonb_to_recordset(objects) as candidate(
      bucket_id text,
      object_path text,
      source_kind text,
      source_record_id uuid,
      source_metadata jsonb
    )
  ),
  deduplicated as (
    select distinct on (submitted.bucket_id, submitted.object_path)
      submitted.bucket_id,
      submitted.object_path,
      submitted.source_kind,
      submitted.source_record_id,
      submitted.source_metadata
    from submitted
    order by
      submitted.bucket_id,
      submitted.object_path,
      submitted.source_kind,
      submitted.source_record_id nulls last
  )
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
  select
    job_record.id,
    job_record.room_id,
    candidate.bucket_id,
    candidate.object_path,
    candidate.source_kind,
    candidate.source_record_id,
    candidate.source_metadata,
    'pending'
  from deduplicated candidate
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
    claimed_at = case
      when deletion_object.status = 'deleted' then null
      else deletion_object.claimed_at
    end,
    deleted_at = case
      when deletion_object.status = 'deleted' then null
      else deletion_object.deleted_at
    end,
    last_error = case
      when deletion_object.status = 'deleted' then null
      else deletion_object.last_error
    end;

  get diagnostics affected_count = row_count;

  update public.room_deletion_jobs
  set reconciled_at = null,
      status = case
        when status = 'storage_complete' then 'deleting_storage'
        else status
      end
  where id = target_job_id;

  return affected_count;
end;
$$;

create or replace function public.record_room_deletion_object_results_batch(
  target_job_id uuid,
  results jsonb
)
returns public.room_deletion_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_record public.room_deletion_jobs%rowtype;
  submitted_count integer;
  distinct_count integer;
  matched_count integer;
  first_failure text;
begin
  if jsonb_typeof(coalesce(results, '[]'::jsonb)) <> 'array' then
    raise exception using
      errcode = '22023',
      message = 'Deletion results must be a JSON array.';
  end if;

  submitted_count := jsonb_array_length(coalesce(results, '[]'::jsonb));
  if submitted_count > 500 then
    raise exception using
      errcode = '22023',
      message = 'At most 500 deletion results can be recorded per batch.';
  end if;

  select *
  into job_record
  from public.room_deletion_jobs
  where id = target_job_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Room deletion job not found.';
  end if;
  if submitted_count = 0 then
    return job_record;
  end if;
  if job_record.status not in ('ready', 'deleting_storage') then
    raise exception using
      errcode = 'P0001',
      message = 'The Room deletion job is not accepting Storage results.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(results) as candidate(
      object_id uuid,
      succeeded boolean,
      failure_message text
    )
    where candidate.object_id is null
      or candidate.succeeded is null
  ) then
    raise exception using
      errcode = '22023',
      message = 'Every deletion result requires an object id and success value.';
  end if;

  select count(distinct candidate.object_id)
  into distinct_count
  from jsonb_to_recordset(results) as candidate(
    object_id uuid,
    succeeded boolean,
    failure_message text
  );

  if distinct_count <> submitted_count then
    raise exception using
      errcode = '22023',
      message = 'Duplicate object ids are not allowed in a deletion result batch.';
  end if;

  select count(*)
  into matched_count
  from jsonb_to_recordset(results) as candidate(
    object_id uuid,
    succeeded boolean,
    failure_message text
  )
  join public.room_deletion_objects deletion_object
    on deletion_object.id = candidate.object_id
   and deletion_object.job_id = target_job_id
   and deletion_object.status in ('deleting', 'failed', 'deleted');

  if matched_count <> submitted_count then
    raise exception using
      errcode = '22023',
      message = 'A deletion result is not claimable by this job.';
  end if;

  update public.room_deletion_objects deletion_object
  set status = case
        when deletion_object.status = 'deleted' then 'deleted'
        when candidate.succeeded then 'deleted'
        else 'failed'
      end,
      deleted_at = case
        when deletion_object.status = 'deleted' then deletion_object.deleted_at
        when candidate.succeeded then now()
        else null
      end,
      claimed_at = null,
      last_error = case
        when deletion_object.status = 'deleted' or candidate.succeeded then null
        else left(
          coalesce(
            nullif(btrim(candidate.failure_message), ''),
            'Storage deletion failed.'
          ),
          4000
        )
      end
  from jsonb_to_recordset(results) as candidate(
    object_id uuid,
    succeeded boolean,
    failure_message text
  )
  where deletion_object.id = candidate.object_id
    and deletion_object.job_id = target_job_id;

  select left(
    coalesce(
      nullif(btrim(candidate.failure_message), ''),
      'Storage deletion failed.'
    ),
    4000
  )
  into first_failure
  from jsonb_to_recordset(results) as candidate(
    object_id uuid,
    succeeded boolean,
    failure_message text
  )
  where not candidate.succeeded
  order by candidate.object_id
  limit 1;

  update public.room_deletion_jobs deletion_job
  set object_count = counts.object_count,
      deleted_count = counts.deleted_count,
      failed_count = counts.failed_count,
      last_error = case
        when counts.failed_count = 0 then null
        else coalesce(first_failure, deletion_job.last_error, 'Storage deletion failed.')
      end
  from (
    select
      count(*)::bigint as object_count,
      count(*) filter (where status = 'deleted')::bigint as deleted_count,
      count(*) filter (where status = 'failed')::bigint as failed_count
    from public.room_deletion_objects
    where job_id = target_job_id
  ) counts
  where deletion_job.id = target_job_id
  returning deletion_job.* into job_record;

  return job_record;
end;
$$;

revoke all on function public.register_room_deletion_objects_batch(uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.record_room_deletion_object_results_batch(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.register_room_deletion_objects_batch(uuid, jsonb)
  to service_role;
grant execute on function public.record_room_deletion_object_results_batch(uuid, jsonb)
  to service_role;

comment on function public.register_room_deletion_objects_batch(uuid, jsonb) is
  'Service-role-only bounded, idempotent Room Storage manifest registration.';
comment on function public.record_room_deletion_object_results_batch(uuid, jsonb) is
  'Service-role-only bounded, idempotent Room Storage deletion result recording.';

-- Fail closed if the canonical privacy and Storage boundaries are not present.
do $$
begin
  if to_regprocedure('public.register_room_deletion_objects_batch(uuid,jsonb)') is null
    or to_regprocedure('public.record_room_deletion_object_results_batch(uuid,jsonb)') is null
  then
    raise exception 'A Room deletion worker batch function is missing.';
  end if;

  if exists (
    select 1
    from information_schema.routine_privileges privilege
    where privilege.routine_schema = 'public'
      and privilege.routine_name in (
        'touch_room_deletion_state_updated_at',
        'register_room_deletion_objects_batch',
        'record_room_deletion_object_results_batch'
      )
      and lower(privilege.grantee) in ('public', 'anon', 'authenticated')
  ) then
    raise exception 'Browser execution remains on a Room deletion worker function.';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.register_room_deletion_objects_batch(uuid,jsonb)',
    'EXECUTE'
  ) or not has_function_privilege(
    'service_role',
    'public.record_room_deletion_object_results_batch(uuid,jsonb)',
    'EXECUTE'
  ) then
    raise exception 'The service role cannot execute a Room deletion worker batch function.';
  end if;

  if (
    select count(*)
    from pg_catalog.pg_policies policy
    where policy.schemaname = 'storage'
      and policy.tablename = 'objects'
      and policy.cmd = 'INSERT'
      and policy.with_check ilike '%room-post-attachments%'
  ) <> 1 then
    raise exception 'Exactly one Room post-attachment upload policy is required.';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_policies policy
    where policy.schemaname = 'storage'
      and policy.tablename = 'objects'
      and policy.policyname = 'Authorized members can upload active Room post files'
      and policy.cmd = 'INSERT'
      and policy.roles = array['authenticated']::name[]
      and policy.with_check ilike '%storage.foldername(objects.name)%'
      and policy.with_check ilike '%room.status%active%'
      and policy.with_check ilike '%user_can_access_room_post%'
  ) then
    raise exception 'The canonical active-Room post-file upload policy is missing.';
  end if;
end
$$;

commit;
