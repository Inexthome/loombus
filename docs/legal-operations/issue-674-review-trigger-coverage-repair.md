# Issue #674 Legal Request Review Trigger Coverage Repair

## Purpose

Restore the authoritative database authorization coverage for protected-party review metadata after the aggregate transparency-reporting migration replaced `public.legal_enforce_request_review_authorization()` with a definition that did not include the protected-party fields introduced by PR #857.

## Regression identified

The application-level protected-party workspace still required Legal Operations access, but the shared database trigger no longer treated these columns as review-sensitive changes:

- `privilege_review_status`
- `privilege_review_summary`
- `reporter_protection_status`
- `reporter_protection_summary`
- `victim_protection_status`
- `victim_protection_summary`
- `unrelated_member_minimization_status`
- `unrelated_member_minimization_summary`

That weakened the intended defense-in-depth contract because direct service-side updates to only those fields would not invoke the `can_review_requests` authorization decision inside the trigger function.

## Repair

Migration `20260809073000_restore_legal_request_review_trigger_coverage.sql` replaces the trigger function with the complete current review-field set. It preserves:

- identity, authority, scope, deficiency/rejection, cross-border, confidentiality, and member-notice metadata
- all protected-party and unrelated-member minimization metadata
- transparency classification and `transparency_review_status`
- the existing `can_review_requests` requirement
- SECURITY DEFINER execution with a fixed `public` search path
- browser-role execute revocation

The existing trigger `legal_requests_enforce_review_authorization` remains the authoritative `BEFORE UPDATE` boundary.

## Explicitly unchanged

This repair does not:

- create or modify legal requests
- change any existing request values
- grant or revoke operator capabilities
- enable export generation
- enable disclosure approval or transmission
- enable emergency approval
- send member notices
- enable external transmission
- change preservation holds
- change transparency aggregation or publication
- enable destructive account or Room deletion

## Verification

Run `scripts/verification/legal-request-review-trigger-coverage-readiness.sql` after the migration. Every check must PASS before continuing Issue #674 work.

The repair should be deployed and production-verified before the Member Notice & Confidentiality Decision-Control Foundation is built on top of the shared request-review trigger.
