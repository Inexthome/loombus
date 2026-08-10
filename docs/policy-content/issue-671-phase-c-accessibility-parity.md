# Issue #671 Phase C: Accessibility Structured Payload and Parity Gate

Status: internal implementation record

Issue: #671

Public route switchover authorized by this phase: no

Public policy text changed by this phase: no

Supabase migration required: no

## Objective

Create the first immutable structured policy payload under the Issue #671 versioned-content system without changing the current public route, public wording, public effective state, or approval state.

The selected first family is `POLICY-ACCESSIBILITY` at `/accessibility` because the current route is comparatively low-risk for migration mechanics: it is public, static, already uses the shared `PublicPolicyPage` renderer, has stable section IDs, exposes no account-specific data, and already supports the existing responsive/theme presentation.

This phase proves the content migration and parity controls before a shared registry renderer or public route migration is attempted.

## Baseline

Phase C starts from merged/deployed PR #876, merge commit:

`1d7d7f3ac1d8f681f34d18b3fa81363b0cdf3546`

The current Accessibility route remains:

`src/app/accessibility/page.tsx`

Its Git blob identity at the Phase C baseline is:

`21b0c0eb9504012d8926dc73dcb88d5591a17780`

The structured candidate records that source revision as:

`git-blob:21b0c0eb9504012d8926dc73dcb88d5591a17780`

If the legacy route changes, the parity verifier fails until the payload and migration decision are reviewed again.

## New immutable payload

Phase C adds:

`src/content/policies/POLICY-ACCESSIBILITY/2026.07.18.1.json`

The payload uses:

- `schemaVersion = policy_payload.v1`
- `documentId = POLICY-ACCESSIBILITY`
- `version = 2026.07.18.1`
- canonical route `/accessibility`
- exact current page metadata
- exact current eyebrow/title/description
- exact current reviewed date
- no invented effective date
- all 19 current section IDs in current order
- structured paragraph and bullet-list blocks
- structured internal and mailto links for the existing accessibility-report paragraph
- exact current public wording rather than a rewrite

The payload is a migration candidate only. It is not served by a public route in this phase.

## Registry state

The Accessibility family changes only from:

`legacy_public_route`

to:

`registry_candidate`

It does not become `registry_managed`.

The candidate version remains:

- status `review`
- audience `public`
- `publicReady=false`
- `effectiveAt=null`
- required Product Owner review pending
- required Accessibility review pending
- route-parity dependency blocking
- registry-route-switchover blocker active
- Accessibility parity/review blocker active

A successful build, merge, deployment, or parity check does not convert either pending review into approval.

## Routing state

These global controls remain false:

- `registryRoutingEnabled=false`
- `archiveRoutingEnabled=false`

The current `/accessibility` page remains the sole public source of truth.

This phase adds no dynamic route, archive route, resolver route, redirect, middleware rule, or public loader.

## Exact parity verifier

Phase C adds:

`scripts/verification/verify-policy-accessibility-parity.mjs`

The verifier fails closed on the following classes of drift:

1. the Accessibility registry family disappears or changes route/source identity;
2. the family becomes `registry_managed` early;
3. global registry or archive routing is enabled;
4. the candidate becomes public-ready or effective;
5. an approval is recorded merely because migration work exists;
6. active publication blockers disappear;
7. the payload file, document ID, version, canonical route, or source path changes unexpectedly;
8. the exact legacy Git blob revision no longer matches the candidate/payload source revision;
9. public page metadata changes;
10. the existing reviewed date changes or an effective date is introduced;
11. the 19 section IDs or their ordering changes;
12. a section title, paragraph, bullet, or supported link is missing or out of order relative to the current route;
13. an unsupported payload block/inline type is introduced;
14. an external arbitrary link is introduced into this initial payload;
15. the legacy `/accessibility` route is already wired to policy-registry or structured-payload code.

The parity verifier checks more than seventy ordered text fragments against the legacy route while the exact source-revision binding catches any other route-source change.

## CI integration

The existing `Policy content governance` workflow is expanded to watch:

- `src/content/policies/**`
- the Accessibility parity verifier

and to run both:

1. the general policy-content registry verifier;
2. the Accessibility payload parity verifier.

This keeps the first candidate under the same fail-closed governance workflow introduced in Phase B.

## No substantive accessibility decision

This phase does not decide whether any current Accessibility statement should be changed, strengthened, removed, or legally characterized differently.

It copies the current public route into a structured candidate for migration testing only.

Any later substantive edit is a separate content/version decision and must not be smuggled into a route migration.

## Explicitly unchanged

This phase does not:

- modify `src/app/accessibility/page.tsx`;
- alter current Accessibility wording;
- add an effective date;
- mark the candidate approved;
- mark the candidate public-ready;
- enable registry routing;
- enable archive routing;
- publish a historical version route;
- create a shared public registry renderer;
- change Search indexing;
- change Support behavior;
- send a member notice;
- change another policy family;
- change Issue #667, #670, or #674 capability state;
- add a database or Supabase migration.

## Validation target

Before merge, require:

- Policy content governance workflow pass;
- Accessibility parity verifier pass;
- TypeScript/build/security checks pass where triggered;
- Vercel preview success;
- diff confirms `src/app/accessibility/page.tsx` is unchanged;
- registry and archive routing remain false.

No production member action or real data is needed to validate this phase.

## Next phase

After Phase C is merged and deployed, Phase D can add a shared structured payload contract/renderer and a non-public preview/parity surface for the Accessibility candidate.

Even then, `/accessibility` should remain on the legacy route until explicit Product Owner and Accessibility review, renderer parity, mobile/accessibility review, archive behavior, and a separately reviewed route-switchover PR are complete.
