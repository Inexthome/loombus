-- Issue #674: Legal Operations retention and disposition foundation.
-- Metadata and governance structure only. This migration does not purge, delete,
-- anonymize, export, disclose, transmit, or otherwise dispose of any production data.
-- Fixed retention timelines remain unapproved until supported by verified evidence
-- and qualified counsel review.

begin;

alter table public.legal_operations_authorizations
  add column if not exists can_review_legal_retention boolean not null default false;

comment on column public.legal_operations_authorizations.can_review_legal_retention is
'Allows restricted review of Legal Operations retention and disposition metadata only. It does not grant deletion, purge, export, disclosure, emergency approval, notice, or external-transmission authority.';

create table if not exists public.legal_retention_schedule_registry (
  record_key text primary key,
  display_name text not null,
  source_group text not null,
  source_locations text[] not null,
  lifecycle_trigger text not null,
  normal_retention_rule text not null,
  timing_status text not null default 'unapproved',
  timing_value text,
  hold_interaction text not null,
  active_hold_rule text not null,
  disposition_method text not null default 'manual_review',
  disposition_execution_enabled boolean not null default false,
  counsel_review_required boolean not null default true,
  canonical_register_reference text not null default 'public.account_deletion_resource_registry',
  related_account_deletion_resource_keys text[] not null default '{}'::text[],
  accountable_owner text not null,
  review_cadence text not null default 'quarterly',
  unresolved_items text[] not null default '{}'::text[],
  evidence_sources text[] not null default '{}'::text[],
  notes text,
  enabled boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint legal_retention_schedule_record_key_length_check check (
    char_length(record_key) between 2 and 160
  ),
  constraint legal_retention_schedule_display_name_length_check check (
    char_length(display_name) between 2 and 400
  ),
  constraint legal_retention_schedule_source_group_length_check check (
    char_length(source_group) between 2 and 120
  ),
  constraint legal_retention_schedule_source_locations_check check (
    cardinality(source_locations) between 1 and 40
  ),
  constraint legal_retention_schedule_lifecycle_trigger_length_check check (
    char_length(lifecycle_trigger) between 5 and 4000
  ),
  constraint legal_retention_schedule_rule_length_check check (
    char_length(normal_retention_rule) between 5 and 6000
  ),
  constraint legal_retention_schedule_timing_status_check check (
    timing_status in ('unapproved', 'approved', 'not_applicable')
  ),
  constraint legal_retention_schedule_timing_value_check check (
    (timing_status = 'approved' and timing_value is not null and char_length(timing_value) between 1 and 1000)
    or (timing_status in ('unapproved', 'not_applicable') and timing_value is null)
  ),
  constraint legal_retention_schedule_hold_interaction_check check (
    hold_interaction in ('blocks_disposition', 'retain_history', 'not_request_scoped')
  ),
  constraint legal_retention_schedule_active_hold_rule_length_check check (
    char_length(active_hold_rule) between 5 and 4000
  ),
  constraint legal_retention_schedule_disposition_method_check check (
    disposition_method in ('retain', 'delete', 'anonymize', 'archive', 'manual_review')
  ),
  constraint legal_retention_schedule_execution_disabled_check check (
    disposition_execution_enabled = false
  ),
  constraint legal_retention_schedule_counsel_required_check check (
    counsel_review_required = true
  ),
  constraint legal_retention_schedule_canonical_register_check check (
    canonical_register_reference = 'public.account_deletion_resource_registry'
  ),
  constraint legal_retention_schedule_owner_length_check check (
    char_length(accountable_owner) between 2 and 500
  ),
  constraint legal_retention_schedule_review_cadence_length_check check (
    char_length(review_cadence) between 2 and 200
  ),
  constraint legal_retention_schedule_notes_length_check check (
    notes is null or char_length(notes) <= 8000
  ),
  constraint legal_retention_schedule_payload_size_check check (
    octet_length(array_to_string(source_locations, E'\n')) <= 16000
    and octet_length(array_to_string(related_account_deletion_resource_keys, E'\n')) <= 12000
    and octet_length(array_to_string(unresolved_items, E'\n')) <= 30000
    and octet_length(array_to_string(evidence_sources, E'\n')) <= 30000
  )
);

comment on table public.legal_retention_schedule_registry is
'Issue #674 metadata-only Legal Operations retention and disposition schedule. It cross-references the canonical Issue #668 account-deletion register but does not execute disposition or establish unsupported fixed timelines.';

comment on column public.legal_retention_schedule_registry.timing_status is
'Fixed timing commitment status. Seeded rows remain unapproved and must have no timing_value until verified evidence and qualified counsel approve a duration.';

comment on column public.legal_retention_schedule_registry.related_account_deletion_resource_keys is
'Optional cross-reference to canonical Issue #668 resource classes. Empty means the Legal Operations governance record is not automatically governed by member-account deletion disposition.';

alter table public.legal_retention_schedule_registry enable row level security;

-- Service-only, read-only registry. All changes occur through reviewed migrations.
revoke all on table public.legal_retention_schedule_registry from public, anon, authenticated, service_role;
grant select on table public.legal_retention_schedule_registry to service_role;

insert into public.legal_retention_schedule_registry (
  record_key,
  display_name,
  source_group,
  source_locations,
  lifecycle_trigger,
  normal_retention_rule,
  timing_status,
  timing_value,
  hold_interaction,
  active_hold_rule,
  disposition_method,
  disposition_execution_enabled,
  counsel_review_required,
  canonical_register_reference,
  related_account_deletion_resource_keys,
  accountable_owner,
  review_cadence,
  unresolved_items,
  evidence_sources,
  notes,
  sort_order
)
values
(
  'legal_request_case_metadata',
  'Legal request case, authority, scope, protected-party, notice, and counsel-review metadata',
  'legal_requests',
  array['public.legal_requests'],
  'Case creation, review, deficiency or rejection, fulfillment, and eventual closure define the lifecycle. Closure alone is not an approved deletion trigger.',
  'Retain while the legal request is active and thereafter until qualified counsel approves a verified Legal Operations retention schedule. No fixed post-closure duration is approved in this phase.',
  'unapproved', null,
  'blocks_disposition',
  'Any active preservation hold linked to the request blocks future disposition of request-scoped Legal Operations records. A closed request does not override an active hold.',
  'manual_review', false, true,
  'public.account_deletion_resource_registry', '{}'::text[],
  'Privacy and Data Governance with Legal or policy review',
  'quarterly',
  array['Post-closure retention duration requires qualified counsel approval and operational evidence.', 'Cross-border, confidentiality, delayed-notice, privilege, reporter, victim, and unrelated-member obligations may require case-specific review.'],
  array['supabase/migrations/20260808080000_create_legal_operations_foundation.sql', 'supabase/migrations/20260809042000_add_legal_request_review_capability.sql', 'supabase/migrations/20260809051000_add_protected_party_review_controls.sql'],
  'Legal request records are governance records and are not automatically deleted because a referenced member later requests account deletion.',
  10
),
(
  'preservation_hold_controls',
  'Preservation holds and preservation target metadata',
  'preservation',
  array['public.legal_preservation_holds', 'public.legal_preservation_hold_targets'],
  'Draft, activation, extension, expiry, release, and review dates define the hold lifecycle. Release or expiry ends hold effect but is not itself an approved record-deletion trigger.',
  'Retain active hold controls for the full hold lifecycle. Retain released or expired hold history thereafter until qualified counsel approves a verified legal-record schedule.',
  'unapproved', null,
  'retain_history',
  'An active hold must remain enforceable and auditable. Hold-control history is retained even after release or expiry and must not be silently removed by ordinary account, Room, or source-record deletion.',
  'retain', false, true,
  'public.account_deletion_resource_registry', array['rooms', 'backups_and_replicas'],
  'Privacy and Data Governance with Legal or policy review',
  'quarterly',
  array['Post-release or post-expiry retention duration is not approved.', 'Provider-side preserved copies require provider-specific lifecycle evidence.'],
  array['supabase/migrations/20260808080000_create_legal_operations_foundation.sql', 'supabase/migrations/20260808104000_enforce_legal_holds_on_destructive_paths.sql'],
  'Cross-references the Issue #668 Room and retained-copy classes only for interaction awareness; it does not replace their canonical disposition rules.',
  20
),
(
  'disclosure_control_metadata',
  'Disclosure control, legal basis, recipient-reference, approval, and transmission metadata',
  'disclosures',
  array['public.legal_disclosures'],
  'Draft creation, approval review, transmission, cancellation, and request closure define lifecycle milestones. No milestone currently triggers automated disposition.',
  'Retain disclosure-control metadata through any review or transmission lifecycle and thereafter until qualified counsel approves a verified disclosure-record schedule.',
  'unapproved', null,
  'blocks_disposition',
  'If the disclosure belongs to a request with an active preservation hold, future disposition remains blocked until hold obligations are resolved and the approved retention rule permits disposition.',
  'manual_review', false, true,
  'public.account_deletion_resource_registry', '{}'::text[],
  'Privacy and Data Governance with Legal or policy review',
  'quarterly',
  array['Post-transmission and cancelled-draft retention periods require counsel approval.', 'Recipient-side copies are outside Loombus disposition control and must be treated separately.'],
  array['supabase/migrations/20260808080000_create_legal_operations_foundation.sql', 'supabase/migrations/20260808111500_restrict_legal_disclosure_preparation.sql'],
  'This row covers disclosure control metadata only, not responsive payload content or recipient-controlled copies.',
  30
),
(
  'disclosure_manifest_metadata',
  'Least-data disclosure manifest item metadata',
  'disclosures',
  array['public.legal_disclosure_items'],
  'Manifest-item creation and the parent disclosure lifecycle define record context. Manifest items are append-only and have no automated disposition path.',
  'Retain least-data manifest metadata with the related disclosure control history until qualified counsel approves a verified schedule.',
  'unapproved', null,
  'blocks_disposition',
  'Active request holds block future disposition of related disclosure-manifest metadata. Manifest history must remain auditable while any related preservation obligation is active.',
  'retain', false, true,
  'public.account_deletion_resource_registry', '{}'::text[],
  'Privacy and Data Governance with Legal or policy review',
  'quarterly',
  array['Retention duration for append-only manifest history is unapproved.', 'Future artifact or package linkage must not shorten the manifest retention rule.'],
  array['supabase/migrations/20260808080000_create_legal_operations_foundation.sql', 'supabase/migrations/20260808111500_restrict_legal_disclosure_preparation.sql'],
  'Manifest rows store field-selection and integrity metadata, not responsive payload bytes.',
  40
),
(
  'legal_request_event_history',
  'Append-only Legal Operations request event history',
  'audit_history',
  array['public.legal_request_events'],
  'Events are appended throughout intake, review, preservation, disclosure preparation, access, and status changes. They are evidentiary history rather than mutable case state.',
  'Retain append-only request event history pending a qualified-counsel-approved legal-record schedule. No automated event pruning is approved.',
  'unapproved', null,
  'retain_history',
  'Event history documenting an active or historical hold must remain available for audit and cannot be removed merely because the operational hold status changes.',
  'retain', false, true,
  'public.account_deletion_resource_registry', array['trust_safety_support'],
  'Privacy and Data Governance with Legal or policy review',
  'quarterly',
  array['Minimum evidentiary retention period requires counsel approval.', 'Any future audit compaction or archival strategy requires integrity and accessibility review.'],
  array['supabase/migrations/20260808080000_create_legal_operations_foundation.sql'],
  'The Issue #668 trust/safety/support resource class is a related audit-history category, not a deletion instruction for Legal Operations events.',
  50
),
(
  'legal_operations_authorization_records',
  'Legal Operations authorization and separation-of-duty records',
  'access_governance',
  array['public.legal_operations_authorizations'],
  'Appointment, capability changes, revocation, and access-governance review define lifecycle milestones.',
  'Retain access-governance history as required to prove who held Legal Operations authority, pending qualified counsel and security-governance approval of an exact schedule.',
  'unapproved', null,
  'not_request_scoped',
  'These records are not request-scoped. Active preservation holds do not determine their lifecycle, and no ordinary member-account deletion may silently remove Legal Operations authorization history.',
  'retain', false, true,
  'public.account_deletion_resource_registry', array['trust_safety_support'],
  'Privacy and Data Governance with Security and Legal or policy review',
  'quarterly',
  array['Exact retention duration for privileged access-governance history remains unapproved.', 'Future capability-change history may require a dedicated append-only authorization event log.'],
  array['supabase/migrations/20260808080000_create_legal_operations_foundation.sql', 'supabase/migrations/20260809042000_add_legal_request_review_capability.sql', 'supabase/migrations/20260809060000_create_legal_export_integrity_foundation.sql'],
  'Authorization records contain internal governance metadata and are not a member-account profile substitute.',
  60
),
(
  'legal_operations_global_audit_history',
  'Global Legal Operations audit-log entries',
  'audit_history',
  array['public.audit_logs where action is Legal Operations scoped'],
  'Restricted workspace access and attempted operational actions append audit entries across Legal Operations surfaces.',
  'Retain Legal Operations audit entries pending qualified counsel, security, and privacy approval of a verified schedule. No Legal Operations audit purge is enabled.',
  'unapproved', null,
  'retain_history',
  'Audit evidence related to an active preservation hold or legal request must remain available. Hold release does not automatically authorize audit deletion.',
  'retain', false, true,
  'public.account_deletion_resource_registry', array['trust_safety_support'],
  'Privacy and Data Governance with Security and Legal or policy review',
  'quarterly',
  array['The production audit-log retention period and infrastructure copies require verified evidence.', 'Security or incident-response obligations may impose separate retention requirements.'],
  array['src/lib/legal-operations/access.ts', 'supabase/migrations/20260803200000_account_deletion_processor.sql'],
  'This schedule row covers Legal Operations audit entries only and does not establish a platform-wide audit-log duration.',
  70
),
(
  'legal_data_map_registry_metadata',
  'Legal Data Source Registry metadata and evidence references',
  'governance_registry',
  array['public.legal_data_source_registry'],
  'Registry rows change only through reviewed migrations as source systems, evidence, and unresolved gaps change.',
  'Retain current and repository-versioned data-map evidence as governance documentation. Exact database-row supersession or archive timing remains unapproved.',
  'unapproved', null,
  'not_request_scoped',
  'The data map is not request-scoped and contains no request-specific member payload. Active holds do not determine registry-row lifecycle, but registry changes must not erase the source mapping needed to administer holds.',
  'retain', false, true,
  'public.account_deletion_resource_registry', '{}'::text[],
  'Privacy and Data Governance with Legal or policy review',
  'quarterly',
  array['A formal historical snapshot/archive mechanism for superseded registry rows is not yet implemented.'],
  array['supabase/migrations/20260809053000_create_legal_data_source_registry.sql'],
  'The repository migration history remains the change record for this static registry in the current phase.',
  80
),
(
  'export_package_integrity_metadata',
  'Export package integrity control metadata',
  'export_integrity',
  array['public.legal_export_packages'],
  'Future planned, generated, verified, sealed, or voided package states would define lifecycle milestones. No package rows or write path exist in the current foundation.',
  'Retain any future package-control metadata with the related legal request and disclosure history until qualified counsel approves a verified schedule.',
  'unapproved', null,
  'blocks_disposition',
  'Any future request-scoped package metadata remains subject to active preservation obligations. No package disposition is allowed while a related active hold requires continuity.',
  'manual_review', false, true,
  'public.account_deletion_resource_registry', array['backups_and_replicas'],
  'Privacy and Data Governance with Legal or policy review',
  'quarterly',
  array['No production package rows exist, so operational retention evidence does not yet exist.', 'Future package storage, encryption, archive, and destruction procedures require separate approval.'],
  array['supabase/migrations/20260809060000_create_legal_export_integrity_foundation.sql'],
  'This row is control metadata only and does not authorize export package creation.',
  90
),
(
  'export_artifact_integrity_metadata',
  'Append-only export artifact digest and file metadata',
  'export_integrity',
  array['public.legal_export_artifacts'],
  'Future artifact registration would create append-only metadata linked to an export package. No artifact rows or registration RPC exist in the current foundation.',
  'Retain future artifact-integrity metadata with the parent package and disclosure history until qualified counsel approves a verified schedule.',
  'unapproved', null,
  'blocks_disposition',
  'Future artifact metadata related to a held request cannot be disposed while preservation obligations remain active. Artifact metadata disposition must not imply payload destruction without separate evidence.',
  'retain', false, true,
  'public.account_deletion_resource_registry', array['backups_and_replicas'],
  'Privacy and Data Governance with Legal or policy review',
  'quarterly',
  array['No production artifact rows exist.', 'Payload storage and provider-copy retention remain outside this metadata-only phase.'],
  array['supabase/migrations/20260809060000_create_legal_export_integrity_foundation.sql'],
  'Digest metadata is distinct from export payload bytes and from recipient-controlled copies.',
  100
),
(
  'export_verification_history',
  'Append-only export integrity verification history',
  'export_integrity',
  array['public.legal_export_verifications'],
  'Future manifest, package, artifact, count, field-scope, or custody-continuity checks would append verification evidence.',
  'Retain future verification history as evidentiary metadata with the related package until qualified counsel approves a verified schedule.',
  'unapproved', null,
  'retain_history',
  'Verification evidence associated with an active hold or preserved disclosure context must remain available. Hold release does not itself authorize deletion of integrity history.',
  'retain', false, true,
  'public.account_deletion_resource_registry', array['trust_safety_support'],
  'Privacy and Data Governance with Legal or policy review',
  'quarterly',
  array['No production verification rows exist.', 'Minimum evidentiary retention duration is unapproved.'],
  array['supabase/migrations/20260809060000_create_legal_export_integrity_foundation.sql'],
  'Verification records are append-only control evidence, not responsive content.',
  110
),
(
  'chain_of_custody_history',
  'Append-only chain-of-custody event history',
  'export_integrity',
  array['public.legal_chain_of_custody_events'],
  'Future package registration, artifact registration, verification, sealing, handoff, transfer, receipt, access, voiding, or destruction events would append custody evidence.',
  'Retain future custody history as evidentiary chain-of-custody metadata until qualified counsel approves a verified schedule. No custody-event pruning is enabled.',
  'unapproved', null,
  'retain_history',
  'Custody history relevant to an active preservation obligation must remain auditable. Release of a hold does not automatically authorize deletion of custody evidence.',
  'retain', false, true,
  'public.account_deletion_resource_registry', array['trust_safety_support', 'backups_and_replicas'],
  'Privacy and Data Governance with Legal or policy review',
  'quarterly',
  array['No production custody events exist.', 'Future external transfer or recipient-copy retention requires separate operational and counsel review.'],
  array['supabase/migrations/20260809060000_create_legal_export_integrity_foundation.sql'],
  'No external transfer or custody-event write path is enabled by this schedule foundation.',
  120
)
on conflict (record_key) do update set
  display_name = excluded.display_name,
  source_group = excluded.source_group,
  source_locations = excluded.source_locations,
  lifecycle_trigger = excluded.lifecycle_trigger,
  normal_retention_rule = excluded.normal_retention_rule,
  timing_status = excluded.timing_status,
  timing_value = excluded.timing_value,
  hold_interaction = excluded.hold_interaction,
  active_hold_rule = excluded.active_hold_rule,
  disposition_method = excluded.disposition_method,
  disposition_execution_enabled = excluded.disposition_execution_enabled,
  counsel_review_required = excluded.counsel_review_required,
  canonical_register_reference = excluded.canonical_register_reference,
  related_account_deletion_resource_keys = excluded.related_account_deletion_resource_keys,
  accountable_owner = excluded.accountable_owner,
  review_cadence = excluded.review_cadence,
  unresolved_items = excluded.unresolved_items,
  evidence_sources = excluded.evidence_sources,
  notes = excluded.notes,
  sort_order = excluded.sort_order,
  enabled = true,
  updated_at = now();

commit;
