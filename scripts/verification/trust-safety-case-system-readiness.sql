-- Read-only production readiness checks for Issue #667 restricted case storage.
-- Run after applying, in order:
--   1. 20260802120000_create_trust_safety_case_system.sql
--   2. 20260802120500_harden_trust_safety_case_invariants.sql
-- Every returned row must have status = PASS.

with
required_tables(name) as (
  values
    ('trust_safety_cases'),
    ('trust_safety_case_evidence_refs'),
    ('trust_safety_case_events')
),
required_functions(name) as (
  values
    ('next_trust_safety_case_number'),
    ('set_trust_safety_case_updated_at'),
    ('log_trust_safety_case_change'),
    ('log_trust_safety_evidence_reference'),
    ('prevent_trust_safety_event_mutation'),
    ('normalize_trust_safety_case_closure'),
    ('validate_trust_safety_case_event_evidence')
),
required_triggers(name) as (
  values
    ('trust_safety_cases_set_updated_at'),
    ('trust_safety_cases_log_change'),
    ('trust_safety_evidence_log_insert'),
    ('trust_safety_events_append_only'),
    ('trust_safety_cases_normalize_closure'),
    ('trust_safety_events_validate_evidence')
),
checks as (
  select
    'required_tables_present'::text as check_name,
    count(*)::bigint as observed,
    (select count(*) from required_tables)::bigint as expected
  from required_tables required
  where to_regclass('public.' || required.name) is not null

  union all

  select
    'required_functions_present',
    count(*)::bigint,
    (select count(*) from required_functions)::bigint
  from required_functions required
  where to_regprocedure('public.' || required.name || '()') is not null

  union all

  select
    'required_triggers_present',
    count(*)::bigint,
    (select count(*) from required_triggers)::bigint
  from required_triggers required
  where exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgname = required.name
      and not trigger_row.tgisinternal
  )

  union all

  select
    'all_case_tables_have_rls',
    count(*) filter (where class_row.relrowsecurity)::bigint,
    3::bigint
  from pg_class class_row
  join pg_namespace namespace_row on namespace_row.oid = class_row.relnamespace
  where namespace_row.nspname = 'public'
    and class_row.relname in (
      'trust_safety_cases',
      'trust_safety_case_evidence_refs',
      'trust_safety_case_events'
    )

  union all

  select
    'authenticated_has_no_case_table_privileges',
    count(*)::bigint,
    0::bigint
  from information_schema.role_table_grants grants_row
  where grants_row.table_schema = 'public'
    and grants_row.table_name in (
      'trust_safety_cases',
      'trust_safety_case_evidence_refs',
      'trust_safety_case_events'
    )
    and grants_row.grantee in ('anon', 'authenticated')

  union all

  select
    'service_role_has_no_delete_privilege',
    count(*)::bigint,
    0::bigint
  from information_schema.role_table_grants grants_row
  where grants_row.table_schema = 'public'
    and grants_row.table_name in (
      'trust_safety_cases',
      'trust_safety_case_evidence_refs',
      'trust_safety_case_events'
    )
    and grants_row.grantee = 'service_role'
    and grants_row.privilege_type = 'DELETE'

  union all

  select
    'case_number_default_is_protected_function',
    count(*)::bigint,
    1::bigint
  from information_schema.columns column_row
  where column_row.table_schema = 'public'
    and column_row.table_name = 'trust_safety_cases'
    and column_row.column_name = 'case_number'
    and column_row.column_default like '%next_trust_safety_case_number%'

  union all

  select
    'event_history_append_only_trigger_enabled',
    count(*)::bigint,
    1::bigint
  from pg_trigger trigger_row
  join pg_class class_row on class_row.oid = trigger_row.tgrelid
  join pg_namespace namespace_row on namespace_row.oid = class_row.relnamespace
  where namespace_row.nspname = 'public'
    and class_row.relname = 'trust_safety_case_events'
    and trigger_row.tgname = 'trust_safety_events_append_only'
    and trigger_row.tgenabled <> 'D'
    and not trigger_row.tgisinternal

  union all

  select
    'same_case_evidence_trigger_enabled',
    count(*)::bigint,
    1::bigint
  from pg_trigger trigger_row
  join pg_class class_row on class_row.oid = trigger_row.tgrelid
  join pg_namespace namespace_row on namespace_row.oid = class_row.relnamespace
  where namespace_row.nspname = 'public'
    and class_row.relname = 'trust_safety_case_events'
    and trigger_row.tgname = 'trust_safety_events_validate_evidence'
    and trigger_row.tgenabled <> 'D'
    and not trigger_row.tgisinternal

  union all

  select
    'closure_normalization_trigger_enabled',
    count(*)::bigint,
    1::bigint
  from pg_trigger trigger_row
  join pg_class class_row on class_row.oid = trigger_row.tgrelid
  join pg_namespace namespace_row on namespace_row.oid = class_row.relnamespace
  where namespace_row.nspname = 'public'
    and class_row.relname = 'trust_safety_cases'
    and trigger_row.tgname = 'trust_safety_cases_normalize_closure'
    and trigger_row.tgenabled <> 'D'
    and not trigger_row.tgisinternal
)
select
  check_name,
  observed,
  expected,
  case when observed = expected then 'PASS' else 'FAIL' end as status
from checks
order by check_name;
