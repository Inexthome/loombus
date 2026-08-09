-- Issue #674: Legal Data Source Registry readiness.
-- Read-only verification. Every row must return PASS before production UI validation.

with required_sources(source_key) as (
  values
    ('account_identity_profile'),
    ('public_discussions_content'),
    ('private_messaging'),
    ('rooms_and_room_operations'),
    ('storage_objects_and_derivatives'),
    ('commerce_local_appointments'),
    ('billing_payments_entitlements'),
    ('trust_safety_and_support'),
    ('legal_operations_and_audit'),
    ('everything_search_index'),
    ('ai_system_records'),
    ('notification_email_push'),
    ('infrastructure_security_logs'),
    ('backups_replicas_exports_vendor_copies')
),
checks as (
  select
    'legal_data_source_registry_present'::text as check_name,
    count(*)::bigint as observed,
    1::bigint as expected
  from information_schema.tables
  where table_schema = 'public'
    and table_name = 'legal_data_source_registry'

  union all

  select
    'legal_data_source_registry_required_columns_present',
    count(*)::bigint,
    18::bigint
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'legal_data_source_registry'
    and column_name in (
      'source_key',
      'source_group',
      'display_name',
      'source_kind',
      'system_of_record',
      'data_classes',
      'source_locations',
      'locator_contract',
      'account_deletion_resource_keys',
      'external_processors',
      'inventory_status',
      'unresolved_items',
      'evidence_sources',
      'notes',
      'enabled',
      'sort_order',
      'created_at',
      'updated_at'
    )

  union all

  select
    'legal_data_source_registry_rls_enabled',
    count(*)::bigint,
    1::bigint
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'legal_data_source_registry'
    and c.relrowsecurity = true

  union all

  select
    'ordinary_browser_registry_privileges_absent',
    count(*)::bigint,
    0::bigint
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name = 'legal_data_source_registry'
    and grantee in ('PUBLIC', 'anon', 'authenticated')
    and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')

  union all

  select
    'browser_registry_policies_absent',
    count(*)::bigint,
    0::bigint
  from pg_policies
  where schemaname = 'public'
    and tablename = 'legal_data_source_registry'

  union all

  select
    'service_role_registry_select_present',
    count(*)::bigint,
    1::bigint
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name = 'legal_data_source_registry'
    and grantee = 'service_role'
    and privilege_type = 'SELECT'

  union all

  select
    'service_role_registry_mutations_absent',
    count(*)::bigint,
    0::bigint
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name = 'legal_data_source_registry'
    and grantee = 'service_role'
    and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')

  union all

  select
    'required_legal_source_families_present',
    count(*)::bigint,
    14::bigint
  from required_sources required
  join public.legal_data_source_registry registry
    on registry.source_key = required.source_key
   and registry.enabled = true

  union all

  select
    'registry_rows_have_minimum_metadata',
    count(*)::bigint,
    0::bigint
  from public.legal_data_source_registry
  where enabled = true
    and (
      cardinality(data_classes) < 1
      or cardinality(source_locations) < 1
      or cardinality(evidence_sources) < 1
      or char_length(trim(locator_contract)) < 5
      or char_length(trim(system_of_record)) < 2
    )

  union all

  select
    'partial_and_unresolved_rows_record_gaps',
    count(*)::bigint,
    0::bigint
  from public.legal_data_source_registry
  where enabled = true
    and inventory_status in ('partial', 'unresolved')
    and cardinality(unresolved_items) = 0

  union all

  select
    'search_telemetry_gaps_remain_explicit',
    count(*)::bigint,
    1::bigint
  from public.legal_data_source_registry
  where source_key = 'everything_search_index'
    and enabled = true
    and inventory_status in ('partial', 'unresolved')
    and array_to_string(unresolved_items, ' ') ilike '%query-log%'
    and array_to_string(unresolved_items, ' ') ilike '%click-log%'

  union all

  select
    'ai_provider_lineage_is_explicit',
    count(*)::bigint,
    1::bigint
  from public.legal_data_source_registry
  where source_key = 'ai_system_records'
    and enabled = true
    and 'OpenAI' = any(external_processors)
    and exists (
      select 1
      from unnest(external_processors) processor
      where processor ilike 'Anthropic%'
    )
    and coalesce(notes, '') ilike '%historical%'

  union all

  select
    'registry_contains_no_request_specific_uuid_values',
    count(*)::bigint,
    0::bigint
  from public.legal_data_source_registry
  where concat_ws(
    ' ',
    source_key,
    source_group,
    display_name,
    system_of_record,
    array_to_string(data_classes, ' '),
    array_to_string(source_locations, ' '),
    locator_contract,
    array_to_string(account_deletion_resource_keys, ' '),
    array_to_string(external_processors, ' '),
    array_to_string(unresolved_items, ' '),
    array_to_string(evidence_sources, ' '),
    coalesce(notes, '')
  ) ~* '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}'

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
