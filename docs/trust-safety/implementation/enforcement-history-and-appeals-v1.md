# Platform Enforcement History and Appeals v1

Status: Implementation specification  
Issue: #665  
Prepared: July 27, 2026

## Purpose

This implementation establishes one canonical record for Loombus-wide enforcement decisions and one authenticated appeal workflow. It does not convert reports, Room resolutions, or automated safety signals into enforcement automatically.

## Data model

The migration creates four service-role-only tables:

- `enforcement_decisions`
- `enforcement_appeals`
- `enforcement_events`
- `enforcement_restoration_attempts`

Authenticated clients do not receive direct table privileges. Member and Admin interfaces use curated server routes so internal notes, reporter identities, victim details, evidence references, conflict records, and restoration diagnostics are not exposed.

## Automatically integrated targets

| Target | Decision capture | Restoration |
|---|---|---|
| Account warning, suspension, or ban | Database trigger on `profiles` account-enforcement fields | Account status restored to active |
| Admin-removed Discussion | Database trigger when an Admin soft-deletes another member's Discussion | Recoverable Discussion fields restored |
| Admin-removed Reply | Database trigger when an Admin soft-deletes another member's Reply | Recoverable Reply fields restored |

Member self-deletion does not create an enforcement decision.

Current warned, suspended, and banned accounts plus recoverable Admin-deleted Discussions and Replies are imported as legacy decisions. Legacy imports are not automatically appealable because the original actions did not use the canonical policy and notice contract.

## Explicitly manual targets in v1

The following target types can be represented in the canonical model, but decision creation and restoration remain manual until each product module receives a reviewed adapter:

- profile
- private message
- Room
- Marketplace listing
- Business
- Service
- Request
- Job
- Event
- Appointment

A reversed appeal for a manual target records `RST.PARTIAL` and creates a restoration exception. It does not silently claim that product state was restored.

## Member experience

Route: `/account/enforcement`

The member can review:

- decision ID and date
- affected target
- public reason family
- plain-language explanation
- action and current decision state
- policy document and version
- action end date where applicable
- appeal eligibility and deadline
- appeal status and outcome
- member-visible decision events
- restoration status and explanation

A restricted member remains authenticated for this route. Ordinary protected application routes and mutations continue to enforce account standing server-side.

An eligible member may submit one open appeal per decision. Statements must be 20 to 6,000 characters. Additional context is limited to 6,000 characters. The interface explicitly tells members not to re-upload harmful material.

## Admin experience

Route: `/admin/enforcement`

Administrators can:

- review open and decided appeals
- search by member, target, reason, action, or appeal
- inspect the canonical decision without reporter or victim identity disclosure
- assign a reviewer
- start review
- request additional information
- record upheld, modified, reversed, remanded, or unable-to-review outcomes
- document a conflict override when the original decision maker must participate
- inspect restoration exceptions

The original action remains effective during review. Modified outcomes require confirmation that the product action was completed separately. Reversed account, Discussion, and Reply decisions use automatic restoration adapters. Other targets create a manual-restoration exception.

## Conflict rule

When the current reviewer is the original decision actor, review or resolution is blocked unless the administrator records a conflict-override reason. The override is stored and audited. This provides an accountable exception without claiming that independent review is always available.

## Privacy boundaries

Member responses never expose:

- reporter identity
- victim or witness identity
- private Room report details
- internal notes
- reviewer notes
- evidence references
- security-sensitive detection information
- legal-request details
- restoration diagnostics beyond a member-safe status and message

## Notice behavior

Canonical decisions created by the database triggers have a pending notice state. The member-facing history is the authoritative in-product notice surface in v1. Existing Admin notification behavior remains unchanged. Appeal submission and appeal-state changes create notifications where the notification service is available.

A future delivery worker may add email or push notice retries without changing the decision contract.

## Deployment order

1. Deploy application code.
2. Apply `supabase/migrations/20260801100000_platform_enforcement_history_and_appeals.sql` once.
3. Confirm PostgREST schema reload completes.
4. Verify legacy import counts before allowing new Admin actions.
5. Confirm `/api/account/enforcement` and `/api/admin/enforcement` return private, non-cacheable responses.
6. Perform the production tests below.

The new pages will show a controlled error until the migration is applied. Do not describe the system as live before the migration and production tests complete.

## Production verification

### Account decisions

- warn a non-Admin test member
- confirm one canonical decision and one visible event
- confirm the warned member retains ordinary access
- suspend the member and confirm the prior decision is superseded
- confirm protected routes are denied while `/account/enforcement` remains available
- ban and restore the account
- confirm restoration state and profile status agree

### Discussion and Reply decisions

- Admin soft-delete another member's Discussion
- confirm the source record is recoverable and a decision exists
- Admin soft-delete another member's Reply
- confirm the same behavior
- self-delete content and confirm no enforcement decision is created
- reverse both decisions through an appeal and verify source restoration

### Appeals

- submit an eligible appeal
- reject a second simultaneous appeal for the same decision
- confirm deadline enforcement
- assign and start review
- confirm the original decision actor needs a conflict override
- request information
- record each outcome type in test data
- verify restrictions remain active until a reversed or manually modified outcome

### Restoration

- reverse account, Discussion, and Reply decisions
- verify automatic restoration and attempt records
- reverse a manual target and confirm `RST.PARTIAL`
- activate a legal hold in test data and confirm restoration is blocked
- confirm restoration exceptions appear in Admin operations

### Privacy and authorization

- signed-out requests receive `401`
- non-Admin requests to Admin routes receive `403`
- one member cannot retrieve or appeal another member's decision
- member responses contain no internal note, reporter, victim, reviewer note, or evidence field
- direct table access remains unavailable to `anon` and `authenticated`
- all responses use `private, no-store`

### Mobile and accessibility

- review member and Admin pages on phone, tablet, and desktop
- test Light, Dark, and System appearances
- test keyboard navigation and focus order
- test long reason, target, and appeal text
- test reduced motion
- verify labels, status, and outcome are not conveyed only by color

## Issue completion boundary

Issue #665 may be closed after:

- the migration is applied successfully
- automatic adapters pass production verification
- member and Admin routes pass authorization and privacy review
- appeal outcomes and conflict handling pass functional review
- restoration exception reporting is verified
- the module integration matrix remains published internally

This implementation does not authorize the public Enforcement and Appeals Policy by itself. Trust and Safety operations, retention, legal review, and versioned public policy publishing remain separate blockers.
