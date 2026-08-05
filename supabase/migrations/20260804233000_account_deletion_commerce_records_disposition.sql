-- Issue #668 commerce and local authored-record disposition.
-- This migration records manual-review policy only. It does not delete,
-- anonymize, transfer, or otherwise modify commerce or local records; add an
-- account-deletion worker dispatch; or enable a destructive handler.

insert into public.account_deletion_resource_registry (
  resource_key, data_class, system_of_record, disposition, handler_key,
  execution_mode, sort_order, detail
) values (
  'commerce_local_records',
  'Marketplace, Businesses, Services, Requests, Jobs, Events, Appointments, and Local authored or ownership-linked records',
  'Supabase Database, Storage, Stripe, search, notification, and module-specific services',
  'manual_review',
  'commerce_local_records',
  'manual_review',
  70,
  jsonb_build_object(
    'status', 'disposition_defined_handler_not_approved',
    'automatic_execution', false,
    'default_rule', 'An account deletion request must not automatically delete, anonymize, transfer, unpublish, close, or otherwise modify commerce or local records.',
    'modules', jsonb_build_array(
      'Marketplace', 'Businesses', 'Services', 'Requests', 'Jobs',
      'Events', 'Appointments', 'Local'
    ),
    'required_decision_per_record', jsonb_build_array(
      'delete member-private or draft-only data when no dispute, evidence, billing, safety, or legal-hold exception applies',
      'anonymize public attribution only through an approved profile and search propagation sequence',
      'retain the minimum record required for transactions, disputes, fraud prevention, moderation, accounting, tax, safety, or legal hold',
      'transfer ownership or operational control when another participant, business, provider, customer, attendee, applicant, employer, organizer, or community depends on continuity'
    ),
    'blockers', jsonb_build_array(
      'the complete production table and foreign-key inventory is not approved',
      'record ownership, authorship, participant, provider, employer, organizer, and customer roles are not yet classified per table',
      'transaction, payment, subscription, refund, dispute, fraud, moderation, safety, and legal-hold obligations are unresolved',
      'Storage objects, search documents, caches, notifications, analytics, AI derivatives, vendor copies, backups, and replicas are not reconciled',
      'Supabase Auth cascades and profile anonymization sequencing are not approved'
    ),
    'preserve_until_resolved', jsonb_build_array(
      'public listings and authored records',
      'business and provider continuity',
      'service requests, applications, bookings, appointments, event participation, and counterpart access',
      'stable IDs, timestamps, status history, and relationship integrity',
      'transaction, billing, dispute, fraud, moderation, safety, support, audit, and legal-hold evidence',
      'associated Storage metadata and objects'
    ),
    'separate_resources', jsonb_build_array(
      'private commerce and local saves handled by the separately gated commerce-saves handler',
      'Storage objects and public URLs',
      'Stripe and other payment or billing records',
      'search documents and caches',
      'notifications and delivery-vendor copies',
      'AI derivatives and provider copies',
      'analytics, logs, backups, and replicas'
    ),
    'feature_flags', jsonb_build_object(
      'account_deletion', 'ACCOUNT_DELETION_DESTRUCTIVE_HANDLERS_ENABLED is unchanged and does not authorize commerce or local record mutation.'
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
'Executable account-deletion inventory. Commerce and local records remain manual-review only until per-table ownership, participant continuity, billing, dispute, evidence, Storage, search, vendor, and Auth prerequisites are approved.';
