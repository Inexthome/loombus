# Issue #674: Legal Request Review Capability

## Purpose

This phase separates legal-request review authority from intake authority before any downstream export or disclosure phase.

The existing Legal Operations workspace already records identity, authority, scope, deficiency/rejection, cross-border, conflicting-law, confidentiality, member-notice-decision, delayed-notice, emergency-criteria, and transparency metadata. Before this phase, the existing `update_request` operation was application-gated by `can_intake`, which made intake authority broader than necessary.

## New least-privilege boundary

`can_review_requests` is added to `public.legal_operations_authorizations` with `not null default false`.

A database trigger on `public.legal_requests` is the authoritative enforcement layer. If a review-sensitive field changes, the `updated_by` actor must have an active, non-revoked Legal Operations authorization with `can_review_requests=true`.

Protected review-sensitive fields include:

- request workflow status;
- requester identity review status and summary;
- jurisdiction and asserted-authority metadata;
- authority review status and summary;
- narrowed scope and scope-review status;
- counsel-review status storage;
- deficiency and rejection reasons;
- emergency-criteria summary metadata;
- cross-border and conflicting-law metadata;
- confidentiality metadata;
- member-notice decision and delayed-notice metadata;
- aggregate transparency classification fields.

The trigger applies to every service-side UPDATE path, not just the current browser/API surface.

## What this phase does not authorize

This phase does not authorize or implement:

- qualified-counsel approval;
- export generation or source-data collection;
- export packages, files, hashes, or responsive payloads;
- disclosure approval;
- emergency-disclosure approval;
- member-notice sending;
- external contact or transmission;
- public law-enforcement or emergency-disclosure guidelines.

`can_export`, `can_disclose`, and `can_approve_emergency` must remain false during controlled testing.

## Controlled deployment order

1. Keep `ACCOUNT_DELETION_DESTRUCTIVE_HANDLERS_ENABLED` disabled.
2. Keep `ROOM_PERMANENT_DELETION_ENABLED` disabled.
3. Keep current Legal Operations capability assignments unchanged during migration deployment.
4. Apply `20260809042000_add_legal_request_review_capability.sql`.
5. Run `scripts/verification/legal-request-review-capability-readiness.sql` and require every row to return `PASS`.
6. Before enabling review authority, use the existing fictional request only to verify that a review-field update is rejected while `can_review_requests=false`.
7. Enable only `can_review_requests` for the single already-authorized fictional-workflow reviewer with a fail-closed one-row update.
8. Re-test a harmless fictional review-metadata change and confirm the existing request audit history records the update.
9. Keep export, disclosure, emergency approval, notice sending, and external transmission disabled.

No real legal request, member data, legal authority, requester contact, responsive content, export, disclosure, notice, or external transmission belongs in this phase.

Qualified counsel review remains required before any downstream approval, actual disclosure, or public-guideline phase.
