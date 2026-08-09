-- Issue #674: emergency review decision-control foundation readiness.
-- Read-only verification. Every row must PASS before controlled production testing.

with emergency_function_state as (
  select
    p.oid,
    p.prosecdef,
    pg_get_functiondef(p.oid) as definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'legal_enforce_emergency_review_authorization'
),
shared_function_state as (
  select pg_get_functiondef(p.oid) as definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'legal_enforce_request_review_authorization'
),
checks as (
  select
    'emergency_review_capability_present'::text as check_name,
    count(*)::bigint as observed,
    1::bigint as expected
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'legal_operations_authorizations'
    and column_name = 'can_review_emergency'

  union all

  select
    'emergency_review_capability_not_auto_enabled',
    count(*)::bigint,
    0::bigint
  from public.legal_operations_authorizations
  where active = true
    and revoked_at is null
    and can_review_emergency = true

  union all

  select
    'emergency_review_status_present',
    count(*)::bigint,
    1::bigint
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'legal_requests'
    and column_name = 'emergency_review_status'

  union all

  select
    'emergency_review_status_defaults_unreviewed',
    count(*)::bigint,
    1::bigint
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'legal_requests'
    and column_name = 'emergency_review_status'
    and column_default ilike '%unreviewed%'

  union all

  select
    'emergency_review_revision_present',
    count(*)::bigint,
    1::bigint
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'legal_requests'
    and column_name = 'emergency_review_revision'

  union all

  select
    'emergency_review_revision_defaults_zero',
    count(*)::bigint,
    1::bigint
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'legal_requests'
    and column_name = 'emergency_review_revision'
    and replace(coalesce(column_default, ''), '::bigint', '') = '0'

  union all

  select
    'existing_requests_not_auto_emergency_reviewed',
    count(*)::bigint,
    0::bigint
  from public.legal_requests
  where emergency_review_status <> 'unreviewed'
    or emergency_review_revision <> 0

  union all

  select
    'emergency_review_status_has_no_approved_state',
    count(*)::bigint,
    1::bigint
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'legal_requests'
    and c.conname = 'legal_requests_emergency_review_status_check'
    and pg_get_constraintdef(c.oid) ilike '%unreviewed%'
    and pg_get_constraintdef(c.oid) ilike '%draft%'
    and pg_get_constraintdef(c.oid) ilike '%requires_counsel%'
    and pg_get_constraintdef(c.oid) not ilike '%approved%'
    and pg_get_constraintdef(c.oid) not ilike '%final%'

  union all

  select
    'emergency_review_function_security_definer',
    count(*)::bigint,
    1::bigint
  from emergency_function_state
  where prosecdef = true

  union all

  select
    'emergency_fields_require_dedicated_capability',
    count(*)::bigint,
    1::bigint
  from emergency_function_state
  where definition ilike '%emergency_criteria_summary%'
    and definition ilike '%emergency_review_status%'
    and definition ilike '%emergency_review_revision%'
    and definition ilike '%can_review_emergency%'
    and definition ilike '%can_review_requests%'

  union all

  select
    'emergency_fields_require_revision_control',
    count(*)::bigint,
    1::bigint
  from emergency_function_state
  where definition ilike '%emergency_review_revision%'
    and definition ilike '%dedicated revision-controlled workflow%'

  union all

  select
    'emergency_review_trigger_present_and_enabled',
    count(*)::bigint,
    1::bigint
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'legal_requests'
    and t.tgname = 'legal_requests_enforce_emergency_review_authorization'
    and not t.tgisinternal
    and t.tgenabled <> 'D'

  union all

  select
    'browser_emergency_review_function_execute_privileges_absent',
    count(*)::bigint,
    0::bigint
  from information_schema.routine_privileges
  where specific_schema = 'public'
    and routine_name = 'legal_enforce_emergency_review_authorization'
    and grantee in ('PUBLIC', 'anon', 'authenticated')
    and privilege_type = 'EXECUTE'

  union all

  select
    'shared_review_trigger_still_covers_emergency_summary',
    count(*)::bigint,
    1::bigint
  from shared_function_state
  where definition ilike '%emergency_criteria_summary%'
    and definition ilike '%can_review_requests%'

  union all

  select
    'protected_party_fields_remain_review_protected',
    count(*)::bigint,
    1::bigint
  from shared_function_state
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
    'transparency_fields_remain_review_protected',
    count(*)::bigint,
    1::bigint
  from shared_function_state
  where definition ilike '%transparency_reportable%'
    and definition ilike '%transparency_jurisdiction_group%'
    and definition ilike '%transparency_outcome%'
    and definition ilike '%transparency_review_status%'

  union all

  select
    'notice_confidentiality_fields_remain_dedicated',
    count(*)::bigint,
    1::bigint
  from shared_function_state
  where definition ilike '%confidentiality_notes%'
    and definition ilike '%member_notice_decision%'
    and definition ilike '%delayed_notice_basis%'
    and definition ilike '%notice_confidentiality_review_status%'
    and definition ilike '%notice_confidentiality_revision%'
    and definition ilike '%can_review_notice_confidentiality%'

  union all

  select
    'shared_request_review_trigger_present_and_enabled',
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
    'emergency_approval_and_transmission_rpcs_absent',
    count(*)::bigint,
    0::bigint
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'legal_approve_emergency_disclosure',
      'legal_finalize_emergency_review',
      'legal_transmit_emergency_disclosure',
      'legal_send_emergency_disclosure',
      'legal_contact_emergency_recipient'
    )

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
