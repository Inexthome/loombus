-- Issue #674: authoritative legal-request review trigger coverage readiness.
-- Read-only verification. Every row must PASS before production rollout.

with function_state as (
  select
    p.oid,
    p.prosecdef,
    pg_get_functiondef(p.oid) as definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'legal_enforce_request_review_authorization'
),
checks as (
  select
    'review_authorization_function_present'::text as check_name,
    count(*)::bigint as observed,
    1::bigint as expected
  from function_state

  union all

  select
    'review_authorization_function_security_definer',
    count(*)::bigint,
    1::bigint
  from function_state
  where prosecdef = true

  union all

  select
    'review_trigger_requires_can_review_requests',
    count(*)::bigint,
    1::bigint
  from function_state
  where definition ilike '%can_review_requests%'

  union all

  select
    'protected_party_fields_restored_to_review_trigger',
    count(*)::bigint,
    1::bigint
  from function_state
  where definition ilike '%privilege_review_status%'
    and definition ilike '%privilege_review_summary%'
    and definition ilike '%reporter_protection_status%'
    and definition ilike '%reporter_protection_summary%'
    and definition ilike '%victim_protection_status%'
    and definition ilike '%victim_protection_summary%'
    and definition ilike '%unrelated_member_minimization_status%'
    and definition ilike '%unrelated_member_minimization_summary%'

  union all

  select
    'notice_confidentiality_fields_remain_review_protected',
    count(*)::bigint,
    1::bigint
  from function_state
  where definition ilike '%confidentiality_notes%'
    and definition ilike '%member_notice_decision%'
    and definition ilike '%delayed_notice_basis%'

  union all

  select
    'transparency_fields_remain_review_protected',
    count(*)::bigint,
    1::bigint
  from function_state
  where definition ilike '%transparency_reportable%'
    and definition ilike '%transparency_jurisdiction_group%'
    and definition ilike '%transparency_outcome%'
    and definition ilike '%transparency_review_status%'

  union all

  select
    'request_review_trigger_present_and_enabled',
    count(*)::bigint,
    1::bigint
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'legal_requests'
    and t.tgname = 'legal_requests_enforce_review_authorization'
    and not t.tgisinternal
    and t.tgenabled <> 'D'

  union all

  select
    'browser_execute_privileges_absent',
    count(*)::bigint,
    0::bigint
  from information_schema.routine_privileges
  where specific_schema = 'public'
    and routine_name = 'legal_enforce_request_review_authorization'
    and grantee in ('PUBLIC', 'anon', 'authenticated')
    and privilege_type = 'EXECUTE'

  union all

  select
    'export_authority_remains_disabled',
    count(*)::bigint,
    0::bigint
  from public.legal_operations_authorizations
  where active = true
    and revoked_at is null
    and can_export = true

  union all

  select
    'disclosure_authority_remains_disabled',
    count(*)::bigint,
    0::bigint
  from public.legal_operations_authorizations
  where active = true
    and revoked_at is null
    and can_disclose = true

  union all

  select
    'emergency_approval_authority_remains_disabled',
    count(*)::bigint,
    0::bigint
  from public.legal_operations_authorizations
  where active = true
    and revoked_at is null
    and can_approve_emergency = true
)
select
  check_name,
  observed,
  expected,
  case when observed = expected then 'PASS' else 'FAIL' end as status
from checks
order by check_name;
