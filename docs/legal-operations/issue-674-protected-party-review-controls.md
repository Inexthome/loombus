# Issue #674: Protected Party Review Controls

## Purpose

This phase adds restricted metadata controls for four review areas that can materially affect lawful scope and least-data handling:

- privilege;
- reporter protection;
- victim protection;
- unrelated-member minimization.

These controls are review metadata only. They do not authorize or generate an export, disclosure, emergency disclosure, member notice, or external transmission.

## Data model

`public.legal_requests` gains four status fields and four minimum-necessary summary fields:

- `privilege_review_status`
- `privilege_review_summary`
- `reporter_protection_status`
- `reporter_protection_summary`
- `victim_protection_status`
- `victim_protection_summary`
- `unrelated_member_minimization_status`
- `unrelated_member_minimization_summary`

Protected-party status values are constrained to:

- `unreviewed`
- `pending`
- `not_identified`
- `identified`
- `requires_counsel`
- `resolved`

Unrelated-member minimization status values are constrained to:

- `unreviewed`
- `pending`
- `not_applicable`
- `required`
- `completed`
- `requires_counsel`

Each summary is limited to 4,000 characters. The summaries are not an evidence repository and must not be used to paste communications, message bodies, attachments, exported records, responsive content, or unnecessary protected-party identifiers.

## Authorization boundary

The existing database-authoritative `legal_enforce_request_review_authorization()` trigger is extended to cover all eight new fields.

A protected-party or unrelated-member review change therefore requires:

- a non-null `updated_by` actor;
- an active, non-revoked Legal Operations authorization for that actor;
- `can_review_requests=true`.

The dedicated API route also requires `can_review_requests` before list, detail, or update access.

This phase does not grant or change any authorization row.

## Audit behavior

The existing `log_legal_request_change()` append-only request-history trigger is extended to record the previous and resulting status values for all four review areas.

The append-only event details intentionally record status transitions only. The four free-text summaries are not duplicated into request-history event JSON.

The dedicated API also writes global audit attempts for workspace views, request-detail views, and protected-party review updates. Request-detail access fails closed if its append-only access event cannot be written.

## Restricted workspace

The internal workspace is:

`/admin/legal-operations/protected-party-review`

It exposes only:

- restricted legal-request identifiers and limited review metadata;
- the four protected-party/minimization statuses;
- the four minimum-necessary summaries;
- a single update operation for those eight fields.

The route does not implement:

- request creation;
- preservation-hold creation or release;
- source-data collection;
- export generation;
- export package or hash generation;
- disclosure approval;
- emergency-disclosure approval;
- member-notice sending;
- external contact or transmission.

## Controlled production validation

1. Keep `ACCOUNT_DELETION_DESTRUCTIVE_HANDLERS_ENABLED` disabled.
2. Keep `ROOM_PERMANENT_DELETION_ENABLED` disabled.
3. Keep `can_export=false`, `can_disclose=false`, and `can_approve_emergency=false`.
4. Apply `20260809051000_add_protected_party_review_controls.sql`.
5. Run `scripts/verification/legal-protected-party-review-readiness.sql` and require every row to return `PASS`.
6. Use only fictional request `LR-2026-000001` for controlled testing.
7. Record harmless fictional statuses and summaries with no real protected-party identity or responsive content.
8. Refresh and confirm the metadata persisted.
9. Verify a `legal_request_updated` append-only request event records the four status values but does not copy the summary text into event details.
10. Verify export, disclosure, and emergency approval authority remain disabled.

## Legal review gate

Qualified counsel review remains required before downstream approval, actual disclosure, emergency-disclosure operations, or public law-enforcement/emergency-disclosure guidance is authorized.
