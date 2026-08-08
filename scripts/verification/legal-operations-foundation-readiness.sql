-- Read-only readiness checks for Issue #674 legal-operations storage.
-- Run after applying 20260808080000_create_legal_operations_foundation.sql and
-- 20260808094500_audit_legal_preservation_target_inserts.sql.
-- Every returned row must have status = PASS.

with
required_tables(name) as (
  values
    ('legal_operations_authorizations'),
    ('legal_requests'),
    ('legal_preservation_holds'),
    ('legal_preservation_hold_targets'),
    ('legal_disclosures'),
    ('legal_disclosure_items'),
    ('legal_request_events')
),
required_functions(signature) as (
  values
    ('public.next_legal_request_number()'),
    ('public.set_legal_operations_updated_at()'),
    ('public.normalize_legal_request_closure()'),
    ('public.log_legal_request_change()'),
    ('public.log_legal_hold_change()'),
    ('public.log_legal_disclosure_change()'),
    ('public.log_legal_preservation_target_insert()'),
    ('public.prevent_legal_operations_append_only_mutation()'),
    ('public.legal_hold_applies(text,text,text,uuid)')
),
required_triggers(name) as (
  values
    ('legal_requests_normalize_closure'),
    ('legal_requests_set_updated_at'),
    ('legal_requests_log_change'),
    ('legal_preservation_holds_set_updated_at'),
    ('legal_preservation_holds_log_change'),
    ('legal_disclosures_set_updated_at'),
    ('legal_disclosures_log_change'),
    ('legal_request_events_append_only'),
    ('legal_hold_targets_append_only'),
    ('legal_hold_targets_log_insert'),
    ('legal_disclosure_items_append_only')
),
legal_tables(name) as (
  values
    ('legal_operations_authorizations'),
    ('legal_requests'),
    ('legal_preservation_holds'),
    ('legal_preservation_hold_targets'),
    ('legal_disclosures'),
    ('legal_disclosure_items'),
    ('legal_request_events')
),
append_only_tables(name) as (
  values
    ('legal_preservation_hold_targets'),
    ('legal_disclosure_items'),
    ('legal_request_events')
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
  where to_regprocedure(required.signature) is not null

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
    'all_legal_tables_have_rls',
    count(*) filter (where class_row.relrowsecurity)::bigint,
    (select count(*) from legal_tables)::bigint
  from pg_class class_row
  join pg_namespace namespace_row on namespace_row.oid = class_row.relnamespace
  where namespace_row.nspname = 'public'
    and class_row.relname in (select name from legal_tables)

  union all

  select
    'client_roles_have_no_legal_table_privileges',
    count(*)::bigint,
    0::bigint
  from information_schema.role_table_grants grants_row
  where grants_row.table_schema = 'public'
    and grants_row.table_name in (select name from legal_tables)
    and grants_row.grantee in ('anon', 'authenticated')

  union all

  select
    'service_role_has_no_delete_privilege',
    count(*)::bigint,
    0::bigint
  from information_schema.role_table_grants grants_row
  where grants_row.table_schema = 'public'
    and grants_row.table_name in (select name from legal_tables)
    and grants_row.grantee = 'service_role'
    and grants_row.privilege_type = 'DELETE'

  union all

  select
    'append_only_tables_have_no_service_update',
    count(*)::bigint,
    0::bigint
  from information_schema.role_table_grants grants_row
  where grants_row.table_schema = 'public'
    and grants_row.table_name in (select name from append_only_tables)
    and grants_row.grantee = 'service_role'
    and grants_row.privilege_type = 'UPDATE'

  union all

  select
    'append_only_triggers_enabled',
    count(*)::bigint,
    3::bigint
  from pg_trigger trigger_row
  where trigger_row.tgname in (
      'legal_request_events_append_only',
      'legal_hold_targets_append_only',
      'legal_disclosure_items_append_only'
    )
    and trigger_row.tgenabled <> 'D'
    and not trigger_row.tgisinternal

  union all

  select
    'preservation_target_insert_trigger_enabled',
    count(*)::bigint,
    1::bigint
  from pg_trigger trigger_row
  where trigger_row.tgname = 'legal_hold_targets_log_insert'
    and trigger_row.tgenabled <> 'D'
    and not trigger_row.tgisinternal

  union all

  select
    'preservation_targets_have_audit_events',
    count(*)::bigint,
    0::bigint
  from public.legal_preservation_hold_targets target_row
  where not exists (
    select 1
    from public.legal_request_events event_row
    where event_row.hold_id = target_row.hold_id
      and event_row.action = 'preservation_target_added'
      and event_row.details ->> 'target_id' = target_row.id::text
  )

  union all

  select
    'legal_hold_lookup_service_only',
    (
      case
        when has_function_privilege(
          'service_role',
          'public.legal_hold_applies(text,text,text,uuid)',
          'EXECUTE'
        )
        and not has_function_privilege(
          'authenticated',
          'public.legal_hold_applies(text,text,text,uuid)',
          'EXECUTE'
        )
        and not has_function_privilege(
          'anon',
          'public.legal_hold_applies(text,text,text,uuid)',
          'EXECUTE'
        )
        then 1 else 0
      end
    )::bigint,
    1::bigint

  union all

  select
    'request_number_default_is_protected_function',
    count(*)::bigint,
    1::bigint
  from information_schema.columns column_row
  where column_row.table_schema = 'public'
    and column_row.table_name = 'legal_requests'
    and column_row.column_name = 'request_number'
    and column_row.column_default like '%next_legal_request_number%'

  union all

  select
    'active_hold_requires_approval_constraint_present',
    count(*)::bigint,
    1::bigint
  from pg_constraint constraint_row
  join pg_class class_row on class_row.oid = constraint_row.conrelid
  join pg_namespace namespace_row on namespace_row.oid = class_row.relnamespace
  where namespace_row.nspname = 'public'
    and class_row.relname = 'legal_preservation_holds'
    and constraint_row.conname = 'legal_preservation_holds_active_approval_check'

  union all

  select
    'transmitted_disclosure_requires_approval_and_transmission_metadata',
    count(*)::bigint,
    2::bigint
  from pg_constraint constraint_row
  join pg_class class_row on class_row.oid = constraint_row.conrelid
  join pg_namespace namespace_row on namespace_row.oid = class_row.relnamespace
  where namespace_row.nspname = 'public'
    and class_row.relname = 'legal_disclosures'
    and constraint_row.conname in (
      'legal_disclosures_approval_state_check',
      'legal_disclosures_transmission_state_check'
    )
)
select
  check_name,
  observed,
  expected,
  case when observed = expected then 'PASS' else 'FAIL' end as status
from checks
order by check_name;
