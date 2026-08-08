-- Read-only readiness checks for Issue #674 Disclosure Preparation Controls.
-- Run only after applying 20260808111500_restrict_legal_disclosure_preparation.sql.
-- Every returned row must have status = PASS before controlled fictional testing.

with
required_functions(signature) as (
  values
    ('public.legal_create_disclosure_draft(uuid,text,text,text,text,text,text,text,uuid)'),
    ('public.legal_update_disclosure_draft(uuid,uuid,text,text,text,text,text,text,text,uuid)'),
    ('public.legal_add_disclosure_manifest_item(uuid,uuid,text,text,text,text[],text,uuid)')
),
checks as (
  select
    'preparation_functions_present'::text as check_name,
    count(*)::bigint as observed,
    3::bigint as expected
  from required_functions required
  where to_regprocedure(required.signature) is not null

  union all

  select
    'preparation_functions_are_security_definer',
    count(*)::bigint,
    3::bigint
  from required_functions required
  join pg_proc function_row
    on function_row.oid = to_regprocedure(required.signature)
  where function_row.prosecdef

  union all

  select
    'service_role_can_execute_preparation_functions',
    count(*)::bigint,
    3::bigint
  from required_functions required
  where has_function_privilege('service_role', required.signature, 'EXECUTE')

  union all

  select
    'client_roles_cannot_execute_preparation_functions',
    count(*)::bigint,
    0::bigint
  from required_functions required
  cross join (values ('anon'), ('authenticated')) roles(role_name)
  where has_function_privilege(roles.role_name, required.signature, 'EXECUTE')

  union all

  select
    'service_role_cannot_directly_mutate_disclosures',
    count(*)::bigint,
    0::bigint
  from information_schema.role_table_grants grant_row
  where grant_row.table_schema = 'public'
    and grant_row.table_name = 'legal_disclosures'
    and grant_row.grantee = 'service_role'
    and grant_row.privilege_type in ('INSERT', 'UPDATE', 'DELETE')

  union all

  select
    'service_role_cannot_directly_mutate_manifest_items',
    count(*)::bigint,
    0::bigint
  from information_schema.role_table_grants grant_row
  where grant_row.table_schema = 'public'
    and grant_row.table_name = 'legal_disclosure_items'
    and grant_row.grantee = 'service_role'
    and grant_row.privilege_type in ('INSERT', 'UPDATE', 'DELETE')

  union all

  select
    'service_role_retains_read_only_disclosure_access',
    count(*)::bigint,
    2::bigint
  from information_schema.role_table_grants grant_row
  where grant_row.table_schema = 'public'
    and grant_row.table_name in ('legal_disclosures', 'legal_disclosure_items')
    and grant_row.grantee = 'service_role'
    and grant_row.privilege_type = 'SELECT'

  union all

  select
    'disclosure_audit_and_manifest_append_only_triggers_enabled',
    count(*)::bigint,
    2::bigint
  from pg_trigger trigger_row
  where trigger_row.tgname in (
      'legal_disclosures_log_change',
      'legal_disclosure_items_append_only'
    )
    and trigger_row.tgenabled <> 'D'
    and not trigger_row.tgisinternal

  union all

  select
    'create_rpc_forces_draft_only_metadata',
    count(*)::bigint,
    1::bigint
  from pg_proc function_row
  join pg_namespace namespace_row on namespace_row.oid = function_row.pronamespace
  where namespace_row.nspname = 'public'
    and function_row.proname = 'legal_create_disclosure_draft'
    and pg_get_functiondef(function_row.oid) like '%''draft''%'
    and pg_get_functiondef(function_row.oid) like '%manifest_sha256%'
    and pg_get_functiondef(function_row.oid) like '%approved_by%'
    and pg_get_functiondef(function_row.oid) like '%transmitted_by%'

  union all

  select
    'update_rpc_blocks_non_draft_state',
    count(*)::bigint,
    1::bigint
  from pg_proc function_row
  join pg_namespace namespace_row on namespace_row.oid = function_row.pronamespace
  where namespace_row.nspname = 'public'
    and function_row.proname = 'legal_update_disclosure_draft'
    and pg_get_functiondef(function_row.oid) like '%status <> ''draft''%'
    and pg_get_functiondef(function_row.oid) not like '%approved_by =%'
    and pg_get_functiondef(function_row.oid) not like '%transmitted_by =%'
    and pg_get_functiondef(function_row.oid) not like '%manifest_sha256 =%'

  union all

  select
    'manifest_rpc_is_metadata_only_and_append_only',
    count(*)::bigint,
    1::bigint
  from pg_proc function_row
  join pg_namespace namespace_row on namespace_row.oid = function_row.pronamespace
  where namespace_row.nspname = 'public'
    and function_row.proname = 'legal_add_disclosure_manifest_item'
    and pg_get_functiondef(function_row.oid) like '%object_count,%'
    and pg_get_functiondef(function_row.oid) like '%file_name,%'
    and pg_get_functiondef(function_row.oid) like '%sha256,%'
    and pg_get_functiondef(function_row.oid) like '%legal_disclosure_manifest_item_added%'
    and pg_get_functiondef(function_row.oid) like '%Manifest field names must be explicit and bounded.%'
)
select
  check_name,
  observed,
  expected,
  case when observed = expected then 'PASS' else 'FAIL' end as status
from checks
order by check_name;
