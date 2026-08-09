-- Issue #674: chain-of-custody and export-integrity foundation readiness.
-- Read-only verification. Every row must return PASS before controlled production UI validation.

with required_tables(table_name) as (
  values
    ('legal_export_packages'),
    ('legal_export_artifacts'),
    ('legal_export_verifications'),
    ('legal_chain_of_custody_events')
),
checks as (
  select
    'export_integrity_review_capability_present'::text as check_name,
    count(*)::bigint as observed,
    1::bigint as expected
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'legal_operations_authorizations'
    and column_name = 'can_review_export_integrity'

  union all

  select
    'export_integrity_review_capability_not_auto_enabled',
    count(*)::bigint,
    0::bigint
  from public.legal_operations_authorizations
  where active = true
    and revoked_at is null
    and can_review_export_integrity = true

  union all

  select
    'export_integrity_tables_present',
    count(*)::bigint,
    4::bigint
  from information_schema.tables t
  join required_tables r on r.table_name = t.table_name
  where t.table_schema = 'public'

  union all

  select
    'export_integrity_tables_rls_enabled',
    count(*)::bigint,
    4::bigint
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join required_tables r on r.table_name = c.relname
  where n.nspname = 'public'
    and c.relrowsecurity = true

  union all

  select
    'browser_export_integrity_privileges_absent',
    count(*)::bigint,
    0::bigint
  from information_schema.role_table_grants g
  join required_tables r on r.table_name = g.table_name
  where g.table_schema = 'public'
    and g.grantee in ('anon', 'authenticated')
    and g.privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')

  union all

  select
    'browser_export_integrity_policies_absent',
    count(*)::bigint,
    0::bigint
  from pg_policies p
  join required_tables r on r.table_name = p.tablename
  where p.schemaname = 'public'

  union all

  select
    'service_role_export_integrity_select_present',
    count(*)::bigint,
    4::bigint
  from information_schema.role_table_grants g
  join required_tables r on r.table_name = g.table_name
  where g.table_schema = 'public'
    and g.grantee = 'service_role'
    and g.privilege_type = 'SELECT'

  union all

  select
    'service_role_export_integrity_mutations_absent',
    count(*)::bigint,
    0::bigint
  from information_schema.role_table_grants g
  join required_tables r on r.table_name = g.table_name
  where g.table_schema = 'public'
    and g.grantee = 'service_role'
    and g.privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')

  union all

  select
    'append_only_evidence_triggers_present',
    count(*)::bigint,
    3::bigint
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and not t.tgisinternal
    and t.tgenabled <> 'D'
    and t.tgname in (
      'legal_export_artifacts_append_only',
      'legal_export_verifications_append_only',
      'legal_chain_of_custody_events_append_only'
    )

  union all

  select
    'package_lifecycle_constraints_present',
    count(*)::bigint,
    4::bigint
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'legal_export_packages'
    and c.conname in (
      'legal_export_packages_generated_state_check',
      'legal_export_packages_verified_state_check',
      'legal_export_packages_sealed_state_check',
      'legal_export_packages_voided_state_check'
    )

  union all

  select
    'package_hash_constraints_present',
    count(*)::bigint,
    2::bigint
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'legal_export_packages'
    and c.conname in (
      'legal_export_packages_manifest_hash_check',
      'legal_export_packages_package_hash_check'
    )

  union all

  select
    'artifact_and_verification_digest_constraints_present',
    count(*)::bigint,
    3::bigint
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and c.conname in (
      'legal_export_artifacts_hash_check',
      'legal_export_verifications_expected_digest_check',
      'legal_export_verifications_observed_digest_check'
    )

  union all

  select
    'external_custody_counterparty_constraint_present',
    count(*)::bigint,
    1::bigint
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'legal_chain_of_custody_events'
    and c.conname = 'legal_chain_of_custody_events_external_counterparty_check'

  union all

  select
    'export_write_rpcs_absent',
    count(*)::bigint,
    0::bigint
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'legal_create_export_package',
      'legal_add_export_artifact',
      'legal_record_export_verification',
      'legal_record_custody_event',
      'legal_finalize_export_package'
    )

  union all

  select 'export_packages_not_seeded', count(*)::bigint, 0::bigint
  from public.legal_export_packages

  union all

  select 'export_artifacts_not_seeded', count(*)::bigint, 0::bigint
  from public.legal_export_artifacts

  union all

  select 'export_verifications_not_seeded', count(*)::bigint, 0::bigint
  from public.legal_export_verifications

  union all

  select 'custody_events_not_seeded', count(*)::bigint, 0::bigint
  from public.legal_chain_of_custody_events

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
