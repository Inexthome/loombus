# Storage, Backup, Cache, Export, and Vendor-Copy Disposition

Issue: #668
Status: Disposition defined, handler not approved
Execution mode: Manual review only

## Purpose

This phase defines how account deletion must treat Supabase Storage objects, object metadata, generated derivatives, CDN and runtime caches, exports, backups, replicas, archives, support attachments, and remaining vendor-held copies.

Account deletion is not proof that every binary object, cached response, backup block, export, replica, or vendor copy has expired. Each copy class requires its own verified disposition.

## Scope

The review covers:

- Supabase Storage buckets, objects, object metadata, signed URLs, and access logs
- profile images, discussion attachments, message attachments, Room documents, marketplace media, business media, appointment media, moderation evidence, and generated derivatives
- thumbnails, previews, transcoded media, resized images, document conversions, and search or AI extraction artifacts
- CDN, browser, edge, application, and runtime caches
- database and Storage backups, point-in-time recovery, replicas, snapshots, archives, and disaster-recovery copies
- member exports, administrator exports, support exports, legal exports, and locally downloaded copies
- Vercel, Supabase, email, push, AI, payment, analytics, observability, support, and other processor copies

## Required sequence

1. Inventory every first-party object and metadata row linked directly or indirectly to the member.
2. Classify each object by ownership, recipient continuity, Room or organization continuity, moderation or legal evidence, transaction dependency, and public-content dependency.
3. Resolve canonical source records before deleting derivatives or cached representations.
4. Revoke future access separately from deleting historical copies.
5. Delete or detach eligible first-party objects only through an approved object-specific contract that verifies references, shared ownership, and retention exceptions.
6. Record unresolved backups, replicas, caches, exports, recipient copies, and vendor copies as explicit exceptions with expected expiry or provider evidence.
7. Verify the final state across database references, Storage metadata, object availability, delivery systems, exports, caches, and vendor systems.

## Decision classes

- **Member-exclusive objects:** Eligible for deletion only after reference, evidence, billing, support, and legal checks clear.
- **Shared or recipient-controlled objects:** Preserve recipient continuity or transfer ownership where required; do not treat sender deletion as authority to erase another person’s copy.
- **Room or organization objects:** Resolve Room ownership, document continuity, billing, governance, and staged Room deletion independently.
- **Moderation, safety, fraud, dispute, or legal evidence:** Retain the minimum required evidence under the approved schedule and legal-hold controls.
- **Derived files and caches:** Expire only after the canonical source disposition is verified and the applicable cache or derivative invalidation path is approved.
- **Backups and replicas:** Track scheduled expiry and restoration behavior; do not claim immediate physical erasure when the platform cannot prove it.
- **Exports and downloaded copies:** Record platform-controlled exports separately from copies already delivered to members, administrators, recipients, or authorities.
- **Vendor-held copies:** Require provider-specific evidence, documented expiry, or an unresolved exception.

## Exceptions

Manual review must preserve or delay disposition for:

- active Trust and Safety, fraud, abuse, security, incident, or appeal matters
- legal holds, litigation, law-enforcement, regulator, audit, insurance, or preservation duties
- billing, refund, chargeback, tax, accounting, marketplace, appointment, service, or ownership disputes
- recipient, Room, organization, business, or administrator continuity
- support cases or delivery disputes requiring attachments or exports
- unresolved references, shared ownership, incomplete derivative inventories, or unknown vendor copies
- backup, replica, archive, cache, or export expiry that has not been verified

## Prohibited shortcuts

Do not:

- delete a Storage object before confirming every database and application reference
- delete a canonical object while retaining an active derivative that can reconstruct or expose it
- remove shared, recipient-controlled, Room, business, or organization content solely because one account closes
- treat signed-URL expiry, cache invalidation, database-row deletion, or UI hiding as proof of object deletion
- treat first-party deletion as proof that backups, replicas, exports, logs, or vendors expired
- purge moderation, fraud, security, billing, dispute, support, or legal evidence without an approved retention decision
- dispatch an account-deletion worker or provider deletion call from this disposition record

## Verification requirements

Before any automated handler can be approved, Loombus must have:

- a production bucket, object, metadata, derivative, and reference inventory
- object-class ownership and recipient-continuity rules
- verified deletion and invalidation contracts for each Storage and cache path
- backup, replica, snapshot, archive, and point-in-time recovery schedules
- restoration behavior that does not silently reactivate deleted member access
- export inventory and lifecycle controls
- vendor and subprocessor copy inventories with deletion or expiry evidence
- exception reporting that records retained copies, reason, reviewer, provider, expected expiry, and verification result

## Safety boundary

This disposition adds no Storage deletion, metadata mutation, cache purge, export deletion, backup or replica purge, provider API call, worker dispatch, or feature-flag change. `ACCOUNT_DELETION_DESTRUCTIVE_HANDLERS_ENABLED` remains unchanged.
