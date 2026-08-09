-- Issue #674: aggregate transparency reporting foundation readiness.
-- Read-only verification. Every row must PASS before controlled production UI validation.

with required_columns(column_name) as (
  values
    ('control_key'),
    ('control_kind'),
    ('display_name'),
    ('source_fields'),
    ('aggregation_contract'),
    ('null_handling'),
    ('publication_approval_status'),
    ('aggregation_execution_enabled'),
    ('publication_enabled'),
    ('request_specific_data_allowed'),
    ('counsel_review_required'),
    ('suppression_rule_required'),
    ('unresolved_items'),
    ('evidence_sources'),
    ('notes'),
    ('enabled'),
    ('sort_order'),
    ('created_at'),
    ('updated_at')
),
required_controls(control_key) as (
  values
    ('reporting_period_dimension'),
    ('request_type_dimension'),
    ('jurisdiction_group_dimension'),
    ('outcome_dimension'),
    ('reportability_dimension'),
    ('classification_review_status_dimension'),
    ('unique_request_count_rule'),
    ('request_disclosure_separation_rule'),
    ('unreviewed_exclusion_control'),
    ('request_specific_data_exclusion_control'),
    ('small_cell_suppression_control'),
    ('public_release_gate')
),
checks as (
  select
    'transparency_reporting_review_capability_present'::text as check_name,
    count(*)::bigint as observed,
    1::bigint as expected
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'legal_operations_authorizations'
    and column_name = 'can_review_transparency_reporting'

  union all

  select
    'transparency_reporting_review_capability_not_auto_enabled',
    count(*)::bigint,
    0::bigint
  from public.legal_operations_authorizations
  where active = true
    and revoked_at is null
    and can_review_transparency_reporting = true

  union all

  select
    'transparency_review_status_column_present',
    count(*)::bigint,
    1::bigint
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'legal_requests'
    and column_name = 'transparency_review_status'

  union all

  select
    'transparency_review_status_defaults_unreviewed',
    count(*)::bigint,
    1::bigint
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'legal_requests'
    and column_name = 'transparency_review_status'
    and column_default like '%unreviewed%'

  union all

  select
    'new_request_transparency_reportable_default_is_false',
    count(*)::bigint,
    1::bigint
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'legal_requests'
    and column_name = 'transparency_reportable'
    and lower(coalesce(column_default, '')) = 'false'

  union all

  select
    'existing_requests_not_auto_transparency_reviewed',
    count(*)::bigint,
    0::bigint
  from public.legal_requests
  where transparency_review_status <> 'unreviewed'

  union all

  select
    'request_review_trigger_protects_transparency_classification',
    count(*)::bigint,
    1::bigint
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'legal_enforce_request_review_authorization'
    and p.prosecdef = true
    and pg_get_functiondef(p.oid) ilike '%transparency_reportable%'
    and pg_get_functiondef(p.oid) ilike '%transparency_jurisdiction_group%'
    and pg_get_functiondef(p.oid) ilike '%transparency_outcome%'
    and pg_get_functiondef(p.oid) ilike '%transparency_review_status%'
    and pg_get_functiondef(p.oid) ilike '%can_review_requests%'

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
    'transparency_reporting_registry_present',
    count(*)::bigint,
    1::bigint
  from information_schema.tables
  where table_schema = 'public'
    and table_name = 'legal_transparency_reporting_registry'

  union all

  select
    'transparency_reporting_required_columns_present',
    count(*)::bigint,
    19::bigint
  from information_schema.columns c
  join required_columns r on r.column_name = c.column_name
  where c.table_schema = 'public'
    and c.table_name = 'legal_transparency_reporting_registry'

  union all

  select
    'transparency_reporting_registry_rls_enabled',
    count(*)::bigint,
    1::bigint
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'legal_transparency_reporting_registry'
    and c.relrowsecurity = true

  union all

  select
    'browser_transparency_reporting_privileges_absent',
    count(*)::bigint,
    0::bigint
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name = 'legal_transparency_reporting_registry'
    and grantee in ('anon', 'authenticated')
    and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')

  union all

  select
    'browser_transparency_reporting_policies_absent',
    count(*)::bigint,
    0::bigint
  from pg_policies
  where schemaname = 'public'
    and tablename = 'legal_transparency_reporting_registry'

  union all

  select
    'service_role_transparency_reporting_select_present',
    count(*)::bigint,
    1::bigint
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name = 'legal_transparency_reporting_registry'
    and grantee = 'service_role'
    and privilege_type = 'SELECT'

  union all

  select
    'service_role_transparency_reporting_mutations_absent',
    count(*)::bigint,
    0::bigint
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name = 'legal_transparency_reporting_registry'
    and grantee = 'service_role'
    and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')

  union all

  select
    'required_transparency_reporting_controls_present',
    count(*)::bigint,
    12::bigint
  from public.legal_transparency_reporting_registry r
  join required_controls c using (control_key)
  where r.enabled = true

  union all

  select
    'publication_methodology_remains_unapproved',
    count(*)::bigint,
    12::bigint
  from public.legal_transparency_reporting_registry
  where enabled = true
    and publication_approval_status = 'unapproved'

  union all

  select
    'aggregation_execution_remains_disabled',
    count(*)::bigint,
    0::bigint
  from public.legal_transparency_reporting_registry
  where enabled = true
    and aggregation_execution_enabled = true

  union all

  select
    'external_publication_remains_disabled',
    count(*)::bigint,
    0::bigint
  from public.legal_transparency_reporting_registry
  where enabled = true
    and publication_enabled = true

  union all

  select
    'request_specific_data_remains_disallowed',
    count(*)::bigint,
    0::bigint
  from public.legal_transparency_reporting_registry
  where enabled = true
    and request_specific_data_allowed = true

  union all

  select
    'qualified_counsel_review_required_for_all_controls',
    count(*)::bigint,
    12::bigint
  from public.legal_transparency_reporting_registry
  where enabled = true
    and counsel_review_required = true

  union all

  select
    'small_cell_suppression_gate_present',
    count(*)::bigint,
    1::bigint
  from public.legal_transparency_reporting_registry
  where enabled = true
    and control_key = 'small_cell_suppression_control'
    and suppression_rule_required = true
    and publication_enabled = false
    and publication_approval_status = 'unapproved'

  union all

  select
    'public_release_gate_present_and_closed',
    count(*)::bigint,
    1::bigint
  from public.legal_transparency_reporting_registry
  where enabled = true
    and control_key = 'public_release_gate'
    and publication_enabled = false
    and aggregation_execution_enabled = false
    and counsel_review_required = true

  union all

  select
    'transparency_reporting_write_rpcs_absent',
    count(*)::bigint,
    0::bigint
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'legal_generate_transparency_snapshot',
      'legal_publish_transparency_report',
      'legal_export_transparency_report',
      'legal_transparency_aggregate',
      'legal_finalize_transparency_report'
    )

  union all

  select
    'transparency_snapshot_tables_absent',
    count(*)::bigint,
    0::bigint
  from information_schema.tables
  where table_schema = 'public'
    and table_name in (
      'legal_transparency_report_snapshots',
      'legal_transparency_report_cells',
      'legal_transparency_publications'
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
