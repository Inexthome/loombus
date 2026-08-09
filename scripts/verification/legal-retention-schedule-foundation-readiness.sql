-- Issue #674: Legal Operations retention and disposition foundation readiness.
-- Read-only verification. Every row must PASS before controlled production UI validation.

with required_columns(column_name) as (
  values
    ('record_key'),
    ('display_name'),
    ('source_group'),
    ('source_locations'),
    ('lifecycle_trigger'),
    ('normal_retention_rule'),
    ('timing_status'),
    ('timing_value'),
    ('hold_interaction'),
    ('active_hold_rule'),
    ('disposition_method'),
    ('disposition_execution_enabled'),
    ('counsel_review_required'),
    ('canonical_register_reference'),
    ('related_account_deletion_resource_keys'),
    ('accountable_owner'),
    ('review_cadence'),
    ('unresolved_items'),
    ('evidence_sources'),
    ('notes'),
    ('enabled'),
    ('sort_order'),
    ('created_at'),
    ('updated_at')
),
checks as (
  select
    'legal_retention_review_capability_present'::text as check_name,
    count(*)::bigint as observed,
    1::bigint as expected
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'legal_operations_authorizations'
    and column_name = 'can_review_legal_retention'

  union all

  select
    'legal_retention_review_capability_not_auto_enabled',
    count(*)::bigint,
    0::bigint
  from public.legal_operations_authorizations
  where active = true
    and revoked_at is null
    and can_review_legal_retention = true

  union all

  select
    'legal_retention_schedule_registry_present',
    count(*)::bigint,
    1::bigint
  from information_schema.tables
  where table_schema = 'public'
    and table_name = 'legal_retention_schedule_registry'

  union all

  select
    'legal_retention_schedule_required_columns_present',
    count(*)::bigint,
    24::bigint
  from information_schema.columns c
  join required_columns r on r.column_name = c.column_name
  where c.table_schema = 'public'
    and c.table_name = 'legal_retention_schedule_registry'

  union all

  select
    'legal_retention_schedule_rls_enabled',
    count(*)::bigint,
    1::bigint
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'legal_retention_schedule_registry'
    and c.relrowsecurity = true

  union all

  select
    'browser_legal_retention_privileges_absent',
    count(*)::bigint,
    0::bigint
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name = 'legal_retention_schedule_registry'
    and grantee in ('anon', 'authenticated')
    and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')

  union all

  select
    'browser_legal_retention_policies_absent',
    count(*)::bigint,
    0::bigint
  from pg_policies
  where schemaname = 'public'
    and tablename = 'legal_retention_schedule_registry'

  union all

  select
    'service_role_legal_retention_select_present',
    count(*)::bigint,
    1::bigint
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name = 'legal_retention_schedule_registry'
    and grantee = 'service_role'
    and privilege_type = 'SELECT'

  union all

  select
    'service_role_legal_retention_mutations_absent',
    count(*)::bigint,
    0::bigint
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name = 'legal_retention_schedule_registry'
    and grantee = 'service_role'
    and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')

  union all

  select
    'required_legal_retention_record_classes_present',
    count(*)::bigint,
    12::bigint
  from public.legal_retention_schedule_registry
  where enabled = true
    and record_key in (
      'legal_request_case_metadata',
      'preservation_hold_controls',
      'disclosure_control_metadata',
      'disclosure_manifest_metadata',
      'legal_request_event_history',
      'legal_operations_authorization_records',
      'legal_operations_global_audit_history',
      'legal_data_map_registry_metadata',
      'export_package_integrity_metadata',
      'export_artifact_integrity_metadata',
      'export_verification_history',
      'chain_of_custody_history'
    )

  union all

  select
    'fixed_retention_timelines_remain_unapproved',
    count(*)::bigint,
    12::bigint
  from public.legal_retention_schedule_registry
  where enabled = true
    and timing_status = 'unapproved'
    and timing_value is null

  union all

  select
    'destructive_retention_execution_remains_disabled',
    count(*)::bigint,
    0::bigint
  from public.legal_retention_schedule_registry
  where enabled = true
    and disposition_execution_enabled = true

  union all

  select
    'qualified_counsel_review_required_for_all_rows',
    count(*)::bigint,
    12::bigint
  from public.legal_retention_schedule_registry
  where enabled = true
    and counsel_review_required = true

  union all

  select
    'canonical_issue_668_register_reference_preserved',
    count(*)::bigint,
    12::bigint
  from public.legal_retention_schedule_registry
  where enabled = true
    and canonical_register_reference = 'public.account_deletion_resource_registry'

  union all

  select
    'related_issue_668_resource_keys_are_valid',
    count(*)::bigint,
    0::bigint
  from public.legal_retention_schedule_registry r
  cross join lateral unnest(r.related_account_deletion_resource_keys) as resource_key
  left join public.account_deletion_resource_registry a
    on a.resource_key = resource_key
  where r.enabled = true
    and a.resource_key is null

  union all

  select
    'retention_rows_have_lifecycle_and_hold_rules',
    count(*)::bigint,
    0::bigint
  from public.legal_retention_schedule_registry
  where enabled = true
    and (
      char_length(trim(lifecycle_trigger)) < 5
      or char_length(trim(normal_retention_rule)) < 5
      or char_length(trim(active_hold_rule)) < 5
      or char_length(trim(accountable_owner)) < 2
      or char_length(trim(review_cadence)) < 2
    )

  union all

  select
    'legal_retention_disposition_write_rpcs_absent',
    count(*)::bigint,
    0::bigint
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'legal_execute_retention_disposition',
      'legal_purge_request_records',
      'legal_delete_request_records',
      'legal_anonymize_request_records',
      'legal_archive_request_records'
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
