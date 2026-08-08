-- Issue #674: fail-closed Legal Operations hold enforcement for destructive paths.
--
-- This migration does not enable account deletion or Room permanent deletion.
-- It adds exact-scope service-role hold guards beneath the existing feature flags.
-- Account-wide holds block request claiming/finalization and all currently approved
-- automatic account-deletion RPCs. Resource-specific holds block the matching
-- automatic account-deletion RPC. Exact Room holds block job creation, Storage
-- object claiming, and final database deletion.

begin;

-- Exact account-deletion hold matching. Avoid the broader OR semantics of the
-- general legal_hold_applies helper when deciding whether to destroy data.
create or replace function public.legal_account_deletion_hold_applies(
  p_user_id uuid,
  p_resource_key text default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_user_id is null then false
    else exists (
      select 1
      from public.legal_preservation_holds hold_row
      join public.legal_preservation_hold_targets target_row
        on target_row.hold_id = hold_row.id
      where hold_row.status = 'active'
        and (hold_row.starts_at is null or hold_row.starts_at <= now())
        and (hold_row.expires_at is null or hold_row.expires_at > now())
        and (
          (
            target_row.target_type = 'account'
            and (
              target_row.subject_user_id = p_user_id
              or target_row.target_ref = p_user_id::text
            )
          )
          or (
            p_resource_key is not null
            and target_row.resource_key = p_resource_key
            and (
              target_row.subject_user_id = p_user_id
              or target_row.target_ref = p_user_id::text
            )
          )
        )
    )
  end;
$$;

create or replace function public.assert_account_deletion_not_held(
  p_request_id uuid,
  p_resource_key text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  subject_user_id uuid;
begin
  select request_row.user_id
  into subject_user_id
  from public.account_deletion_requests request_row
  where request_row.id = p_request_id;

  if not found then
    raise exception 'Deletion request not found.' using errcode = 'P0002';
  end if;

  if public.legal_account_deletion_hold_applies(subject_user_id, p_resource_key) then
    raise exception 'An active Legal Operations preservation hold blocks this account-deletion operation.'
      using errcode = 'P0001';
  end if;
end;
$$;

-- Exact Room matching requires the real Room UUID as target_ref. A resource-key
-- match is accepted only when the same exact Room UUID is also present.
create or replace function public.legal_room_hold_applies(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_room_id is null then false
    else exists (
      select 1
      from public.legal_preservation_holds hold_row
      join public.legal_preservation_hold_targets target_row
        on target_row.hold_id = hold_row.id
      where hold_row.status = 'active'
        and (hold_row.starts_at is null or hold_row.starts_at <= now())
        and (hold_row.expires_at is null or hold_row.expires_at > now())
        and target_row.target_ref = p_room_id::text
        and (
          target_row.target_type = 'room'
          or target_row.resource_key = 'rooms'
        )
    )
  end;
$$;

create or replace function public.assert_room_deletion_not_held(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.legal_room_hold_applies(p_room_id) then
    raise exception 'An active Legal Operations preservation hold blocks permanent Room deletion.'
      using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.legal_account_deletion_hold_applies(uuid, text)
  from public, anon, authenticated;
revoke all on function public.assert_account_deletion_not_held(uuid, text)
  from public, anon, authenticated;
revoke all on function public.legal_room_hold_applies(uuid)
  from public, anon, authenticated;
revoke all on function public.assert_room_deletion_not_held(uuid)
  from public, anon, authenticated;
grant execute on function public.legal_account_deletion_hold_applies(uuid, text)
  to service_role;
grant execute on function public.assert_account_deletion_not_held(uuid, text)
  to service_role;
grant execute on function public.legal_room_hold_applies(uuid)
  to service_role;
grant execute on function public.assert_room_deletion_not_held(uuid)
  to service_role;

-- Do not claim an account-deletion request while an account-wide legal hold is
-- active. Resource-specific holds are enforced again at each destructive RPC.
create or replace function public.claim_account_deletion_requests(p_limit integer default 10)
returns table (request_id uuid, user_id uuid, processing_attempts integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required.' using errcode = '42501';
  end if;

  return query
  with candidates as (
    select r.id
    from public.account_deletion_requests r
    where r.status in ('requested', 'failed')
      and not public.legal_account_deletion_hold_applies(r.user_id, null)
    order by r.requested_at, r.id
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 10), 50))
  ), claimed as (
    update public.account_deletion_requests r
    set status = 'processing',
        processing_started_at = now(),
        processing_completed_at = null,
        processing_attempts = r.processing_attempts + 1,
        last_error = null
    from candidates c
    where r.id = c.id
    returning r.id, r.user_id, r.processing_attempts
  ), events as (
    insert into public.account_deletion_events (
      request_id, user_id, actor_id, event_type, from_status, to_status, detail
    )
    select c.id, c.user_id, null, 'processing_started', null, 'processing',
      jsonb_build_object('attempt', c.processing_attempts)
    from claimed c
  )
  select c.id, c.user_id, c.processing_attempts from claimed c;
end;
$$;

revoke all on function public.claim_account_deletion_requests(integer)
  from public, anon, authenticated;
grant execute on function public.claim_account_deletion_requests(integer)
  to service_role;

-- Preserve the existing account-deletion handler implementations behind guarded
-- wrappers. The renamed implementations are deliberately not executable by the
-- service role directly, preventing a caller from bypassing the hold check.
do $$
begin
  if to_regprocedure('public.delete_account_notification_data_pre_hold(uuid)') is null then
    alter function public.delete_account_notification_data(uuid)
      rename to delete_account_notification_data_pre_hold;
  end if;
  if to_regprocedure('public.delete_account_private_personalization_data_pre_hold(uuid)') is null then
    alter function public.delete_account_private_personalization_data(uuid)
      rename to delete_account_private_personalization_data_pre_hold;
  end if;
  if to_regprocedure('public.delete_account_private_activity_data_pre_hold(uuid)') is null then
    alter function public.delete_account_private_activity_data(uuid)
      rename to delete_account_private_activity_data_pre_hold;
  end if;
  if to_regprocedure('public.delete_account_private_goals_data_pre_hold(uuid)') is null then
    alter function public.delete_account_private_goals_data(uuid)
      rename to delete_account_private_goals_data_pre_hold;
  end if;
  if to_regprocedure('public.delete_account_matching_preferences_data_pre_hold(uuid)') is null then
    alter function public.delete_account_matching_preferences_data(uuid)
      rename to delete_account_matching_preferences_data_pre_hold;
  end if;
  if to_regprocedure('public.delete_account_floor_cloud_data_pre_hold(uuid)') is null then
    alter function public.delete_account_floor_cloud_data(uuid)
      rename to delete_account_floor_cloud_data_pre_hold;
  end if;
  if to_regprocedure('public.delete_account_discussion_audience_preferences_data_pre_hold(uuid)') is null then
    alter function public.delete_account_discussion_audience_preferences_data(uuid)
      rename to delete_account_discussion_audience_preferences_data_pre_hold;
  end if;
  if to_regprocedure('public.delete_account_product_feedback_data_pre_hold(uuid)') is null then
    alter function public.delete_account_product_feedback_data(uuid)
      rename to delete_account_product_feedback_data_pre_hold;
  end if;
  if to_regprocedure('public.delete_account_commerce_saves_data_pre_hold(uuid)') is null then
    alter function public.delete_account_commerce_saves_data(uuid)
      rename to delete_account_commerce_saves_data_pre_hold;
  end if;
end
$$;

revoke all on function public.delete_account_notification_data_pre_hold(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.delete_account_private_personalization_data_pre_hold(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.delete_account_private_activity_data_pre_hold(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.delete_account_private_goals_data_pre_hold(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.delete_account_matching_preferences_data_pre_hold(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.delete_account_floor_cloud_data_pre_hold(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.delete_account_discussion_audience_preferences_data_pre_hold(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.delete_account_product_feedback_data_pre_hold(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.delete_account_commerce_saves_data_pre_hold(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.delete_account_notification_data(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.assert_account_deletion_not_held(p_request_id, 'notifications');
  return public.delete_account_notification_data_pre_hold(p_request_id);
end;
$$;

create or replace function public.delete_account_private_personalization_data(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.assert_account_deletion_not_held(p_request_id, 'private_personalization');
  return public.delete_account_private_personalization_data_pre_hold(p_request_id);
end;
$$;

create or replace function public.delete_account_private_activity_data(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.assert_account_deletion_not_held(p_request_id, 'private_activity');
  return public.delete_account_private_activity_data_pre_hold(p_request_id);
end;
$$;

create or replace function public.delete_account_private_goals_data(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.assert_account_deletion_not_held(p_request_id, 'private_goals_and_saved_folders');
  return public.delete_account_private_goals_data_pre_hold(p_request_id);
end;
$$;

create or replace function public.delete_account_matching_preferences_data(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.assert_account_deletion_not_held(p_request_id, 'private_matching_preferences');
  return public.delete_account_matching_preferences_data_pre_hold(p_request_id);
end;
$$;

create or replace function public.delete_account_floor_cloud_data(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.assert_account_deletion_not_held(p_request_id, 'private_floor_cloud');
  return public.delete_account_floor_cloud_data_pre_hold(p_request_id);
end;
$$;

create or replace function public.delete_account_discussion_audience_preferences_data(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.assert_account_deletion_not_held(p_request_id, 'private_discussion_audience_preferences');
  return public.delete_account_discussion_audience_preferences_data_pre_hold(p_request_id);
end;
$$;

create or replace function public.delete_account_product_feedback_data(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.assert_account_deletion_not_held(p_request_id, 'member_product_feedback');
  return public.delete_account_product_feedback_data_pre_hold(p_request_id);
end;
$$;

create or replace function public.delete_account_commerce_saves_data(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.assert_account_deletion_not_held(p_request_id, 'private_commerce_saves');
  return public.delete_account_commerce_saves_data_pre_hold(p_request_id);
end;
$$;

revoke all on function public.delete_account_notification_data(uuid)
  from public, anon, authenticated;
revoke all on function public.delete_account_private_personalization_data(uuid)
  from public, anon, authenticated;
revoke all on function public.delete_account_private_activity_data(uuid)
  from public, anon, authenticated;
revoke all on function public.delete_account_private_goals_data(uuid)
  from public, anon, authenticated;
revoke all on function public.delete_account_matching_preferences_data(uuid)
  from public, anon, authenticated;
revoke all on function public.delete_account_floor_cloud_data(uuid)
  from public, anon, authenticated;
revoke all on function public.delete_account_discussion_audience_preferences_data(uuid)
  from public, anon, authenticated;
revoke all on function public.delete_account_product_feedback_data(uuid)
  from public, anon, authenticated;
revoke all on function public.delete_account_commerce_saves_data(uuid)
  from public, anon, authenticated;

grant execute on function public.delete_account_notification_data(uuid) to service_role;
grant execute on function public.delete_account_private_personalization_data(uuid) to service_role;
grant execute on function public.delete_account_private_activity_data(uuid) to service_role;
grant execute on function public.delete_account_private_goals_data(uuid) to service_role;
grant execute on function public.delete_account_matching_preferences_data(uuid) to service_role;
grant execute on function public.delete_account_floor_cloud_data(uuid) to service_role;
grant execute on function public.delete_account_discussion_audience_preferences_data(uuid) to service_role;
grant execute on function public.delete_account_product_feedback_data(uuid) to service_role;
grant execute on function public.delete_account_commerce_saves_data(uuid) to service_role;

-- Guard account-deletion finalization so a hold activated after request claiming
-- cannot allow the request to become terminal while an account-wide hold is active.
do $$
begin
  if to_regprocedure('public.finalize_account_deletion_request_pre_hold(uuid)') is null then
    alter function public.finalize_account_deletion_request(uuid)
      rename to finalize_account_deletion_request_pre_hold;
  end if;
end
$$;

revoke all on function public.finalize_account_deletion_request_pre_hold(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.finalize_account_deletion_request(p_request_id uuid)
returns table (
  request_id uuid,
  status text,
  pending_count integer,
  failed_count integer,
  exception_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.assert_account_deletion_not_held(p_request_id, null);
  return query
  select * from public.finalize_account_deletion_request_pre_hold(p_request_id);
end;
$$;

revoke all on function public.finalize_account_deletion_request(uuid)
  from public, anon, authenticated;
grant execute on function public.finalize_account_deletion_request(uuid)
  to service_role;

-- Preserve the mature Room deletion state machine behind exact Room-hold guards.
-- This avoids copying or weakening its existing owner, recovery, retention,
-- Storage, and billing invariants.
do $$
begin
  if to_regprocedure('public.begin_room_deletion_job_pre_hold(uuid,uuid,jsonb)') is null then
    alter function public.begin_room_deletion_job(uuid, uuid, jsonb)
      rename to begin_room_deletion_job_pre_hold;
  end if;
  if to_regprocedure('public.claim_room_deletion_object_batch_pre_hold(uuid,integer)') is null then
    alter function public.claim_room_deletion_object_batch(uuid, integer)
      rename to claim_room_deletion_object_batch_pre_hold;
  end if;
  if to_regprocedure('public.finalize_room_deletion_job_pre_hold(uuid,uuid)') is null then
    alter function public.finalize_room_deletion_job(uuid, uuid)
      rename to finalize_room_deletion_job_pre_hold;
  end if;
end
$$;

revoke all on function public.begin_room_deletion_job_pre_hold(uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.claim_room_deletion_object_batch_pre_hold(uuid, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.finalize_room_deletion_job_pre_hold(uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function public.begin_room_deletion_job(
  target_room_id uuid,
  acting_owner_id uuid,
  billing_preflight jsonb
)
returns table (job_id uuid, job_status text, created boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.assert_room_deletion_not_held(target_room_id);
  return query
  select *
  from public.begin_room_deletion_job_pre_hold(
    target_room_id,
    acting_owner_id,
    billing_preflight
  );
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
set search_path = public, pg_temp
as $$
declare
  target_room_id uuid;
begin
  select job_row.room_id
  into target_room_id
  from public.room_deletion_jobs job_row
  where job_row.id = target_job_id;

  if not found then
    raise exception 'Room deletion job not found.' using errcode = 'P0002';
  end if;

  perform public.assert_room_deletion_not_held(target_room_id);

  return query
  select *
  from public.claim_room_deletion_object_batch_pre_hold(
    target_job_id,
    requested_batch_size
  );
end;
$$;

create or replace function public.finalize_room_deletion_job(
  target_job_id uuid,
  acting_owner_id uuid
)
returns public.room_deletion_jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_room_id uuid;
  result_row public.room_deletion_jobs%rowtype;
begin
  select job_row.room_id
  into target_room_id
  from public.room_deletion_jobs job_row
  where job_row.id = target_job_id;

  if not found then
    raise exception 'Room deletion job not found.' using errcode = 'P0002';
  end if;

  perform public.assert_room_deletion_not_held(target_room_id);

  select *
  into result_row
  from public.finalize_room_deletion_job_pre_hold(target_job_id, acting_owner_id);

  return result_row;
end;
$$;

revoke all on function public.begin_room_deletion_job(uuid, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.claim_room_deletion_object_batch(uuid, integer)
  from public, anon, authenticated;
revoke all on function public.finalize_room_deletion_job(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.begin_room_deletion_job(uuid, uuid, jsonb)
  to service_role;
grant execute on function public.claim_room_deletion_object_batch(uuid, integer)
  to service_role;
grant execute on function public.finalize_room_deletion_job(uuid, uuid)
  to service_role;

comment on function public.legal_account_deletion_hold_applies(uuid, text) is
'Exact service-role Legal Operations hold lookup for account-deletion enforcement.';
comment on function public.legal_room_hold_applies(uuid) is
'Exact service-role Legal Operations hold lookup for Room permanent-deletion enforcement.';

-- Migration-time structural checks. Runtime hold behavior is validated separately
-- with fictional records before either destructive feature flag may be enabled.
do $$
declare
  account_wrappers integer;
  room_wrappers integer;
begin
  if to_regprocedure('public.legal_account_deletion_hold_applies(uuid,text)') is null
    or to_regprocedure('public.assert_account_deletion_not_held(uuid,text)') is null
    or to_regprocedure('public.legal_room_hold_applies(uuid)') is null
    or to_regprocedure('public.assert_room_deletion_not_held(uuid)') is null
  then
    raise exception 'A required Legal Operations hold-enforcement helper is missing.';
  end if;

  if has_function_privilege('anon', 'public.legal_account_deletion_hold_applies(uuid,text)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.legal_account_deletion_hold_applies(uuid,text)', 'EXECUTE')
    or has_function_privilege('anon', 'public.legal_room_hold_applies(uuid)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.legal_room_hold_applies(uuid)', 'EXECUTE')
  then
    raise exception 'Browser execution remains on a Legal Operations hold-enforcement helper.';
  end if;

  select count(*) into account_wrappers
  from pg_proc procedure_row
  join pg_namespace namespace_row on namespace_row.oid = procedure_row.pronamespace
  where namespace_row.nspname = 'public'
    and procedure_row.proname in (
      'delete_account_notification_data',
      'delete_account_private_personalization_data',
      'delete_account_private_activity_data',
      'delete_account_private_goals_data',
      'delete_account_matching_preferences_data',
      'delete_account_floor_cloud_data',
      'delete_account_discussion_audience_preferences_data',
      'delete_account_product_feedback_data',
      'delete_account_commerce_saves_data'
    )
    and pg_get_functiondef(procedure_row.oid) like '%assert_account_deletion_not_held%';

  if account_wrappers <> 9 then
    raise exception 'Not every automatic account-deletion RPC is protected by the Legal Operations hold guard.';
  end if;

  select count(*) into room_wrappers
  from pg_proc procedure_row
  join pg_namespace namespace_row on namespace_row.oid = procedure_row.pronamespace
  where namespace_row.nspname = 'public'
    and procedure_row.proname in (
      'begin_room_deletion_job',
      'claim_room_deletion_object_batch',
      'finalize_room_deletion_job'
    )
    and pg_get_functiondef(procedure_row.oid) like '%assert_room_deletion_not_held%';

  if room_wrappers <> 3 then
    raise exception 'A Room permanent-deletion database boundary is missing the Legal Operations hold guard.';
  end if;
end
$$;

commit;
