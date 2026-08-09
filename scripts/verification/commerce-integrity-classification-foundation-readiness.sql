-- Issue #670 Phase C classification-ledger foundation readiness.
-- Read-only verification. Every returned row must have status = PASS.
-- Run after 20260809231000_create_commerce_integrity_classification_foundation.sql.

with required_tables(table_name) as (
  values
    ('commerce_integrity_taxonomy_versions'),
    ('commerce_integrity_source_module_registry'),
    ('commerce_integrity_taxonomy_categories'),
    ('commerce_integrity_classifications'),
    ('commerce_integrity_classification_events')
),
write_enabled_sources(source_module) as (
  values
    ('marketplace'),
    ('businesses'),
    ('services'),
    ('requests'),
    ('jobs'),
    ('events'),
    ('appointments')
),
write_disabled_sources(source_module) as (
  values
    ('rooms'),
    ('local'),
    ('messages')
),
checks as (
  select
    'classification_foundation_tables_present'::text as check_name,
    count(*)::bigint as observed,
    5::bigint as expected
  from information_schema.tables table_row
  join required_tables required
    on required.table_name = table_row.table_name
  where table_row.table_schema = 'public'

  union all

  select
    'classification_foundation_rls_enabled',
    count(*)::bigint,
    5::bigint
  from pg_class class_row
  join pg_namespace namespace_row
    on namespace_row.oid = class_row.relnamespace
  join required_tables required
    on required.table_name = class_row.relname
  where namespace_row.nspname = 'public'
    and class_row.relrowsecurity = true

  union all

  select
    'classification_foundation_browser_table_privileges_zero',
    count(*)::bigint,
    0::bigint
  from information_schema.role_table_grants grant_row
  join required_tables required
    on required.table_name = grant_row.table_name
  where grant_row.table_schema = 'public'
    and grant_row.grantee in ('PUBLIC','anon','authenticated')

  union all

  select
    'classification_history_service_direct_write_privileges_zero',
    count(*)::bigint,
    0::bigint
  from information_schema.role_table_grants grant_row
  where grant_row.table_schema = 'public'
    and grant_row.table_name in (
      'commerce_integrity_classifications',
      'commerce_integrity_classification_events'
    )
    and grant_row.grantee = 'service_role'
    and grant_row.privilege_type in (
      'INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
    )

  union all

  select
    'classification_history_service_select_present',
    count(*)::bigint,
    2::bigint
  from information_schema.role_table_grants grant_row
  where grant_row.table_schema = 'public'
    and grant_row.table_name in (
      'commerce_integrity_classifications',
      'commerce_integrity_classification_events'
    )
    and grant_row.grantee = 'service_role'
    and grant_row.privilege_type = 'SELECT'

  union all

  select
    'classification_registry_service_select_present',
    count(*)::bigint,
    3::bigint
  from information_schema.role_table_grants grant_row
  where grant_row.table_schema = 'public'
    and grant_row.table_name in (
      'commerce_integrity_taxonomy_versions',
      'commerce_integrity_source_module_registry',
      'commerce_integrity_taxonomy_categories'
    )
    and grant_row.grantee = 'service_role'
    and grant_row.privilege_type = 'SELECT'

  union all

  select
    'commerce_integrity_v1_single_active_version',
    count(*)::bigint,
    1::bigint
  from public.commerce_integrity_taxonomy_versions version_row
  where version_row.taxonomy_family = 'commerce_integrity'
    and version_row.taxonomy_version = 'commerce_integrity.v1'
    and version_row.active_for_new_classification = true

  union all

  select
    'commerce_integrity_v1_source_modules_complete',
    count(*)::bigint,
    10::bigint
  from public.commerce_integrity_source_module_registry source_row
  where source_row.taxonomy_version = 'commerce_integrity.v1'

  union all

  select
    'commerce_integrity_v1_categories_complete',
    count(*)::bigint,
    15::bigint
  from public.commerce_integrity_taxonomy_categories category_row
  where category_row.taxonomy_version = 'commerce_integrity.v1'
    and category_row.category_id in (
      'COM-01','COM-02','COM-03','COM-04','COM-05',
      'COM-06','COM-07','COM-08','COM-09','COM-10',
      'COM-11','COM-12','COM-13','COM-14','COM-15'
    )

  union all

  select
    'direct_and_conditional_sources_only_write_enabled',
    count(*)::bigint,
    7::bigint
  from public.commerce_integrity_source_module_registry source_row
  join write_enabled_sources expected_source
    on expected_source.source_module = source_row.source_module
  where source_row.taxonomy_version = 'commerce_integrity.v1'
    and source_row.classification_write_enabled = true

  union all

  select
    'restricted_and_inherited_sources_write_disabled',
    count(*)::bigint,
    3::bigint
  from public.commerce_integrity_source_module_registry source_row
  join write_disabled_sources expected_source
    on expected_source.source_module = source_row.source_module
  where source_row.taxonomy_version = 'commerce_integrity.v1'
    and source_row.classification_write_enabled = false

  union all

  select
    'restricted_source_modes_preserved',
    count(*)::bigint,
    3::bigint
  from public.commerce_integrity_source_module_registry source_row
  where source_row.taxonomy_version = 'commerce_integrity.v1'
    and (
      (source_row.source_module = 'rooms' and source_row.source_mode = 'restricted')
      or (source_row.source_module = 'messages' and source_row.source_mode = 'restricted')
      or (source_row.source_module = 'local' and source_row.source_mode = 'inherited_only')
    )

  union all

  select
    'category_module_arrays_reference_known_sources',
    count(*)::bigint,
    0::bigint
  from public.commerce_integrity_taxonomy_categories category_row
  cross join lateral unnest(
    category_row.primary_modules || category_row.secondary_modules
  ) as module_row(source_module)
  where category_row.taxonomy_version = 'commerce_integrity.v1'
    and not exists (
      select 1
      from public.commerce_integrity_source_module_registry source_row
      where source_row.taxonomy_version = category_row.taxonomy_version
        and source_row.source_module = module_row.source_module
    )

  union all

  select
    'category_primary_secondary_overlap_zero',
    count(*)::bigint,
    0::bigint
  from public.commerce_integrity_taxonomy_categories category_row
  where category_row.taxonomy_version = 'commerce_integrity.v1'
    and not public.commerce_integrity_text_arrays_disjoint(
      category_row.primary_modules,
      category_row.secondary_modules
    )

  union all

  select
    'classification_rows_zero_after_foundation',
    count(*)::bigint,
    0::bigint
  from public.commerce_integrity_classifications

  union all

  select
    'classification_event_rows_zero_after_foundation',
    count(*)::bigint,
    0::bigint
  from public.commerce_integrity_classification_events

  union all

  select
    'classification_append_only_triggers_present',
    count(*)::bigint,
    2::bigint
  from pg_trigger trigger_row
  join pg_class class_row
    on class_row.oid = trigger_row.tgrelid
  join pg_namespace namespace_row
    on namespace_row.oid = class_row.relnamespace
  where namespace_row.nspname = 'public'
    and not trigger_row.tgisinternal
    and trigger_row.tgname in (
      'prevent_commerce_integrity_classification_update_delete',
      'prevent_commerce_integrity_event_update_delete'
    )

  union all

  select
    'classification_single_successor_index_present',
    count(*)::bigint,
    1::bigint
  from pg_indexes index_row
  where index_row.schemaname = 'public'
    and index_row.tablename = 'commerce_integrity_classifications'
    and index_row.indexname = 'commerce_integrity_classification_one_successor_idx'
    and index_row.indexdef ilike '%unique%'
    and index_row.indexdef ilike '%supersedes_classification_id%'

  union all

  select
    'guarded_classification_create_function_present',
    count(*)::bigint,
    1::bigint
  from pg_proc procedure_row
  join pg_namespace namespace_row
    on namespace_row.oid = procedure_row.pronamespace
  where namespace_row.nspname = 'public'
    and procedure_row.proname = 'create_commerce_integrity_classification'
    and pg_get_function_identity_arguments(procedure_row.oid) =
      'p_actor_user_id uuid, p_taxonomy_version text, p_source_module text, p_source_record_type text, p_source_record_id uuid, p_commerce_category_id text, p_primary_safety_reason_code text, p_basis_note text, p_secondary_safety_reason_codes text[], p_context_modifiers text[], p_policy_severity_code text, p_triage_severity_code text, p_record_state text, p_classification_source text, p_source_report_type text, p_source_report_id uuid, p_supersedes_classification_id uuid, p_enforcement_decision_id uuid, p_trust_safety_case_id uuid'

  union all

  select
    'classification_create_service_only',
    (
      case when
        has_function_privilege(
          'service_role',
          'public.create_commerce_integrity_classification(uuid,text,text,text,uuid,text,text,text,text[],text[],text,text,text,text,text,uuid,uuid,uuid,uuid)',
          'EXECUTE'
        )
        and not has_function_privilege(
          'authenticated',
          'public.create_commerce_integrity_classification(uuid,text,text,text,uuid,text,text,text,text[],text[],text,text,text,text,text,uuid,uuid,uuid,uuid)',
          'EXECUTE'
        )
        and not has_function_privilege(
          'anon',
          'public.create_commerce_integrity_classification(uuid,text,text,text,uuid,text,text,text,text[],text[],text,text,text,text,text,uuid,uuid,uuid,uuid)',
          'EXECUTE'
        )
      then 1 else 0 end
    )::bigint,
    1::bigint

  union all

  select
    'classification_create_validates_source_report_and_actor',
    count(*)::bigint,
    1::bigint
  from pg_proc procedure_row
  join pg_namespace namespace_row
    on namespace_row.oid = procedure_row.pronamespace
  where namespace_row.nspname = 'public'
    and procedure_row.proname = 'create_commerce_integrity_classification'
    and pg_get_functiondef(procedure_row.oid) like '%profile.is_admin%'
    and pg_get_functiondef(procedure_row.oid) like '%commerce_integrity_source_exists%'
    and pg_get_functiondef(procedure_row.oid) like '%commerce_integrity_report_matches_source%'
    and pg_get_functiondef(procedure_row.oid) like '%classification_write_enabled%'

  union all

  select
    'classification_create_uses_serialized_head_guard',
    count(*)::bigint,
    1::bigint
  from pg_proc procedure_row
  join pg_namespace namespace_row
    on namespace_row.oid = procedure_row.pronamespace
  where namespace_row.nspname = 'public'
    and procedure_row.proname = 'create_commerce_integrity_classification'
    and pg_get_functiondef(procedure_row.oid) like '%pg_advisory_xact_lock%'
    and pg_get_functiondef(procedure_row.oid) like '%supersedes_classification_id%'
    and pg_get_functiondef(procedure_row.oid) like '%parallel head%'

  union all

  select
    'policy_and_triage_severity_namespaces_present',
    count(*)::bigint,
    1::bigint
  from pg_proc procedure_row
  join pg_namespace namespace_row
    on namespace_row.oid = procedure_row.pronamespace
  where namespace_row.nspname = 'public'
    and procedure_row.proname = 'create_commerce_integrity_classification'
    and pg_get_functiondef(procedure_row.oid) like '%POLICY.S5%'
    and pg_get_functiondef(procedure_row.oid) like '%TS.S1_CRITICAL%'
    and pg_get_functiondef(procedure_row.oid) like '%Trust and Safety triage severity requires an existing Trust and Safety case link%'

  union all

  select
    'severe_confirmed_classification_requires_ts_case',
    count(*)::bigint,
    1::bigint
  from pg_constraint constraint_row
  join pg_class class_row
    on class_row.oid = constraint_row.conrelid
  join pg_namespace namespace_row
    on namespace_row.oid = class_row.relnamespace
  where namespace_row.nspname = 'public'
    and class_row.relname = 'commerce_integrity_classifications'
    and constraint_row.conname = 'commerce_integrity_classification_severe_case_check'
    and pg_get_constraintdef(constraint_row.oid) like '%POLICY.S4%'
    and pg_get_constraintdef(constraint_row.oid) like '%POLICY.S5%'
    and pg_get_constraintdef(constraint_row.oid) like '%trust_safety_case_id%'

  union all

  select
    'classification_hold_helper_exact_and_service_only',
    (
      case when
        to_regprocedure('public.commerce_integrity_classification_hold_applies(uuid)') is not null
        and has_function_privilege(
          'service_role',
          'public.commerce_integrity_classification_hold_applies(uuid)',
          'EXECUTE'
        )
        and not has_function_privilege(
          'authenticated',
          'public.commerce_integrity_classification_hold_applies(uuid)',
          'EXECUTE'
        )
        and not has_function_privilege(
          'anon',
          'public.commerce_integrity_classification_hold_applies(uuid)',
          'EXECUTE'
        )
      then 1 else 0 end
    )::bigint,
    1::bigint

  union all

  select
    'classification_hold_helper_exact_target_contract',
    count(*)::bigint,
    1::bigint
  from pg_proc procedure_row
  join pg_namespace namespace_row
    on namespace_row.oid = procedure_row.pronamespace
  where namespace_row.nspname = 'public'
    and procedure_row.proname = 'commerce_integrity_classification_hold_applies'
    and pg_get_functiondef(procedure_row.oid) like '%target_row.target_type = ''other''%'
    and pg_get_functiondef(procedure_row.oid) like '%target_row.resource_key = ''commerce_integrity_classifications''%'
    and pg_get_functiondef(procedure_row.oid) like '%target_row.target_ref = p_classification_id::text%'

  union all

  select
    'classification_destructive_rpcs_zero',
    count(*)::bigint,
    0::bigint
  from pg_proc procedure_row
  join pg_namespace namespace_row
    on namespace_row.oid = procedure_row.pronamespace
  where namespace_row.nspname = 'public'
    and procedure_row.proname like '%commerce_integrity%'
    and (
      procedure_row.proname like '%delete%'
      or procedure_row.proname like '%purge%'
      or procedure_row.proname like '%dispose%'
      or procedure_row.proname like '%anonymize%'
      or procedure_row.proname like '%archive%'
    )

  union all

  select
    'classification_external_action_rpcs_zero',
    count(*)::bigint,
    0::bigint
  from pg_proc procedure_row
  join pg_namespace namespace_row
    on namespace_row.oid = procedure_row.pronamespace
  where namespace_row.nspname = 'public'
    and procedure_row.proname like '%commerce_integrity%'
    and (
      procedure_row.proname like '%export%'
      or procedure_row.proname like '%disclose%'
      or procedure_row.proname like '%transmit%'
      or procedure_row.proname like '%notify%'
      or procedure_row.proname like '%report_external%'
    )
)
select
  check_name,
  observed,
  expected,
  case when observed = expected then 'PASS' else 'FAIL' end as status
from checks
order by check_name;
