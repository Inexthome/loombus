# Issue #674 — Emergency Review Decision-Control Foundation

## Status

Foundation-only implementation for internal Legal Operations review. This phase does **not** define substantive emergency-disclosure criteria, approve an emergency disclosure, collect responsive data, generate an export, contact an outside party, or transmit anything externally.

Qualified counsel review remains required before any substantive emergency standard, approval workflow, external coordination procedure, disclosure execution, or public emergency-disclosure guidance.

## Audit finding

The existing Legal Operations foundation already distinguishes `can_approve_emergency` from ordinary intake/review authority, and production keeps that approval capability disabled.

However, the canonical `legal_requests.emergency_criteria_summary` field remained inside the general request-review workflow. A reviewer with `can_review_requests` could therefore attempt to change emergency assessment text without a dedicated emergency-review capability or emergency-specific revision boundary.

That is a separation-of-duties gap even while emergency approval remains disabled.

## Narrow scope

This phase adds only draft assessment controls:

- `can_review_emergency boolean not null default false`
- `legal_requests.emergency_review_status`
- `legal_requests.emergency_review_revision`
- a dedicated database trigger for emergency-review changes
- a restricted `/admin/legal-operations/emergency-review` workspace
- a read-only production readiness verifier

The only review states are:

- `unreviewed`
- `draft`
- `requires_counsel`

There is no `approved`, `final`, `authorized`, `transmitted`, or equivalent state.

## Canonical field preserved

No parallel emergency-assessment table is introduced. `legal_requests.emergency_criteria_summary` remains the canonical internal field.

In this phase its meaning is explicitly limited to a **draft internal emergency-request assessment summary**. It is not an approved legal threshold and does not authorize any downstream action.

## Database-authoritative separation

A separate `legal_enforce_emergency_review_authorization()` trigger protects:

- `emergency_criteria_summary`
- `emergency_review_status`
- `emergency_review_revision`

Every change requires:

1. an identified `updated_by` actor;
2. active `can_review_requests=true`;
3. active `can_review_emergency=true`;
4. `emergency_review_revision` to increment by exactly one.

The shared legal-request review trigger remains untouched and continues to protect `emergency_criteria_summary` with `can_review_requests` as an additional defense-in-depth layer.

The emergency-specific trigger is intentionally separate rather than replacing the shared review function. This preserves the protected-party, transparency, and notice/confidentiality coverage that was previously repaired and production-verified.

## Generic update path fails closed

The legacy/general request-update path does not increment `emergency_review_revision`. Therefore an attempted change to `emergency_criteria_summary` through that path fails at the database boundary, even when the actor otherwise has general request-review authority.

Only the dedicated emergency-review route supplies the required emergency revision transition.

## Restricted workspace

The new workspace and API are limited to request records whose `request_type` is `emergency_disclosure`.

The route exposes minimum request metadata plus the draft emergency assessment field. It does not query:

- member profiles or member content
- responsive source records
- messages or attachments
- Storage objects
- export packages or artifacts
- disclosure payloads
- recipient contact details
- external reporting systems

The only mutation operation is `update_emergency_review_draft`.

Any approval, disclosure, export, contact, send, or transmission operation is absent from this route.

## Audit behavior

Successful workspace access records `legal_emergency_review_workspace_view_attempt` with:

- surface `/admin/legal-operations/emergency-review`
- foundation version `20260809081500`
- mode `draft_only`
- criteria standard approved = false
- emergency approval enabled = false
- external contact enabled = false
- external transmission enabled = false

Draft update-attempt audit metadata records only field names, review status, and revision movement. Draft free text is not copied into the global audit record.

## Production readiness

Run `scripts/verification/legal-emergency-review-foundation-readiness.sql` after the migration is applied. Every row must return `PASS` before controlled UI validation.

The verifier checks, among other things:

- dedicated capability presence and default-off state
- draft-only status and revision defaults
- no existing request auto-advanced into emergency review
- no approved/final review state
- SECURITY DEFINER emergency-review trigger boundary
- exact revision control and dedicated capability enforcement
- shared review protection for the emergency summary remains present
- protected-party coverage remains present
- transparency coverage remains present
- notice/confidentiality dedicated coverage remains present
- no browser execute privilege on the emergency trigger function
- no emergency approval/transmission RPCs
- `can_export=0`
- `can_disclose=0`
- `can_approve_emergency=0`

## Controlled production order

1. Merge and deploy the application changes only after CI and preview validation.
2. Run `supabase db push --linked --dry-run` and require the only pending migration to be `20260809081500_add_emergency_review_decision_controls.sql`.
3. Apply only that migration.
4. Run the readiness verifier and require every row to return `PASS`.
5. While `can_review_emergency=false`, verify `/admin/legal-operations/emergency-review` denies access.
6. If controlled UI review is still desired, enable only `can_review_emergency` for the single established fictional-workflow Legal Reviewer using a fail-closed one-row update.
7. Reconfirm `can_export=0`, `can_disclose=0`, and `can_approve_emergency=0` before opening the workspace.
8. Validate the metadata-only workspace. Do not create a real emergency request or use real member data.
9. Verify the workspace-view audit record read-only.

A positive draft mutation test is **not required** for this phase if no fictional emergency-disclosure request already exists. Do not create one merely to exercise the editor unless a separately controlled fictional test is explicitly chosen.

## Explicitly deferred

The following remain outside this phase:

- substantive emergency-disclosure legal criteria or thresholds
- emergency approval authority or approval workflow
- `can_approve_emergency` enablement
- child-safety or imminent-danger external coordination procedures
- assignment of emergency or child-safety external-contact owners
- requester or recipient external contact
- source-data collection
- export generation
- disclosure approval or execution
- external transmission
- member-notice sending
- fixed emergency response-time promises
- public law-enforcement or emergency-disclosure guidelines
- any destructive account or Room deletion enablement

`ACCOUNT_DELETION_DESTRUCTIVE_HANDLERS_ENABLED` and `ROOM_PERMANENT_DELETION_ENABLED` must remain disabled.
