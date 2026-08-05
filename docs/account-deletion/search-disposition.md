# Search account-deletion disposition

Status: engineering disposition only. No retention duration or legal basis is approved by this document.

Issue: #668
Evidence date: 2026-08-04

## Scope

This phase records the account-deletion boundary for Everything Search without adding a Search mutation handler or account-deletion worker dispatch.

The reviewed server-side Search index is `public.loombus_search_documents`. It is derived from owning source records and includes source identity, entity identity, optional owner identity, visibility, lifecycle status, destination, searchable text, metadata, source timestamps, and the generated search vector.

The registered source families reviewed through Search Operations are:

- Discussions, Replies, summaries, and Discussion attachments
- profiles
- Rooms, Room posts, announcements, events, module records, and resources
- Businesses and business services
- Jobs
- Marketplace listings
- public Events
- Requests
- provider Services
- static platform pages

## Current Search controls

Search documents are synchronized through source-specific indexing functions and triggers. The administrator Search Operations workflow can rebuild one registered source family or repair one derived document from its owning source.

Those controls are operational repair tools. They are not an account-deletion procedure and are not proof that every user-visible, cached, logged, backed-up, or vendor-held copy has been handled.

An eligible owning source can recreate a deleted Search document. For that reason, Search handling must follow the approved source disposition rather than treating the derived index as the source of truth.

## Required disposition sequence

1. Resolve the owning record first. Determine whether the source is preserved, anonymized, deleted, transferred, or retained under an exception.
2. Preserve Search and source evidence while moderation, safety, fraud, security, dispute, legal-hold, recipient-continuity, or ownership review remains open.
3. After approved source handling, regenerate or remove the derived Search record through its source-owned indexing contract.
4. Verify the result through every applicable Search visibility path, including public, authenticated, premium, private-owner, and Room-member access.
5. Verify connected projections separately, including Local Discovery, Search briefs, grounded AI source sets, runtime caches, CDN caches, logs, analytics, backups, replicas, and vendor copies.
6. Record the source identifier, Search document identifier, verification queries, before-and-after results, cache evidence, reviewer, and unresolved copies on the account-deletion disposition.

## Recent searches and telemetry

The reviewed Everything Search interface stores recent-search history on the member device. A server-side account-deletion process cannot prove removal from a browser or device controlled by the member. Product disclosures must distinguish this device-local state from server-retained account data.

The reviewed Search implementation did not establish a canonical first-party query-log table or click-log table. This is a bounded repository finding, not proof that no telemetry exists. Production Vercel, Supabase, analytics, observability, security, fraud, and incident systems require a separate read-only inventory before any retention or deletion claim is approved.

## Separate resources

The following remain separate dispositions and cannot be inferred from a Search-row result:

- owning source records and attribution
- Local Discovery fields and location anchors
- Search briefs and summaries
- Ask Loombus AI prompts, outputs, grounded-source payloads, and provider copies
- application, edge, and CDN caches
- Vercel and Supabase logs
- analytics, security, fraud, support, and incident telemetry
- backups and replicas
- member-controlled device storage
- external processors and vendor copies

## Safety boundary

Migration `20260805034000_account_deletion_search_disposition.sql` adds one manual-review registry entry only.

It does not:

- delete, anonymize, rewrite, archive, or re-rank a Search document
- invoke `admin_rebuild_loombus_search_source`
- invoke `admin_repair_loombus_search_document`
- change an owning source record
- clear an application or CDN cache
- delete a query log, click log, analytics record, log, backup, replica, or vendor copy
- add an account-deletion worker dispatch
- change `ACCOUNT_DELETION_DESTRUCTIVE_HANDLERS_ENABLED`

Deployment alone cannot modify Search data.
