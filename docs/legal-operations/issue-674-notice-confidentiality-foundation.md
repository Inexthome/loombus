# Issue #674 Member Notice & Confidentiality Decision-Control Foundation

## Scope

This phase establishes a restricted, draft-only workflow for the existing canonical Legal Operations fields:

- `public.legal_requests.confidentiality_notes`
- `public.legal_requests.member_notice_decision`
- `public.legal_requests.delayed_notice_basis`

It does not send a member notice, approve a final notice decision, lift confidentiality, generate an export, approve or transmit a disclosure, approve an emergency disclosure, or contact any external party.

## Existing source of truth preserved

The three existing `legal_requests` fields remain canonical. No parallel notice-decision table or second source of truth is introduced.

The foundation adds only control metadata:

- `notice_confidentiality_review_status`
- `notice_confidentiality_revision`

Allowed review states are deliberately limited to:

- `unreviewed`
- `draft`
- `requires_counsel`

There is no `approved`, `final`, `sent`, or equivalent state in this phase.

## Dedicated capability

`public.legal_operations_authorizations.can_review_notice_confidentiality` is added with `not null default false`.

Database authorization requires both:

- `can_review_requests=true`
- `can_review_notice_confidentiality=true`

The dedicated capability does not grant export, disclosure, emergency approval, final legal approval, notice sending, confidentiality release, or external transmission.

The shared application authorization query is intentionally unchanged. The new route checks the new capability directly so existing Legal Operations surfaces do not depend on the new migration column before the production database migration is applied.

## Database-authoritative separation

The shared `public.legal_enforce_request_review_authorization()` trigger remains authoritative.

General review fields continue to require `can_review_requests`.

Changes to any of the following additionally require the dedicated notice/confidentiality capability:

- `confidentiality_notes`
- `member_notice_decision`
- `delayed_notice_basis`
- `notice_confidentiality_review_status`
- `notice_confidentiality_revision`

The trigger preserves the protected-party coverage restored by PR #862 and the transparency-review coverage from PR #861.

## Revision-controlled workflow

Every notice/confidentiality change must increment `notice_confidentiality_revision` by exactly one.

This is a deliberate application-boundary control. The legacy/general request update path does not increment that revision marker, so an attempted change to notice/confidentiality content through that path fails closed at the database trigger even if the actor otherwise has review permissions.

The dedicated route performs an optimistic concurrency check against the current revision before updating.

## Draft semantics

`member_notice_decision` is presented by the restricted UI as a **draft member-notice recommendation**. It is not a final legal decision.

`delayed_notice_basis` is presented as a **draft delayed-notice basis**. Recording text does not itself authorize delay.

`confidentiality_notes` remain internal review notes and do not lift or modify confidentiality restrictions.

When any decision metadata is present, the dedicated route requires `draft` or `requires_counsel`. `unreviewed` may be used only when all three canonical text fields are empty.

Existing rows are not rewritten. If legacy draft text already exists, it remains untouched and defaults to `unreviewed`/revision `0` until a qualified reviewer explicitly moves it into this workflow.

## Restricted API and workspace

New route:

- `GET /api/admin/legal-operations/notice-confidentiality`
- `GET /api/admin/legal-operations/notice-confidentiality?requestId=<uuid>`
- `POST /api/admin/legal-operations/notice-confidentiality`

New workspace:

- `/admin/legal-operations/notice-confidentiality`

The route exposes only minimum request metadata plus the three canonical notice/confidentiality fields. It does not load member profiles, requester contact data, responsive records, messages, attachments, exports, disclosure artifacts, or preservation targets.

The only mutation operation is:

- `update_notice_confidentiality_draft`

Any other operation is rejected. There is no finalization or send operation.

## Audit behavior

Workspace access records:

- action: `legal_notice_confidentiality_workspace_view_attempt`
- target type: `legal_notice_confidentiality_workspace`
- surface: `/admin/legal-operations/notice-confidentiality`
- foundation version: `20260809074500`
- mode: `draft_only`
- final legal approval: false
- member notice sending: false
- external transmission: false

Request-specific reads and draft update attempts are also audited. Update audit metadata records field names, review status, and revision movement only. It does not copy free-text decision content into the global audit log.

The existing legal-request change trigger continues to provide transactional request-change history.

## Production rollout gates

Before enabling the dedicated capability in production:

1. Apply only `20260809074500_add_notice_confidentiality_decision_controls.sql`.
2. Run `scripts/verification/legal-notice-confidentiality-foundation-readiness.sql`; every check must PASS.
3. Verify the workspace fails closed while `can_review_notice_confidentiality=false`.
4. Verify a direct/generic-style notice-field change without a revision increment fails closed.
5. Enable only `can_review_notice_confidentiality` for exactly one existing fictional-workflow reviewer who already has `can_review_requests=true` and no export/disclosure/emergency authority.
6. Use only the existing fictional request for a controlled draft update.
7. Confirm revision increments by exactly one and the audit/event history contains no copied free-text content.
8. Confirm export, disclosure, emergency approval, final legal approval, notice sending, confidentiality release, and external transmission remain disabled.

## Explicitly deferred

The following remain outside this phase and require qualified counsel before implementation or activation:

- legal standards for when notice is required, prohibited, or delayed
- approval authority for a final notice decision
- timing rules for notice or delayed notice
- notice templates and member-facing wording
- confidentiality-release criteria
- member identity/contact resolution for notice delivery
- notice sending or delivery receipts
- external service/provider integrations for notice delivery
- public legal-request guidelines or timing promises

No real legal request, real member notice, disclosure, external contact, or external transmission should be used to validate this foundation.
