-- Issue #674: Legal Data Source Registry.
--
-- This registry maps where potentially responsive data may exist. It contains
-- system metadata only. It does not query member records, collect source data,
-- generate exports, approve disclosures, send notices, contact outside parties,
-- or change destructive deletion behavior.

begin;

create table if not exists public.legal_data_source_registry (
  source_key text primary key,
  source_group text not null,
  display_name text not null,
  source_kind text not null,
  system_of_record text not null,
  data_classes text[] not null,
  source_locations text[] not null,
  locator_contract text not null,
  account_deletion_resource_keys text[] not null default '{}'::text[],
  external_processors text[] not null default '{}'::text[],
  inventory_status text not null,
  unresolved_items text[] not null default '{}'::text[],
  evidence_sources text[] not null default '{}'::text[],
  notes text,
  enabled boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint legal_data_source_registry_source_key_length_check check (
    char_length(source_key) between 2 and 120
  ),
  constraint legal_data_source_registry_source_group_length_check check (
    char_length(source_group) between 2 and 120
  ),
  constraint legal_data_source_registry_display_name_length_check check (
    char_length(display_name) between 2 and 300
  ),
  constraint legal_data_source_registry_source_kind_check check (
    source_kind in (
      'database', 'storage', 'provider', 'log', 'derived_index', 'device', 'mixed'
    )
  ),
  constraint legal_data_source_registry_system_length_check check (
    char_length(system_of_record) between 2 and 2000
  ),
  constraint legal_data_source_registry_data_classes_check check (
    cardinality(data_classes) between 1 and 80
  ),
  constraint legal_data_source_registry_source_locations_check check (
    cardinality(source_locations) between 1 and 120
  ),
  constraint legal_data_source_registry_locator_length_check check (
    char_length(locator_contract) between 5 and 4000
  ),
  constraint legal_data_source_registry_inventory_status_check check (
    inventory_status in ('verified', 'partial', 'unresolved')
  ),
  constraint legal_data_source_registry_partial_gap_check check (
    inventory_status = 'verified' or cardinality(unresolved_items) > 0
  ),
  constraint legal_data_source_registry_notes_length_check check (
    notes is null or char_length(notes) <= 8000
  ),
  constraint legal_data_source_registry_payload_size_check check (
    octet_length(array_to_string(data_classes, E'\n')) <= 20000
    and octet_length(array_to_string(source_locations, E'\n')) <= 40000
    and octet_length(array_to_string(account_deletion_resource_keys, E'\n')) <= 12000
    and octet_length(array_to_string(external_processors, E'\n')) <= 12000
    and octet_length(array_to_string(unresolved_items, E'\n')) <= 30000
    and octet_length(array_to_string(evidence_sources, E'\n')) <= 30000
  )
);

comment on table public.legal_data_source_registry is
'Internal Legal Operations map of systems where potentially responsive data may exist. Metadata only; not a source-data collection or export mechanism.';

comment on column public.legal_data_source_registry.locator_contract is
'Metadata-only description of how authorized reviewers would identify potentially related records. Never store request-specific member IDs, content, or responsive payloads here.';

comment on column public.legal_data_source_registry.inventory_status is
'Coverage confidence for the source inventory: verified, partial, or unresolved. Partial and unresolved rows must record explicit gaps.';

alter table public.legal_data_source_registry enable row level security;

-- The registry is intentionally service-only. Even authenticated administrators
-- must use the audited Legal Operations server route rather than direct table access.
revoke all on table public.legal_data_source_registry from public, anon, authenticated, service_role;
grant select on table public.legal_data_source_registry to service_role;

insert into public.legal_data_source_registry (
  source_key,
  source_group,
  display_name,
  source_kind,
  system_of_record,
  data_classes,
  source_locations,
  locator_contract,
  account_deletion_resource_keys,
  external_processors,
  inventory_status,
  unresolved_items,
  evidence_sources,
  notes,
  sort_order
)
values
(
  'account_identity_profile',
  'account',
  'Account, authentication, profile, and account lifecycle',
  'mixed',
  'Supabase Auth and Supabase Database',
  array[
    'authentication identity and account metadata',
    'public profile identity and presentation',
    'protected age-safety state',
    'account standing and enforcement state',
    'account-deletion workflow metadata'
  ],
  array[
    'auth.users',
    'public.profiles',
    'public.profile_sensitive',
    'public.account_deletion_requests',
    'public.account_deletion_events',
    'public.account_deletion_dispositions'
  ],
  'Use the canonical account/profile UUID relationship and the account-lifecycle request relationship. Review Auth and public profile state separately because an account identifier can appear in both first-party identity and workflow records.',
  array['account_access', 'auth_identity', 'profile_and_preferences', 'profile_sensitive_safety'],
  array['Supabase'],
  'partial',
  array[
    'Supabase Auth provider-side operational logs, backups, and support copies require separate provider inventory.',
    'Identity-verification provider copies, if any, require provider-specific verification before being treated as covered.'
  ],
  array[
    'supabase/migrations/20260803200000_account_deletion_processor.sql',
    'supabase/migrations/20260804006000_account_deletion_profile_disposition_map.sql'
  ],
  'This row maps source locations only. It does not authorize access to Auth records or identity-verification provider systems.',
  10
),
(
  'public_discussions_content',
  'database_content',
  'Published Discussions, Replies, and source-linked derivatives',
  'mixed',
  'Supabase Database, Supabase Storage, Search, AI, and application caches',
  array[
    'published discussion content',
    'reply content and thread relationships',
    'discussion attachment metadata',
    'discussion summaries and AI derivatives',
    'search-indexed representations'
  ],
  array[
    'public.discussions',
    'public.replies',
    'public.discussion_attachments',
    'public.discussion_summaries',
    'public.discussion_ai_outputs',
    'derived Search documents for discussion source families'
  ],
  'Resolve the owning Discussion or Reply first, then review source-linked attachment, summary, AI, Search, cache, moderation, and audit representations independently. Do not assume one universal author column across every derivative.',
  array['public_discussions_and_replies', 'discussion_attachments_and_derivatives'],
  array['Supabase', 'OpenAI'],
  'partial',
  array[
    'Complete production discussion-metric, cache, analytics, and vendor-copy coverage remains a separate inventory task.',
    'Attachment binaries are mapped separately under Storage and must not be inferred from attachment metadata alone.'
  ],
  array[
    'supabase/migrations/20260804007000_account_deletion_public_content_disposition.sql',
    'docs/trust-safety/implementation/ai-system-registry.json'
  ],
  'Public-content mapping preserves the distinction between canonical source records and derivative copies.',
  20
),
(
  'private_messaging',
  'messages',
  'Private conversations, participants, messages, and attachment metadata',
  'mixed',
  'Supabase Database and Supabase Storage',
  array[
    'private conversation containers',
    'conversation membership and participant state',
    'private message bodies and thread relationships',
    'private-message attachment metadata',
    'message and conversation reporting/evidence references'
  ],
  array[
    'public.private_conversations',
    'public.private_conversation_members',
    'public.private_messages',
    'public.private_message_attachments',
    'message-attachments Storage bucket objects'
  ],
  'Use conversation membership, sender/account references, conversation IDs, message IDs, and attachment-to-message relationships. Multi-party records require participant and protected-party review before any downstream scope or disclosure decision.',
  array['private_messages', 'private_message_attachments_and_evidence'],
  array['Supabase'],
  'verified',
  '{}'::text[],
  array['supabase/migrations/20260804008000_account_deletion_private_messages_disposition.sql'],
  'The exact first-party message tables and message-attachment Storage family were already identified during Issue #668. Provider and backup copies remain covered by separate registry rows.',
  30
),
(
  'rooms_and_room_operations',
  'rooms',
  'Rooms, organizations, membership, shared Room content, and Room operations',
  'mixed',
  'Supabase Database, Supabase Storage, Stripe, and Room lifecycle services',
  array[
    'Room identity and ownership',
    'Room membership and roles',
    'Room posts, replies, events, files, and resources',
    'organization and governance records',
    'Room operational module records',
    'Room billing and lifecycle references'
  ],
  array[
    'public.room_members',
    'public.room_posts',
    'public.room_post_replies',
    'public.room_events',
    'public.room_resources',
    'public.room_organizations',
    'public.room_ownership_transfers',
    'Room reservations, maintenance, Documents, Polls, Guests, and Finance module tables',
    'Room Storage objects and lifecycle records'
  ],
  'Use the Room UUID as the primary container relationship, then classify the member role in each record, including owner, administrator, moderator, member, author, guest registrant, requester, payer, or other participant. Shared Room records must not be treated as account-exclusive.',
  array['rooms'],
  array['Supabase', 'Stripe'],
  'partial',
  array[
    'The full table-by-table production inventory for newer Room operational modules must be periodically reconciled against migrations.',
    'Room billing provider objects and downstream notification/search/AI copies are separate systems and cannot be inferred from the Room row alone.'
  ],
  array[
    'supabase/migrations/20260804009000_account_deletion_room_disposition.sql',
    'supabase/migrations/20260808104000_enforce_legal_holds_on_destructive_paths.sql'
  ],
  'Room ownership, shared access, billing continuity, and staged-deletion state are separate legal review considerations from individual member linkage.',
  40
),
(
  'storage_objects_and_derivatives',
  'storage',
  'Storage objects, metadata, generated derivatives, and platform-controlled copies',
  'storage',
  'Supabase Storage and Database, Vercel/CDN/runtime caches, exports, backups, and external processors',
  array[
    'uploaded files and object metadata',
    'signed/public URL references and access evidence',
    'thumbnails, previews, resized/transcoded/converted derivatives',
    'platform-controlled exports and caches',
    'backup, replica, archive, and vendor-held object copies'
  ],
  array[
    'Supabase Storage buckets and objects',
    'message-attachments Storage bucket',
    'room-resources Storage bucket',
    'discussion/profile/commerce/support attachment object families',
    'generated derivatives and platform-controlled exports'
  ],
  'Map each object by bucket/path plus the owning or referencing database record. Verify every live reference before treating an object as account-exclusive. URL expiry, cache invalidation, or metadata deletion is not proof of binary deletion.',
  array['storage_backups_caches_exports_and_vendor_copies', 'private_message_attachments_and_evidence', 'discussion_attachments_and_derivatives'],
  array['Supabase', 'Vercel and CDN/edge providers'],
  'partial',
  array[
    'Complete production bucket, derivative, cache, export, backup, replica, and vendor-copy inventory remains provider-specific.',
    'Recipient-controlled downloaded copies are outside Loombus deletion control and must be distinguished from platform-controlled copies.'
  ],
  array['supabase/migrations/20260805063000_account_deletion_storage_vendor_copies_disposition.sql'],
  'The registry maps object families only and never stores signed URLs, object contents, or request-specific paths.',
  50
),
(
  'commerce_local_appointments',
  'commerce_local',
  'Marketplace, Businesses, Services, Requests, Jobs, Events, Appointments, and Local',
  'mixed',
  'Supabase Database, Storage, Stripe, Search, notifications, and module-specific services',
  array[
    'authored and owned commerce/local records',
    'counterparty and participant records',
    'business/provider relationships',
    'applications, requests, bookings, and appointments',
    'transaction/dispute/support references',
    'associated attachments and derived copies'
  ],
  array[
    'Marketplace records',
    'Business and provider records',
    'Services and service-request records',
    'Jobs and application records',
    'Events and participation records',
    'Appointment services and appointment requests',
    'Local records and discovery projections'
  ],
  'Identify each record by its canonical module identifier and classify the account role before scope decisions, including owner, author, provider, customer, applicant, employer, organizer, attendee, requester, or other counterparty. Shared or transaction-linked records require continuity and dispute review.',
  array['commerce_local_records'],
  array['Supabase', 'Stripe'],
  'partial',
  array[
    'The complete production table/foreign-key inventory and role classification for every commerce/local module remains an explicit verification item.',
    'Storage, Search, notifications, billing, AI, logs, backups, and vendor copies are mapped separately.'
  ],
  array['supabase/migrations/20260804233000_account_deletion_commerce_records_disposition.sql'],
  'This inventory does not treat account ownership as authority to erase counterparty or transaction records.',
  60
),
(
  'billing_payments_entitlements',
  'billing',
  'Subscriptions, entitlements, invoices, payments, refunds, disputes, and provider lifecycle records',
  'mixed',
  'Supabase Database, Stripe, Apple App Store, Google Play, application runtime, and infrastructure providers',
  array[
    'local customer/subscription identifiers',
    'premium and AI entitlement state',
    'Floor subscription state',
    'Room billing references',
    'checkout and purchase-verification metadata',
    'invoice/payment/refund/dispute references',
    'webhook-derived lifecycle and audit metadata'
  ],
  array[
    'Supabase billing and entitlement records',
    'Stripe customers/subscriptions/invoices/payments/refunds/disputes/events',
    'Apple App Store purchase and entitlement records',
    'Google Play purchase and entitlement records',
    'Room and Floor billing references',
    'billing-related webhook and support evidence'
  ],
  'Map local billing identifiers to provider object identifiers without treating access state as transaction history. Separate active entitlement, subscription lifecycle, invoice/payment evidence, dispute/fraud evidence, and Room ownership/billing continuity.',
  array['billing_and_payment_records'],
  array['Stripe', 'Apple App Store', 'Google Play', 'Supabase'],
  'partial',
  array[
    'Complete production billing table and foreign-key inventory remains unverified.',
    'Provider retention, deletion/redaction, tax/accounting, dispute, fraud, webhook-log, backup, and replica behavior requires provider-specific verification.'
  ],
  array['supabase/migrations/20260805043000_account_deletion_billing_disposition.sql'],
  'Billing mapping is intentionally separated from product access revocation and from any legal conclusion about required financial retention.',
  70
),
(
  'trust_safety_and_support',
  'support_safety',
  'Trust and Safety reports, cases, evidence, enforcement, appeals, and support escalations',
  'mixed',
  'Supabase Database and Storage, support systems, notifications/email, logs, backups, and subprocessors',
  array[
    'Trust and Safety cases and reports',
    'evidence references and restricted evidence',
    'enforcement decisions and appeals',
    'safety/investigation notes and audit history',
    'support cases and escalations that become safety/fraud/billing/legal evidence',
    'delivery evidence proving submission or outcome notification'
  ],
  array[
    'public.trust_safety_cases',
    'public.trust_safety_case_evidence_refs',
    'public.trust_safety_case_events',
    'moderation/report/enforcement/appeal record families',
    'support escalation records and linked evidence',
    'linked Storage, notification, email, log, export, and vendor records'
  ],
  'Map by case/report identifiers and classify the account role in each record before determining scope, including reporter, subject, witness, victim, recipient, Room moderator/owner, administrator, or support requester. Do not expose protected-party identities through the data map.',
  array['trust_safety_reports_enforcement_support'],
  array['Supabase', 'notification/email providers', 'support systems'],
  'partial',
  array[
    'Complete production report-family, support-system, evidence-bucket, export, and vendor coverage remains unresolved.',
    'Case-family retention and jurisdiction-specific legal requirements are not established by this registry.'
  ],
  array[
    'supabase/migrations/20260805050000_account_deletion_trust_safety_disposition.sql',
    'supabase/migrations/20260802120000_create_trust_safety_case_system.sql',
    'supabase/migrations/20260802120500_harden_trust_safety_case_invariants.sql'
  ],
  'Account deletion is not evidence deletion, and a legal request is not authority to disclose every linked safety record.',
  80
),
(
  'legal_operations_and_audit',
  'legal_operations',
  'Legal request, preservation, disclosure-control, and Legal Operations audit records',
  'database',
  'Supabase Database and formal legal-request intake systems',
  array[
    'legal request intake/review metadata',
    'preservation holds and target references',
    'disclosure-control and least-data manifest metadata',
    'append-only legal-request handling history',
    'global administrator/Legal Operations audit records'
  ],
  array[
    'public.legal_requests',
    'public.legal_preservation_holds',
    'public.legal_preservation_hold_targets',
    'public.legal_disclosures',
    'public.legal_disclosure_items',
    'public.legal_request_events',
    'public.audit_logs',
    'formal legal-request mailbox/intake channel records'
  ],
  'Map internal records by legal request ID and related hold/disclosure IDs. Requester contact, target references, and audit actors remain restricted metadata. Formal mailbox or service-of-process records must be reconciled separately rather than assumed to be copied into the database.',
  array['canonical_retention_register_and_disclosure_governance'],
  array['Supabase', 'formal legal-request intake/mail providers'],
  'partial',
  array[
    'Formal mailbox, mail/service, and other intake-provider retention or attachment inventories are outside the database foundation and require separate verification.',
    'This registry does not establish whether any specific legal request record is responsive to another request.'
  ],
  array[
    'supabase/migrations/20260808080000_create_legal_operations_foundation.sql',
    'supabase/migrations/20260808111500_restrict_legal_disclosure_preparation.sql'
  ],
  'Legal Operations metadata is itself sensitive operational data. Registry access remains audited and service-mediated.',
  90
),
(
  'everything_search_index',
  'search',
  'Everything Search derived documents, source synchronization, local recent-search state, telemetry, and caches',
  'derived_index',
  'Supabase Database, member device storage, application runtime, and infrastructure providers',
  array[
    'derived Search documents',
    'source synchronization metadata',
    'member-device recent-search state',
    'query/click telemetry if present in production logging systems',
    'Search caches and grounded AI source sets'
  ],
  array[
    'public.loombus_search_documents',
    'member-device recent-search storage',
    'Search application/runtime caches',
    'production logging/analytics/observability systems for Search telemetry'
  ],
  'For the server index, use owner_id, source_table, and entity_id to trace a derived document back to its canonical source. Device-local recent searches are member-controlled. Do not infer query/click telemetry absence from the lack of a canonical first-party table.',
  array['search_index_and_telemetry'],
  array['Supabase', 'Vercel and observability providers'],
  'partial',
  array[
    'No canonical first-party Search query-log table was found in the reviewed implementation.',
    'No canonical first-party Search click-log table was found in the reviewed implementation.',
    'Production logs, analytics, observability, security telemetry, caches, and vendor dashboards require separate read-only inventory.'
  ],
  array['supabase/migrations/20260805034000_account_deletion_search_disposition.sql'],
  'Everything Search is a derived index. Owning source records remain authoritative and can recreate eligible derived documents.',
  100
),
(
  'ai_system_records',
  'ai',
  'AI prompts, grounded source payloads, outputs, derivatives, provenance, usage metadata, and provider copies',
  'mixed',
  'Supabase Database, application runtime, infrastructure logs, OpenAI, and historical legacy provider copies',
  array[
    'AI usage/provenance metadata',
    'Discussion summaries and cached AI outputs',
    'Floor thesis AI analyses',
    'Research Desk generation provenance',
    'AI output ratings',
    'feature-specific source payloads/prompts/outputs where retained',
    'provider request/log/abuse-monitoring copies'
  ],
  array[
    'public.ai_usage_events',
    'public.ai_output_ratings',
    'public.discussion_summaries',
    'public.discussion_ai_outputs',
    'public.floor_thesis_analyses',
    'Research Desk publication/generation provenance records',
    'feature-specific application logs and caches',
    'OpenAI provider-side operational records',
    'historical Anthropic-attributed records and provider copies'
  ],
  'Trace each AI record through its feature and owning source because there is no canonical platform-wide prompt/output/trace table. Use source IDs, feature provenance, provider/model metadata, and account linkage where present. Never treat deletion of one rating or cache row as proof that prompts, outputs, logs, or provider copies were deleted.',
  array['ai_prompts_outputs_and_provider_copies'],
  array['OpenAI', 'Anthropic (legacy historical provenance only)', 'Supabase', 'Vercel'],
  'partial',
  array[
    'First-party AI persistence is feature-specific and requires feature-by-feature reconciliation.',
    'OpenAI Zero Data Retention and Modified Abuse Monitoring are not verified by the current evidence.',
    'Historical Anthropic provider copies, logs, and provenance may remain even though Anthropic is retired from new production routing.',
    'Provider backups, subprocessors, deletion workflows, and abuse-monitoring retention require provider-specific verification.'
  ],
  array[
    'docs/trust-safety/implementation/ai-system-registry.json',
    'supabase/migrations/20260805040000_account_deletion_ai_disposition.sql'
  ],
  'Active external LLM processing is OpenAI-only under Issue #669. Historical Anthropic attribution must remain truthful and is not rewritten by this registry.',
  110
),
(
  'notification_email_push',
  'notifications',
  'In-app notifications, email and push delivery state, tokens, suppressions, queues, and delivery evidence',
  'mixed',
  'Supabase Database, application runtime, email provider, APNs, FCM, infrastructure logs, recipient inboxes, and member-controlled devices',
  array[
    'in-app notification content/read state',
    'notification preferences and channel settings',
    'email request/delivery/bounce/complaint/suppression records',
    'APNs and FCM device tokens and delivery feedback',
    'retry/dead-letter/scheduled/idempotency state',
    'administrator and report-notification delivery evidence'
  ],
  array[
    'Supabase notification/preference/token record families',
    'email-provider delivery and suppression records',
    'Apple Push Notification service records',
    'Firebase Cloud Messaging records',
    'delivery queues, retries, dead-letter and idempotency records',
    'recipient inbox and device copies'
  ],
  'Map first-party records by account ID and channel-specific identifiers, then reconcile email addresses, provider message IDs, device identifiers, or tokens only under approved access. Separate notification content from delivery evidence and future-send targets from historical provider logs.',
  array['notification_email_push_delivery'],
  array['email provider', 'Apple Push Notification service', 'Firebase Cloud Messaging', 'Supabase', 'Vercel'],
  'partial',
  array[
    'Owning notification/delivery tables are not conclusively inventoried in the current governance evidence.',
    'Provider logs, suppressions, queues, backups, exports, and recipient/device copies require channel-specific verification.'
  ],
  array['supabase/migrations/20260805053000_account_deletion_notification_delivery_disposition.sql'],
  'Provider delivery success, token invalidation, or first-party deletion is not proof that historical provider or recipient copies no longer exist.',
  120
),
(
  'infrastructure_security_logs',
  'logs',
  'Infrastructure, security, fraud, privileged-access, incident, and operational logs',
  'log',
  'Supabase, Vercel, application runtime, observability, security/fraud, incident-management, support, and queue providers',
  array[
    'Supabase Auth/API/database/Storage/Realtime/platform logs',
    'Vercel request/function/build/deployment/edge/firewall/runtime logs',
    'application diagnostics, traces, performance and operational telemetry',
    'administrator and privileged-action audit history',
    'security/fraud/abuse-prevention indicators',
    'incident cases and forensic evidence',
    'queue/retry/dead-letter/idempotency records'
  ],
  array[
    'public.audit_logs',
    'Supabase platform logs',
    'Vercel platform and runtime logs',
    'application diagnostics/observability systems',
    'security/fraud/abuse-prevention systems',
    'incident-management systems',
    'queue/scheduler/retry/dead-letter systems'
  ],
  'Use direct account identifiers only where the system records them and separately review indirect identifiers such as session, IP, user-agent, device, request, transaction, or incident relationships. Preserve actor/event integrity and avoid assuming every log can be safely re-attributed to one member.',
  array['infrastructure_security_and_incident_records'],
  array['Supabase', 'Vercel', 'observability/security/fraud/incident providers'],
  'unresolved',
  array[
    'Complete production log, telemetry, incident, queue, and vendor inventory is not yet verified.',
    'Direct and indirect identifier mapping, normal retention, regional storage, immutable audit, backup/export, and subprocessor behavior require provider-specific verification.',
    'This registry does not establish a retention period or deletion obligation for any log family.'
  ],
  array['supabase/migrations/20260805060000_account_deletion_infrastructure_security_disposition.sql'],
  'This row intentionally remains unresolved rather than converting repository evidence into unsupported production logging claims.',
  130
),
(
  'backups_replicas_exports_vendor_copies',
  'backups_vendor',
  'Backups, replicas, caches, archives, exports, recipient copies, and vendor-held copies',
  'mixed',
  'Supabase, Vercel/CDN/runtime layers, application exports, support/administrator systems, backups/replicas, and external processors',
  array[
    'database and Storage backups and point-in-time recovery',
    'replicas, snapshots, archives, and disaster-recovery copies',
    'application/CDN/browser/runtime caches',
    'member/admin/support/legal/operational exports',
    'recipient-controlled copies',
    'vendor/subprocessor copies'
  ],
  array[
    'Supabase backups, replicas, snapshots, archives, and PITR',
    'Vercel/CDN/application caches and logs',
    'platform-controlled export artifacts',
    'support, administrator, and Legal Operations export systems',
    'recipient-controlled downloaded/delivered copies',
    'external provider and subprocessor copies'
  ],
  'Trace each secondary copy back to its canonical source and copy owner. Distinguish platform-controlled copies from recipient-controlled copies, and record expected expiry or provider evidence rather than assuming immediate physical erasure or universal accessibility.',
  array['storage_backups_caches_exports_and_vendor_copies', 'infrastructure_security_and_incident_records'],
  array['Supabase', 'Vercel/CDN providers', 'external processors and subprocessors'],
  'unresolved',
  array[
    'Backup, replica, snapshot, archive, cache, export, and vendor-copy inventories and expiry schedules are not fully verified.',
    'Restoration behavior, regional storage, provider deletion controls, and subprocessor propagation require provider-specific verification.',
    'Recipient-controlled copies may be outside Loombus control after delivery.'
  ],
  array[
    'supabase/migrations/20260805063000_account_deletion_storage_vendor_copies_disposition.sql',
    'supabase/migrations/20260805070000_account_deletion_final_register_reconciliation.sql'
  ],
  'This row prevents the legal data map from implying that canonical database coverage equals complete copy coverage.',
  140
)
on conflict (source_key) do update set
  source_group = excluded.source_group,
  display_name = excluded.display_name,
  source_kind = excluded.source_kind,
  system_of_record = excluded.system_of_record,
  data_classes = excluded.data_classes,
  source_locations = excluded.source_locations,
  locator_contract = excluded.locator_contract,
  account_deletion_resource_keys = excluded.account_deletion_resource_keys,
  external_processors = excluded.external_processors,
  inventory_status = excluded.inventory_status,
  unresolved_items = excluded.unresolved_items,
  evidence_sources = excluded.evidence_sources,
  notes = excluded.notes,
  enabled = true,
  sort_order = excluded.sort_order,
  updated_at = now();

commit;
