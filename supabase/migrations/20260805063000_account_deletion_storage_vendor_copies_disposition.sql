-- Issue #668: Storage, backups, replicas, caches, exports, and vendor-copy disposition.
-- This migration is disposition-only. It does not delete or rewrite Storage
-- objects, metadata, derivatives, caches, exports, backups, replicas, archives,
-- logs, or vendor copies. It adds no provider API call or worker dispatch.

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
  'storage_backups_caches_exports_and_vendor_copies',
  'Storage objects and metadata, generated derivatives, caches, exports, backups, replicas, archives, recipient copies, and vendor-held copies',
  'Supabase Storage and Database, Vercel and CDN/runtime layers, application exports, support and administrator systems, backups and replicas, and external processors',
  'manual_review',
  'storage_backups_caches_exports_and_vendor_copies',
  'manual_review',
  130,
  jsonb_build_object(
    'status', 'disposition_defined_handler_not_approved',
    'automatic_execution', false,
    'issue', 668,
    'phase', 'storage_vendor_copies_disposition',
    'first_party_scope', jsonb_build_array(
      'Supabase Storage buckets, objects, object metadata, signed URLs, and access evidence',
      'profile, discussion, message, Room, marketplace, business, service, appointment, moderation, and support attachments',
      'thumbnails, previews, resized images, transcoded media, converted documents, and extraction artifacts',
      'CDN, browser, edge, application, and runtime caches',
      'database and Storage backups, point-in-time recovery, snapshots, replicas, archives, and disaster-recovery copies',
      'member, administrator, support, legal, and operational exports'
    ),
    'external_processors', jsonb_build_array(
      'Supabase',
      'Vercel and CDN or edge providers',
      'email and push providers',
      'AI providers',
      'payment and mobile-store providers',
      'analytics and observability providers',
      'support, legal, and operational vendors'
    ),
    'required_sequence', jsonb_build_array(
      'inventory every first-party object, metadata row, derivative, cache, export, backup, replica, archive, recipient copy, and vendor copy linked directly or indirectly to the member',
      'classify each copy by ownership, recipient continuity, Room or organization continuity, evidence, transaction dependency, and public-content dependency',
      'resolve canonical source records before deleting derivatives or cached representations',
      'separate future-access revocation from historical-copy deletion',
      'delete or detach eligible first-party objects only through an approved object-specific contract that verifies references, shared ownership, and retention exceptions',
      'record unresolved backups, replicas, caches, exports, recipient copies, and vendor copies with reason, reviewer, provider, expected expiry, and evidence',
      'verify database references, Storage metadata, object availability, delivery systems, exports, caches, and vendor systems before recording terminal disposition'
    ),
    'decision_classes', jsonb_build_object(
      'member_exclusive_objects', 'Delete only after reference, evidence, billing, support, ownership, and legal checks clear.',
      'shared_or_recipient_objects', 'Preserve recipient continuity or transfer ownership where required; sender deletion is not authority to erase another person’s copy.',
      'room_or_organization_objects', 'Resolve Room ownership, governance, billing, document continuity, and staged Room deletion independently.',
      'evidence_objects', 'Retain the minimum required moderation, safety, fraud, dispute, support, security, or legal evidence under the approved schedule.',
      'derivatives_and_caches', 'Expire only after canonical source disposition and the applicable invalidation path are verified.',
      'backups_and_replicas', 'Track scheduled expiry and restoration behavior; do not claim immediate physical erasure without evidence.',
      'exports_and_downloads', 'Separate platform-controlled exports from copies already delivered to members, recipients, administrators, or authorities.',
      'vendor_copies', 'Require provider-specific deletion evidence, documented expiry, or an unresolved exception.'
    ),
    'exceptions', jsonb_build_array(
      'Trust and Safety, fraud, abuse, security, incident, or appeal matter',
      'legal hold, litigation, law-enforcement, regulator, audit, insurance, or preservation duty',
      'billing, refund, chargeback, tax, accounting, marketplace, appointment, service, or ownership dispute',
      'recipient, Room, organization, business, or administrator continuity',
      'support case or delivery dispute requiring attachments or exports',
      'unresolved references, shared ownership, incomplete derivative inventory, or unknown vendor copy',
      'unverified backup, replica, archive, cache, export, or vendor expiry'
    ),
    'prohibited_shortcuts', jsonb_build_array(
      'deleting a Storage object before confirming every database and application reference',
      'deleting a canonical object while retaining an active derivative that can reconstruct or expose it',
      'removing shared, recipient-controlled, Room, business, or organization content solely because one account closes',
      'using signed-URL expiry, cache invalidation, database deletion, or UI hiding as proof of object deletion',
      'using first-party deletion as proof that backups, replicas, exports, logs, or vendors expired',
      'purging moderation, fraud, security, billing, dispute, support, or legal evidence without an approved retention decision',
      'dispatching an account-deletion worker or provider deletion call from this resource'
    ),
    'verification_requirements', jsonb_build_array(
      'production bucket, object, metadata, derivative, and reference inventory',
      'object-class ownership and recipient-continuity rules',
      'verified deletion and invalidation contracts for each Storage and cache path',
      'backup, replica, snapshot, archive, and point-in-time recovery schedules',
      'restoration behavior that does not silently reactivate deleted member access',
      'export inventory and lifecycle controls',
      'vendor and subprocessor copy inventories with deletion or expiry evidence',
      'exception reports containing retained copy, reason, reviewer, provider, expected expiry, and verification result'
    ),
    'feature_flags', jsonb_build_object(
      'account_deletion', 'ACCOUNT_DELETION_DESTRUCTIVE_HANDLERS_ENABLED is unchanged and does not authorize Storage, metadata, derivative, cache, export, backup, replica, archive, provider, or vendor-copy mutation.'
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
'Executable account-deletion inventory. Storage, backups, replicas, caches, exports, archives, recipient copies, and vendor copies remain manual-review only until object-specific deletion, ownership, evidence, provider, expiry, restoration, and verification prerequisites are satisfied.';
