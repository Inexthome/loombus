-- Read-only readiness checks for Issue #674 destructive-path legal-hold enforcement.
-- Run after 20260808104000_enforce_legal_holds_on_destructive_paths.sql.
-- Every returned row must have status = PASS.

with
account_wrapper_names(name) as (
  values
    ('delete_account_notification_data'),
    ('delete_account_private_personalization_data'),
    ('delete_account_private_activity_data'),
    ('delete_account_private_goals_data'),
    ('delete_account_matching_preferences_data'),
    ('delete_account_floor_cloud_data'),
    ('delete_account_discussion_audience_preferences_data'),
    ('delete_account_product_feedback_data'),
    ('delete_account_commerce_saves_data')
),
account_base_names(name) as (
  values
    ('delete_account_notification_data_pre_hold'),
    ('delete_account_private_personalization_data_pre_hold'),
    ('delete_account_private_activity_data_pre_hold'),
    ('delete_account_private_goals_data_pre_hold'),
    ('delete_account_matching_preferences_data_pre_hold'),
    ('delete_account_floor_cloud_data_pre_hold'),
    ('delete_account_discussion_audience_preferences_data_pre_hold'),
    ('delete_account_product_feedback_data_pre_hold'),
    ('delete_account_commerce_saves_data_pre_hold')
),
room_wrapper_names(name) as (
  values
    ('begin_room_deletion_job'),
    ('claim_room_deletion_object_batch'),
    ('finalize_room_deletion_job')
),
room_base_names(name) as (
  values
    ('begin_room_deletion_job_pre_hold'),
    ('claim_room_deletion_object_batch_pre_hold'),
    ('finalize_room_deletion_job_pre_hold')
),
checks as (
  select
    'hold_enforcement_helpers_present'::text as check_name,
    count(*)::bigint as observed,
    4::bigint as expected
  from (values
    ('public.legal_account_deletion_hold_applies(uuid,text)'),
    ('public.assert_account_deletion_not_held(uuid,text)'),
    ('public.legal_room_hold_applies(uuid)'),
    ('public.assert_room_deletion_not_held(uuid)')
  ) required(signature)
  where to_regprocedure(required.signature) is not null

  union all

  select
    'hold_lookup_helpers_service_only',
    (
      case when
        has_function_privilege(
          'service_role',
          'public.legal_account_deletion_hold_applies(uuid,text)',
          'EXECUTE'
        )
        and has_function_privilege(
          'service_role',
          'public.legal_room_hold_applies(uuid)',
          'EXECUTE'
        )
        and not has_function_privilege(
          'authenticated',
          'public.legal_account_deletion_hold_applies(uuid,text)',
          'EXECUTE'
        )
        and not has_function_privilege(
          'anon',
          'public.legal_account_deletion_hold_applies(uuid,text)',
          'EXECUTE'
        )
        and not has_function_privilege(
          'authenticated',
          'public.legal_room_hold_applies(uuid)',
          'EXECUTE'
        )
        and not has_function_privilege(
          'anon',
          'public.legal_room_hold_applies(uuid)',
          'EXECUTE'
        )
      then 1 else 0 end
    )::bigint,
    1::bigint

  union all

  select
    'account_claim_skips_account_wide_holds',
    count(*)::bigint,
    1::bigint
  from pg_proc procedure_row
  join pg_namespace namespace_row on namespace_row.oid = procedure_row.pronamespace
  where namespace_row.nspname = 'public'
    and procedure_row.proname = 'claim_account_deletion_requests'
    and pg_get_function_identity_arguments(procedure_row.oid) = 'p_limit integer'
    and pg_get_functiondef(procedure_row.oid) like '%legal_account_deletion_hold_applies(r.user_id, null)%'

  union all

  select
    'account_destructive_wrappers_guarded',
    count(*)::bigint,
    9::bigint
  from pg_proc procedure_row
  join pg_namespace namespace_row on namespace_row.oid = procedure_row.pronamespace
  where namespace_row.nspname = 'public'
    and procedure_row.proname in (select name from account_wrapper_names)
    and pg_get_functiondef(procedure_row.oid) like '%assert_account_deletion_not_held%'

  union all

  select
    'account_unguarded_bases_not_service_executable',
    count(*)::bigint,
    0::bigint
  from pg_proc procedure_row
  join pg_namespace namespace_row on namespace_row.oid = procedure_row.pronamespace
  where namespace_row.nspname = 'public'
    and procedure_row.proname in (select name from account_base_names)
    and has_function_privilege('service_role', procedure_row.oid, 'EXECUTE')

  union all

  select
    'account_finalization_guarded',
    count(*)::bigint,
    1::bigint
  from pg_proc procedure_row
  join pg_namespace namespace_row on namespace_row.oid = procedure_row.pronamespace
  where namespace_row.nspname = 'public'
    and procedure_row.proname = 'finalize_account_deletion_request'
    and pg_get_functiondef(procedure_row.oid) like '%assert_account_deletion_not_held%'

  union all

  select
    'account_finalization_base_not_service_executable',
    count(*)::bigint,
    0::bigint
  from pg_proc procedure_row
  join pg_namespace namespace_row on namespace_row.oid = procedure_row.pronamespace
  where namespace_row.nspname = 'public'
    and procedure_row.proname = 'finalize_account_deletion_request_pre_hold'
    and has_function_privilege('service_role', procedure_row.oid, 'EXECUTE')

  union all

  select
    'room_destructive_boundaries_guarded',
    count(*)::bigint,
    3::bigint
  from pg_proc procedure_row
  join pg_namespace namespace_row on namespace_row.oid = procedure_row.pronamespace
  where namespace_row.nspname = 'public'
    and procedure_row.proname in (select name from room_wrapper_names)
    and pg_get_functiondef(procedure_row.oid) like '%assert_room_deletion_not_held%'

  union all

  select
    'room_unguarded_bases_not_service_executable',
    count(*)::bigint,
    0::bigint
  from pg_proc procedure_row
  join pg_namespace namespace_row on namespace_row.oid = procedure_row.pronamespace
  where namespace_row.nspname = 'public'
    and procedure_row.proname in (select name from room_base_names)
    and has_function_privilege('service_role', procedure_row.oid, 'EXECUTE')

  union all

  select
    'room_hold_match_requires_exact_target_ref',
    count(*)::bigint,
    1::bigint
  from pg_proc procedure_row
  join pg_namespace namespace_row on namespace_row.oid = procedure_row.pronamespace
  where namespace_row.nspname = 'public'
    and procedure_row.proname = 'legal_room_hold_applies'
    and pg_get_functiondef(procedure_row.oid) like '%target_row.target_ref = p_room_id::text%'

  union all

  select
    'account_hold_match_requires_exact_subject',
    count(*)::bigint,
    1::bigint
  from pg_proc procedure_row
  join pg_namespace namespace_row on namespace_row.oid = procedure_row.pronamespace
  where namespace_row.nspname = 'public'
    and procedure_row.proname = 'legal_account_deletion_hold_applies'
    and pg_get_functiondef(procedure_row.oid) like '%target_row.subject_user_id = p_user_id%'
    and pg_get_functiondef(procedure_row.oid) like '%target_row.target_ref = p_user_id::text%'
)
select
  check_name,
  observed,
  expected,
  case when observed = expected then 'PASS' else 'FAIL' end as status
from checks
order by check_name;
