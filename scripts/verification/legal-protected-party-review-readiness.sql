-- Issue #674: protected-party review controls readiness.
-- Read-only verification. Every row must return PASS before controlled production testing.

with review_function as (
  select
    lower(pg_get_functiondef(p.oid)) as definition,
    p.prosecdef
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'legal_enforce_request_review_authorization'
  limit 1
),
audit_function as (
  select lower(pg_get_functiondef(p.oid)) as definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'log_legal_request_change'
  limit 1
),
checks as (
  select
    'protected_party_status_columns_present'::text as check_name,
    count(*)::bigint as observed,
    4::bigint as expected
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'legal_requests'
    and column_name in (
      'privilege_review_status',
      'reporter_protection_status',
      'victim_protection_status',
      'unrelated_member_minimization_status'
    )
    and is_nullable = 'NO'
    and lower(coalesce(column_default, '')) like '%unreviewed%'

  union all

  select
    'protected_party_summary_columns_present',
    count(*)::bigint,
    4::bigint
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'legal_requests'
    and column_name in (
      'privilege_review_summary',
      'reporter_protection_summary',
      'victim_protection_summary',
      'unrelated_member_minimization_summary'
    )
    and is_nullable = 'YES'

  union all

  select
    'protected_party_status_constraints_present',
    count(*)::bigint,
    4::bigint
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'legal_requests'
    and c.conname in (
      'legal_requests_privilege_review_status_check',
      'legal_requests_reporter_protection_status_check',
      'legal_requests_victim_protection_status_check',
      'legal_requests_unrelated_member_minimization_status_check'
    )

  union all

  select
    'protected_party_summary_length_constraints_present',
    count(*)::bigint,
    4::bigint
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'legal_requests'
    and c.conname in (
      'legal_requests_privilege_review_summary_length_check',
      'legal_requests_reporter_protection_summary_length_check',
      'legal_requests_victim_protection_summary_length_check',
      'legal_requests_unrelated_member_minimization_summary_length_check'
    )

  union all

  select
    'protected_party_fields_require_review_capability',
    count(*)::bigint,
    1::bigint
  from review_function
  where prosecdef = true
    and definition like '%can_review_requests%'
    and definition like '%privilege_review_status%'
    and definition like '%privilege_review_summary%'
    and definition like '%reporter_protection_status%'
    and definition like '%reporter_protection_summary%'
    and definition like '%victim_protection_status%'
    and definition like '%victim_protection_summary%'
    and definition like '%unrelated_member_minimization_status%'
    and definition like '%unrelated_member_minimization_summary%'

  union all

  select
    'protected_party_statuses_recorded_in_request_history',
    count(*)::bigint,
    1::bigint
  from audit_function
  where definition like '%previous_privilege_review_status%'
    and definition like '%privilege_review_status%'
    and definition like '%previous_reporter_protection_status%'
    and definition like '%reporter_protection_status%'
    and definition like '%previous_victim_protection_status%'
    and definition like '%victim_protection_status%'
    and definition like '%previous_unrelated_member_minimization_status%'
    and definition like '%unrelated_member_minimization_status%'

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
