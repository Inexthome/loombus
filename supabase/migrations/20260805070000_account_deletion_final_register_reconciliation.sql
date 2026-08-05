-- Issue #668 final canonical register and disclosure reconciliation.
-- This migration is governance-only. It does not enable destructive handlers,
-- dispatch a worker, delete data, change Room deletion, or call a provider API.

insert into public.account_deletion_resource_registry (
  resource_key,
  data_class,
  system_of_record,
  disposition,
  handler_key,
  execution_mode,
  sort_order,
  detail
)
values (
  'canonical_retention_register_and_disclosure_governance',
  'Canonical retention register, exception reporting, export coverage, deletion disclosures, public policy reconciliation, quarterly review, and change control',
  'Supabase Database registry, account-deletion orchestration, account-deletion documentation, user export workflows, public Privacy and Retention documents, Help Center, administrator workflows, and production change management',
  'manual_review',
  'canonical_retention_register_and_disclosure_governance',
  'manual_review',
  140,
  jsonb_build_object(
    'status', 'governance_contract_defined_runtime_enforcement_not_approved',
    'automatic_execution', false,
    'issue', 668,
    'phase', 'final_register_and_disclosure_reconciliation',
    'canonical_sources', jsonb_build_array(
      'public.account_deletion_resource_registry',
      'docs/account-deletion resource-specific disposition documents',
      'account-deletion orchestration and exception reports',
      'user data export coverage and documentation',
      'public Privacy, Retention, Help Center, and deletion disclosures'
    ),
    'required_register_fields', jsonb_build_array(
      'resource key and data class',
      'system of record',
      'purpose and operational or legal basis',
      'approved retention rule or explicit unverified status',
      'deletion, anonymization, detachment, archive, transfer, expiry, or manual-review trigger',
      'execution mode and handler approval state',
      'legal hold, fraud, safety, billing, dispute, recipient, Room, organization, support, and administrator-accountability exceptions',
      'backup, replica, cache, export, and vendor-copy treatment',
      'access roles and accountable owner',
      'verification requirements and unresolved dependencies'
    ),
    'exception_report_contract', jsonb_build_array(
      'request identifier and resource key',
      'affected system and relevant local or provider identifiers',
      'disposition and retained, transferred, detached, anonymized, archived, expired, or unresolved status',
      'exception category and rationale',
      'legal hold or case reference where applicable',
      'accountable reviewer and review time',
      'expected expiry or next-review date when known',
      'verification result and evidence reference',
      'unresolved vendor, backup, replica, cache, export, recipient, Room, or organization copy'
    ),
    'disclosure_rules', jsonb_build_array(
      'distinguish account closure and access revocation from historical-record disposition',
      'distinguish deletion from anonymization, detachment, transfer, archive, and scheduled expiry',
      'distinguish first-party records from recipient-controlled and vendor-held copies',
      'distinguish account deletion from subscription cancellation, payment retention, Room ownership transfer, case closure, and evidence deletion',
      'do not promise immediate backup, replica, cache, export, log, or provider deletion without verified evidence',
      'do not publish unsupported retention timelines'
    ),
    'export_reconciliation', jsonb_build_array(
      'map export coverage to the same resource classes as the retention register',
      'identify included first-party data classes',
      'document shared, recipient-controlled, Room, organization, evidence, security, billing, and vendor-held exclusions or indirect representations',
      'state that export omission is not proof of deletion',
      'review every new production data class for both register and export coverage before release'
    ),
    'room_staged_deletion', jsonb_build_array(
      'member account deletion does not bypass Room ownership, governance, billing, recipient continuity, legal hold, lifecycle manifest, or evidence requirements',
      'Room staged deletion remains separate from immediate account deletion',
      'ROOM_PERMANENT_DELETION_ENABLED remains unchanged'
    ),
    'quarterly_review', jsonb_build_object(
      'accountable_owner', 'Privacy and Data Governance owner',
      'required_reviewers', jsonb_build_array(
        'Engineering',
        'Trust and Safety',
        'Security',
        'Billing or Finance',
        'Support',
        'Legal or policy counsel where applicable'
      ),
      'required_actions', jsonb_build_array(
        'inventory new and changed production resources and subprocessors',
        'compare production resources to the registry',
        'verify handler, feature-flag, and execution-mode states',
        'review unresolved exceptions and provider evidence',
        'reconcile export and deletion disclosures',
        'verify Room staged-deletion language',
        'record approvals, gaps, remediation owners, and due dates'
      )
    ),
    'change_control', jsonb_build_array(
      'schema, vendor, feature, billing, safety, Room, export, or deletion-workflow changes that alter personal-data handling must update the register and disclosure review in the same release or remain blocked',
      'public policy changes must map statements to registry resources and production evidence',
      'unverified behavior must remain explicitly unverified rather than converted into a timeline or guarantee'
    ),
    'blocked_actions', jsonb_build_array(
      'enable ACCOUNT_DELETION_DESTRUCTIVE_HANDLERS_ENABLED',
      'enable ROOM_PERMANENT_DELETION_ENABLED',
      'dispatch an account-deletion worker',
      'approve or invoke a destructive handler',
      'call a provider deletion API',
      'publish an unsupported retention or deletion timeline',
      'report full deletion while unresolved exceptions remain'
    ),
    'feature_flags', jsonb_build_object(
      'account_deletion', 'ACCOUNT_DELETION_DESTRUCTIVE_HANDLERS_ENABLED is unchanged.',
      'room_permanent_deletion', 'ROOM_PERMANENT_DELETION_ENABLED is unchanged.'
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
'Executable account-deletion inventory and governance register. Destructive execution remains separately gated and resource-specific.';
