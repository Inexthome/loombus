# Issue #674 Phase 2: restricted Legal Operations workspace

Status: internal implementation phase

Public ready: no

Qualified legal review: required

## Purpose

This phase adds an internal server API and admin workspace on top of the Phase 1 legal-operations storage foundation. It is an operating-control surface, not a public law-enforcement guideline and not a statement of legal obligations.

## Access boundary

`/admin/legal-operations` and `/api/admin/legal-operations` require both:

1. `profiles.is_admin = true`, and
2. an active, non-revoked row in `legal_operations_authorizations` for the authenticated user.

Operations are additionally gated by explicit capability flags. Phase 2 uses `can_intake` for legal-request handling and `can_preserve` for preservation-hold operations.

An administrator who is not separately authorized for Legal Operations receives no workspace data.

## Phase 2 enabled operations

- list and review restricted legal-request metadata
- create a legal-request intake record
- record identity, authority, scope, cross-border, deficiency, rejection, confidentiality, and notice-review metadata
- create draft preservation holds
- add append-only preservation targets while a hold is still draft
- activate a hold only after at least one target exists
- release an active hold
- mark an active hold expired only after its recorded expiration time
- append handling, note, and specialist-routing events

Request-detail access writes an append-only `legal_request_events` access record before returning the detail payload. Workspace and mutation attempts also require a global `audit_logs` write to succeed before the action continues.

## Deliberately disabled

Phase 2 does not provide an operation that:

- exports account, Room, message, Storage, billing, support, Search, AI, or other source data
- creates or modifies disclosure manifests
- approves a disclosure
- marks an emergency disclosure approved
- transmits data to an outside party
- sends a member notice
- contacts a requester, agency, court, regulator, copyright claimant, or other outside party
- uploads or stores raw legal-process documents in the Legal Operations tables
- changes public content visibility or member access
- bypasses account-deletion or Room-deletion controls
- changes either destructive feature flag

The server route explicitly rejects known disclosure/export/transmission operation names during this phase.

## Counsel boundary

The workspace may record factual review state, but Phase 2 does not make a legal conclusion. Counsel approval remains an Issue #674 acceptance gate. The UI intentionally does not provide a control that records counsel approval or disclosure approval.

## Authorization bootstrap

Phase 2 does not auto-appoint any Legal Operations user. `legal_operations_authorizations` remains the canonical authorization source. Initial access must be bootstrapped separately through a controlled, explicit operation after this code is deployed and verified.

No self-service authorization route is introduced.

## Next gates

After deployment and controlled authorization bootstrap:

1. verify fail-closed unauthorized and capability-denied behavior in production
2. run fictional intake, preservation, scope-narrowing, deficiency, release, and emergency-review scenarios
3. implement controlled export-package generation and integrity verification as a separate phase
4. integrate active legal holds into approved destructive/expiry paths
5. complete qualified counsel review of procedures and templates
6. consider public policy/guideline publication only after operating controls and legal review are complete
