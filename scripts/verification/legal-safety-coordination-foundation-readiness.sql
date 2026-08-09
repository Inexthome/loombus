-- Issue #674: Internal Safety Coordination Foundation readiness.
-- Read-only verification. Every row must PASS before controlled production testing.

with authorization_function_state as (
  select
    p.oid,
    p.prosecdef,
    pg_get_functiondef(p.oid) as definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'legal_enforce_safety_coordination_authorization'
),
checks as (
  select
    'safety_coordination_capability_present'::text as check_name,
    count(*)::bigint as observed,
    1::bigint as expected
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'legal_operations_authorizations'
    and column_name = 'can_coordinate_safety'

  union all

  select
    'safety_coordination_capability_defaults_false',
    count(*)::bigint,
    1::bigint
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'legal_operations_authorizations'
    and column_name = 'can_coordinate_safety'
    and column_default ilike '%false%'

  union all

  select
    'safety_coordination_capability_not_auto_enabled',
    count(*)::bigint,
    0::bigint
  from public.legal_operations_authorizations
  where active = true
    and revoked_at is null
    and can_coordinate_safety = true

  union all

  select
    'safety_coordination_table_present',
    count(*)::bigint,
    1::bigint
  from information_schema.tables
  where table_schema = 'public'
    and table_name = 'legal_safety_coordination'

  union all

  select
    'safety_coordination_rls_enabled',
    count(*)::bigint,
    1::bigint
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'legal_safety_coordination'
    and c.relrowsecurity = true

  union all

  select
    'browser_table_privileges_absent',
    count(*)::bigint,
    0::bigint
  from information_schema.table_privileges
  where table_schema = 'public'
    and table_name = 'legal_safety_coordination'
    and grantee in ('PUBLIC', 'anon', 'authenticated')

  union all

  select
    'service_role_delete_privilege_absent',
    count(*)::bigint,
    0::bigint
  from information_schema.table_privileges
  where table_schema = 'public'
    and table_name = 'legal_safety_coordination'
    and grantee = 'service_role'
    and privilege_type = 'DELETE'

  union all

  select
    'service_role_required_privileges_present',
    count(distinct privilege_type)::bigint,
    3::bigint
  from information_schema.table_privileges
  where table_schema = 'public'
    and table_name = 'legal_safety_coordination'
    and grantee = 'service_role'
    and privilege_type in ('SELECT', 'INSERT', 'UPDATE')

  union all

  select
    'coordination_status_is_internal_draft_only',
    count(*)::bigint,
    1::bigint
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'legal_safety_coordination'
    and c.conname = 'legal_safety_coordination_status_check'
    and pg_get_constraintdef(c.oid) ilike '%draft%'
    and pg_get_constraintdef(c.oid) ilike '%legal_review_requested%'
    and pg_get_constraintdef(c.oid) ilike '%legal_review_acknowledged%'
    and pg_get_constraintdef(c.oid) ilike '%requires_counsel%'
    and pg_get_constraintdef(c.oid) not ilike '%approved%'
    and pg_get_constraintdef(c.oid) not ilike '%final%'
    and pg_get_constraintdef(c.oid) not ilike '%reported%'
    and pg_get_constraintdef(c.oid) not ilike '%transmitted%'
    and pg_get_constraintdef(c.oid) not ilike '%contacted%'
    and pg_get_constraintdef(c.oid) not ilike '%disclosed%'

  union all

  select
    'coordination_type_constraint_present',
    count(*)::bigint,
    1::bigint
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'legal_safety_coordination'
    and c.conname = 'legal_safety_coordination_type_check'
    and pg_get_constraintdef(c.oid) ilike '%child_safety%'
    and pg_get_constraintdef(c.oid) ilike '%imminent_danger%'
    and pg_get_constraintdef(c.oid) ilike '%high_risk_safety%'

  union all

  select
    'authorization_function_security_definer',
    count(*)::bigint,
    1::bigint
  from authorization_function_state
  where prosecdef = true

  union all

  select
    'coordination_requires_request_review_capability',
    count(*)::bigint,
    1::bigint
  from authorization_function_state
  where definition ilike '%can_review_requests%'

  union all

  select
    'coordination_requires_dedicated_capability',
    count(*)::bigint,
    1::bigint
  from authorization_function_state
  where definition ilike '%can_coordinate_safety%'

  union all

  select
    'imminent_danger_requires_emergency_review_capability',
    count(*)::bigint,
    1::bigint
  from authorization_function_state
  where definition ilike '%imminent_danger%'
    and definition ilike '%can_review_emergency%'

  union all

  select
    'coordination_requires_revision_control',
    count(*)::bigint,
    1::bigint
  from authorization_function_state
  where definition ilike '%revision%'
    and definition ilike '%revision-controlled workflow%'

  union all

  select
    'coordination_case_reference_is_immutable',
    count(*)::bigint,
    1::bigint
  from authorization_function_state
  where definition ilike '%trust_safety_case_id%'
    and definition ilike '%cannot be moved%'

  union all

  select
    'authorization_trigger_present_and_enabled',
    count(*)::bigint,
    1::bigint
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'legal_safety_coordination'
    and t.tgname = 'legal_safety_coordination_enforce_authorization'
    and not t.tgisinternal
    and t.tgenabled <> 'D'

  union all

  select
    'updated_at_trigger_present_and_enabled',
    count(*)::bigint,
    1::bigint
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'legal_safety_coordination'
    and t.tgname = 'legal_safety_coordination_set_updated_at'
    and not t.tgisinternal
    and t.tgenabled <> 'D'

  union all

  select
    'browser_authorization_function_execute_privileges_absent',
    count(*)::bigint,
    0::bigint
  from information_schema.routine_privileges
  where specific_schema = 'public'
    and routine_name = 'legal_enforce_safety_coordination_authorization'
    and grantee in ('PUBLIC', 'anon', 'authenticated')
    and privilege_type = 'EXECUTE'

  union all

  select
    'no_coordination_rows_auto_created',
    count(*)::bigint,
    0::bigint
  from public.legal_safety_coordination

  union all

  select
    'external_action_rpcs_absent',
    count(*)::bigint,
    0::bigint
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname ~* '^legal_safety_.*(report|contact|transmit|disclos|approv|send)'

  union all

  select
    'export_authority_remains_disabled',
    count(*)::bigint,
    0::bigint
  from public.legal_operations_authorizations
  where can_export = true

  union all

  select
    'disclosure_authority_remains_disabled',
    count(*)::bigint,
    0::bigint
  from public.legal_operations_authorizations
  where can_disclose = true

  union all

  select
    'emergency_approval_authority_remains_disabled',
    count(*)::bigint,
    0::bigint
  from public.legal_operations_authorizations
  where can_approve_emergency = true

  union all

  select
    'trust_safety_case_table_preserved',
    count(*)::bigint,
    1::bigint
  from information_schema.tables
  where table_schema = 'public'
    and table_name = 'trust_safety_cases'

  union all

  select
    'legal_request_table_preserved',
    count(*)::bigint,
    1::bigint
  from information_schema.tables
  where table_schema = 'public'
    and table_name = 'legal_requests'
)
select
  check_name,
  observed,
  expected,
  case when observed = expected then 'PASS' else 'FAIL' end as status
from checks
order by check_name;
