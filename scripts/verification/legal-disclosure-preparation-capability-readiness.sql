-- Issue #674: verify disclosure preparation authorization is isolated from export/disclosure authority.
-- Run after applying 20260808114000_add_legal_disclosure_preparation_capability.sql and before
-- enabling fictional preparation testing. Every returned row must have status = PASS.

with checks as (
  select
    'dedicated_preparation_capability_present'::text as check_name,
    count(*)::bigint as observed,
    1::bigint as expected
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'legal_operations_authorizations'
    and column_name = 'can_prepare_disclosure'
    and is_nullable = 'NO'
    and column_default = 'false'

  union all

  select
    'preparation_capability_not_auto_enabled',
    count(*) filter (where can_prepare_disclosure)::bigint,
    0::bigint
  from public.legal_operations_authorizations

  union all

  select
    'export_authority_remains_disabled',
    count(*) filter (where can_export)::bigint,
    0::bigint
  from public.legal_operations_authorizations

  union all

  select
    'disclosure_authority_remains_disabled',
    count(*) filter (where can_disclose)::bigint,
    0::bigint
  from public.legal_operations_authorizations

  union all

  select
    'emergency_approval_authority_remains_disabled',
    count(*) filter (where can_approve_emergency)::bigint,
    0::bigint
  from public.legal_operations_authorizations
)
select
  check_name,
  observed,
  expected,
  case when observed = expected then 'PASS' else 'FAIL' end as status
from checks
order by check_name;
