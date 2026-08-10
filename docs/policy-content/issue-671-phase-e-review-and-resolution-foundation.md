# Issue #671 Phase E Review and Resolution Foundation

Status: internal implementation record

Public publication authorized by this document: no

## Objective

Continue Issue #671 after the restricted structured preview by adding two missing safety contracts before any public route migration:

1. an exact version-specific human review record for the Accessibility candidate;
2. a reusable current-version and exact-version resolver contract that can later support canonical and archive routes without silently overwriting history.

This phase does not mark any reviewer approved and does not enable registry or archive routing.

## Baseline

Phase E is based on merged PR #878 and production commit:

`4ccbf9050a3820c28165f8be3592a6426e96cf91`

The existing candidate remains:

- document: `POLICY-ACCESSIBILITY`;
- version: `2026.07.18.1`;
- route: `/accessibility`;
- migration state: `registry_candidate`;
- status: `review`;
- audience: `public`;
- `publicReady=false`;
- `effectiveAt=null`;
- Product Owner review pending;
- Accessibility review pending;
- active publication blockers;
- blocking route-parity dependency.

The live `/accessibility` route remains the production source of truth.

## Version-specific review record

Adds:

`docs/policy-content/reviews/POLICY-ACCESSIBILITY-2026.07.18.1-review.md`

Both pending approval records now point to that exact review record through `noteReference`.

The record binds review to:

- document ID;
- version;
- source revision;
- payload path;
- canonical route;
- restricted preview route.

It separately defines Product Owner and Accessibility review scope.

No outcome is pre-populated.

## Approval boundary

This phase explicitly preserves both reviewer states as `pending`.

It does not infer approval from:

- merge;
- deployment;
- CI success;
- Vercel success;
- administrator status;
- Product Owner status alone;
- AI review;
- issue closure;
- prior version review.

A later registry change must identify an explicit review outcome for the same version and source revision before changing a reviewer state.

## Product Owner review scope

The Product Owner review record asks the reviewer to confirm:

- wording and meaning match the current public Accessibility page;
- all current sections remain present;
- Support and email links remain correct;
- no new product, legal, staffing, certification, or response-time promise was introduced;
- no current text was materially lost or rewritten;
- the preview is clearly non-public;
- there is no edit, approve, publish, schedule, notice, or route-switchover action.

## Accessibility review scope

The Accessibility review requires rendered review rather than static text parity alone.

It covers:

- heading hierarchy;
- keyboard navigation and focus;
- link semantics;
- zoom and reflow;
- mobile layout;
- screen-reader and semantic structure;
- Light, Dark, and System presentation;
- preview chrome not obscuring the policy content.

This phase does not claim those checks have been completed.

## Generic current-version resolver

Adds:

`src/lib/policy-content-resolver.ts`

The current-version resolver is repository-backed and fail-closed.

It requires:

- global `registryRoutingEnabled=true`;
- a known document family;
- family migration state `registry_managed`;
- exactly one publication-eligible effective version.

If no eligible effective version exists, resolution fails.

If more than one eligible effective version exists, resolution also fails rather than silently choosing one by array order.

This is important for scheduled activation and rollback safety.

## Exact historical-version resolver

The exact-version resolver is a separate path from current-version resolution.

It requires:

- global `archiveRoutingEnabled=true`;
- a known registry-managed family;
- exact version identity;
- status `effective` or `superseded`;
- the same identity, public-ready, audience, approval, source-revision, effective-date, and publication-blocker gate that applied to the public version.

A superseded version can therefore remain addressable after a later version becomes current without converting the historical URL into a mutable alias.

## Withdrawn versions

Phase E deliberately does not make `withdrawn` automatically archive-servable.

A version can be withdrawn before or after becoming effective, and the current registry does not yet carry enough explicit historical-publication evidence to distinguish those cases safely for public serving.

Until that lifecycle is defined, withdrawn versions fail closed at the resolver.

The underlying source-controlled record remains preserved.

## No route implementation yet

Phase E adds resolver functions only.

It does not add:

- a public archive route;
- a dynamic canonical registry route;
- redirects;
- route switchover logic;
- scheduled activation;
- publication controls;
- member notice controls.

Both production routing flags remain false.

## Automated verification

Adds:

`scripts/verification/verify-policy-resolution-foundation.mjs`

The verifier checks the production registry remains non-public and the Accessibility approvals remain pending.

It also runs synthetic resolver fixtures proving:

- disabled current routing fails closed;
- disabled archive routing fails closed;
- one eligible effective version resolves as current;
- an exact superseded version remains retrievable by immutable version identity;
- an exact current version can also be addressed by version identity;
- multiple eligible effective versions fail closed;
- review content cannot be served as historical content;
- an approval/source-revision mismatch blocks historical serving.

No real public policy version is activated for these fixtures.

## CI

Policy Content Governance is extended to watch the resolver and run the new verifier in addition to:

- registry verification;
- Accessibility exact-parity verification;
- restricted preview verification.

## Acceptance contribution

This phase advances the Issue #671 acceptance criteria for:

- specific-version targeting;
- preservation of a prior effective version after replacement;
- no silent overwrite of historical text;
- explicit review evidence bound to source revision;
- fail-closed current and archive resolution.

It does not claim the final public archive or canonical registry route is live.

## Next safe step

After this phase is merged, the next action depends on explicit review evidence.

If the deployed Accessibility candidate is explicitly approved for the Product Owner role and passes an actual Accessibility review for the exact source revision, a later narrow PR may:

- record only those review outcomes;
- clear only the review/parity blockers they actually satisfy;
- keep public routing disabled unless a separate route-switchover decision is approved.

If review identifies a difference or accessibility defect, the candidate must be corrected as a new revision and affected approvals must remain pending or become changes requested.

## Explicitly unchanged

- no public Accessibility wording change;
- no `/accessibility` route change;
- no registry routing enablement;
- no archive routing enablement;
- no approval state change;
- no effective date;
- no public-ready state change;
- no Support behavior change;
- no Search behavior change;
- no database migration;
- no member notice;
- no Issue #667, #670, or #674 capability change.
