-- Issue #674: member notice and confidentiality decision-control foundation readiness.
-- Read-only verification. Every row must PASS before controlled production testing.

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
    'notice_confidentiality_review_capability_present'::text as check_name,
    count(*)::bigint as observed,
    1::bigint as expected
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'legal_operations_authorizations'
    and column_name = 'can_review_notice_confidentiality'

  union all

  select
    'notice_confidentiality_review_capability_not_auto_enabled',
    count(*)::bigint,
    0::bigint
  from public.legal_operations_authorizations
  where active = true
    and revoked_at is null
    and can_review_notice_confidentiality = true

  union all

  select
    'notice_confidentiality_review_status_present',
    count(*)::bigint,
    1::bigint
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'legal_requests'
    and column_name = 'notice_confidentiality_review_status'

  union all

  select
    'notice_confidentiality_review_status_defaults_unreviewed',
    count(*)::bigint,
    1::bigint
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'legal_requests'
    and column_name = 'notice_confidentiality_review_status'
    and column_default ilike '%unreviewed%'

  union all

  select
    'notice_confidentiality_revision_present',
    count(*)::bigint,
    1::bigint
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'legal_requests'
    and column_name = 'notice_confidentiality_revision'

  union all

  select
    'notice_confidentiality_revision_defaults_zero',
    count(*)::bigint,
    1::bigint
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'legal_requests'
    and column_name = 'notice_confidentiality_revision'
    and replace(coalesce(column_default, ''), '::bigint', '') = '0'

  union all

  select
    'existing_requests_not_auto_notice_reviewed',
    count(*)::bigint,
    0::bigint
  from public.legal_requests
  where notice_confidentiality_review_status <> 'unreviewed'
    or notice_confidentiality_revision <> 0

  union all

  select
    'notice_review_status_has_no_approved_state',
    count(*)::bigint,
    1::bigint
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'legal_requests'
    and c.conname = 'legal_requests_notice_confidentiality_review_status_check'
    and pg_get_constraintdef(c.oid) ilike '%unreviewed%'
    and pg_get_constraintdef(c.oid) ilike '%draft%'
    and pg_get_constraintdef(c.oid) ilike '%requires_counsel%'
    and pg_get_constraintdef(c.oid) not ilike '%approved%'
    and pg_get_constraintdef(c.oid) not ilike '%final%'

  union all

  select
    'review_authorization_function_security_definer',
    count(*)::bigint,
    1::bigint
  from function_state
  where prosecdef = true

  union all

  select
    'notice_fields_require_dedicated_capability',
    count(*)::bigint,
    1::bigint
  from function_state
  where definition ilike '%confidentiality_notes%'
    and definition ilike '%member_notice_decision%'
    and definition ilike '%delayed_notice_basis%'
    and definition ilike '%notice_confidentiality_review_status%'
    and definition ilike '%notice_confidentiality_revision%'
    and definition ilike '%can_review_notice_confidentiality%'
    and definition ilike '%can_review_requests%'

  union all

  select
    'notice_fields_require_revision_control',
    count(*)::bigint,
    1::bigint
  from function_state
  where definition ilike '%notice_confidentiality_revision%'
    and definition ilike '%dedicated revision-controlled workflow%'

  union all

  select
    'protected_party_fields_remain_review_protected',
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
    'browser_review_function_execute_privileges_absent',
    count(*)::bigint,
    0::bigint
  from information_schema.routine_privileges
  where specific_schema = 'public'
    and routine_name = 'legal_enforce_request_review_authorization'
    and grantee in ('PUBLIC', 'anon', 'authenticated')
    and privilege_type = 'EXECUTE'

  union all

  select
    'notice_send_and_finalization_rpcs_absent',
    count(*)::bigint,
    0::bigint
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'legal_send_member_notice',
      'legal_finalize_member_notice',
      'legal_approve_member_notice',
      'legal_release_confidentiality',
      'legal_transmit_member_notice'
    )

  union all

  select
    'notice_delivery_tables_absent',
    count(*)::bigint,
    0::bigint
  from information_schema.tables
  where table_schema = 'public'
    and table_name in (
      'legal_member_notices',
      'legal_notice_deliveries',
      'legal_notice_transmissions'
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
