-- Issue #668 Search index, telemetry, and cache disposition.
-- This migration does not delete or rewrite Search documents, invoke a Search
-- rebuild or repair function, clear a cache, mutate an owning source record,
-- add an account-deletion worker dispatch, or enable a destructive handler.

insert into public.account_deletion_resource_registry (
  resource_key, data_class, system_of_record, disposition, handler_key,
  execution_mode, sort_order, detail
) values (
  'search_index_and_telemetry',
  'Everything Search derived documents, source synchronization, recent-search state, query and click telemetry, and caches',
  'Supabase Database, member device storage, application runtime, and infrastructure providers',
  'manual_review',
  'search_index_and_telemetry',
  'manual_review',
  80,
  jsonb_build_object(
    'status', 'disposition_defined_handler_not_approved',
    'automatic_execution', false,
    'server_index', jsonb_build_object(
      'table', 'loombus_search_documents',
      'role', 'Derived Search index generated from owning source records.',
      'ownership_fields', jsonb_build_array('owner_id', 'source_table', 'entity_id'),
      'source_families', jsonb_build_array(
        'discussions', 'replies', 'discussion_summaries',
        'discussion_attachments', 'profiles', 'rooms', 'room_posts',
        'room_announcements', 'room_events', 'room_module_records',
        'room_resources', 'businesses', 'business_services', 'job_postings',
        'marketplace_listings', 'public_events', 'service_requests',
        'provider_services', 'platform_pages'
      ),
      'current_controls', jsonb_build_array(
        'source-specific synchronization functions create, update, or remove derived documents',
        'admin_rebuild_loombus_search_source regenerates one registered source family and removes derived orphans',
        'admin_repair_loombus_search_document regenerates one derived record from its owning source',
        'search_loombus_documents remains authoritative for visibility and access filtering'
      )
    ),
    'required_sequence', jsonb_build_array(
      'complete the owning source disposition before changing its derived Search document',
      'preserve source records and Search documents required for moderation, safety, fraud, dispute, legal-hold, or recipient-continuity review',
      'after an approved source deletion or anonymization, regenerate or remove the derived document through the source-owned indexing contract',
      'verify the member no longer appears through public, authenticated, premium, private-owner, and Room-member Search paths',
      'verify related Search briefs, grounded AI source sets, Local Discovery projections, application caches, CDN caches, logs, and backups separately',
      'record before-and-after identifiers, verification queries, cache evidence, and unresolved vendor copies on the account deletion disposition'
    ),
    'do_not_use_as_proof', jsonb_build_array(
      'deleting or anonymizing an owning row without verifying the derived Search document',
      'deleting a Search document while retaining an eligible owning source that can recreate it',
      'an administrator repair or rebuild response without checking every applicable visibility path',
      'database deletion as proof that runtime, CDN, log, backup, replica, AI-provider, or device copies expired'
    ),
    'member_device_state', jsonb_build_object(
      'recent_searches', 'The reviewed Everything Search interface stores recent-search history on the member device.',
      'account_deletion_action', 'No server-side account-deletion action can prove deletion from a member-controlled browser or device.',
      'required_disclosure', 'Document local-clearing behavior and avoid representing device-local state as a server-retained account record.'
    ),
    'telemetry_inventory', jsonb_build_object(
      'canonical_query_log_table_found', false,
      'canonical_click_log_table_found', false,
      'reviewed_evidence', jsonb_build_array(
        'Everything Search application contract',
        'Search Operations and Index Health migration',
        'Search operations administrator workflow'
      ),
      'gap', 'Production logs, analytics, observability, security telemetry, and vendor dashboards require separate read-only inventory. Absence from the reviewed repository paths is not proof that no telemetry exists.'
    ),
    'separate_resources', jsonb_build_array(
      'owning source records', 'Local Discovery fields and location anchors',
      'Search briefs and summaries', 'Ask Loombus AI prompts and grounded source payloads',
      'application and CDN caches', 'Vercel and Supabase logs',
      'security, fraud, analytics, and incident telemetry',
      'backups and replicas', 'member-controlled device storage',
      'external provider and vendor copies'
    ),
    'blockers', jsonb_build_array(
      'owning source disposition is unresolved',
      'profile anonymization or Auth sequencing is unresolved',
      'moderation, safety, fraud, dispute, security, or legal-hold evidence remains open',
      'Search visibility paths have not been verified after source handling',
      'cache, log, analytics, backup, replica, or vendor behavior remains unverified'
    ),
    'feature_flags', jsonb_build_object(
      'account_deletion', 'ACCOUNT_DELETION_DESTRUCTIVE_HANDLERS_ENABLED is unchanged and does not authorize Search mutation.'
    )
  )
)
on conflict (resource_key) do update set
  data_class = excluded.data_class,
  system_of_record = excluded.system_of_record,
  disposition = excluded.disposition,
  handler_key = excluded.handler_key,
  execution_mode = excluded.execution_mode,
  enabled = true,
  sort_order = excluded.sort_order,
  detail = excluded.detail,
  updated_at = now();

comment on table public.account_deletion_resource_registry is
'Executable account-deletion inventory. Search remains manual-review only until owning-source, visibility, cache, telemetry, backup, vendor, and verification prerequisites are satisfied.';
