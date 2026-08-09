-- Issue #674: legal request review capability readiness.
-- Read-only verification. Every row must return PASS before review authorization is enabled.

with function_definition as (
  select lower(pg_get_functiondef(p.oid)) as definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'legal_enforce_request_review_authorization'
  limit 1
),
checks as (
  select
    'dedicated_review_capability_present'::text as check_name,
    count(*)::bigint as observed,
    1::bigint as expected
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'legal_operations_authorizations'
    and column_name = 'can_review_requests'
    and is_nullable = 'NO'
    and lower(coalesce(column_default, '')) in ('false', 'false::boolean')

  union all

  select
    'review_capability_not_auto_enabled',
    count(*)::bigint,
    0::bigint
  from public.legal_operations_authorizations
  where can_review_requests = true

  union all

  select
    'review_enforcement_function_is_security_definer',
    count(*)::bigint,
    1::bigint
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'legal_enforce_request_review_authorization'
    and p.prosecdef = true

  union all

  select
    'review_enforcement_trigger_present_and_enabled',
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
    'review_trigger_checks_capability_and_sensitive_review_fields',
    count(*)::bigint,
    1::bigint
  from function_definition
  where definition like '%can_review_requests%'
    and definition like '%authority_review_status%'
    and definition like '%scope_review_status%'
    and definition like '%deficiency_reason%'
    and definition like '%rejection_reason%'
    and definition like '%cross_border_status%'
    and definition like '%confidentiality_notes%'
    and definition like '%member_notice_decision%'
    and definition like '%transparency_outcome%'

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
