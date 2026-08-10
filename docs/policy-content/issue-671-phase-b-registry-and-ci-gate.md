# Issue #671 Phase B: Typed Registry and CI Publication Gate

Status: internal engineering foundation

Issue: #671

Public route migration authorized by this phase: no

Public archive routing authorized by this phase: no

## Objective

Implement the first executable version of the Issue #671 versioned-content contract without changing any current public policy, Safety, Help, Support, or Trust and Reference route.

This phase creates a repository-backed registry, typed publication-eligibility helpers, a static verifier, and a CI drift gate. It proves the publication boundary before any internal draft is connected to a public route.

## Files

- `src/lib/policy-content-registry.data.json`
- `src/lib/policy-content-registry.ts`
- `scripts/verification/verify-policy-content-registry.mjs`
- `.github/workflows/policy-content-governance.yml`
- this implementation record

No database migration is included.

## Current public route treatment

The registry records the current canonical public route families as migration metadata only.

Each current route remains sourced from its existing page component. The initial migration state is `legacy_public_route`, and every family has zero registry-managed versions.

The registry-level switches are both disabled:

- `registryRoutingEnabled=false`
- `archiveRoutingEnabled=false`

Therefore importing the registry or adding metadata cannot replace `/privacy`, `/terms`, `/cookies`, `/guidelines`, `/safety`, `/dmca`, `/refunds`, `/accessibility`, `/support`, `/settings/guide`, `/about`, or `/ai-usage`.

## Initial document families

The first registry metadata covers:

- About
- Accessibility
- Cookie Use
- DMCA
- Community Standards / Guidelines
- Privacy
- Refunds
- Safety
- Loombus Guide
- Support
- Terms
- AI Usage

These entries describe current route ownership and migration state. They do not claim that the current route text has been converted into an approved immutable registry version.

## Internal first-20 draft source

The registry also records `docs/trust-safety/drafts` as the initial migration source for the numbered internal draft set.

Controls:

- matching filename contract: numbered Markdown drafts
- minimum expected documents: 20
- default imported status: `internal_draft`
- default audience: `internal_only`
- `forcePublicReadyFalse=true`
- automated registry import disabled
- public routing disabled

The verifier rejects a matching internal draft that declares `public_ready: true` while this migration-source boundary is active.

No draft content is copied into a public asset directory or loaded by a public route in this phase.

## Typed version contract

`src/lib/policy-content-registry.ts` defines the initial controlled vocabularies for:

- document type
- category
- audience
- publication status
- approval state
- migration state

It defines the complete version record required by the Phase A contract, including identity, routing, owner/reviewer state, publication blockers, dependencies, related actions/articles, locale/jurisdiction, exact source revision, supersession, withdrawal, and payload identity.

The canonical version format is checked as:

`YYYY.MM.DD.N`

## Status transitions

The shared helper recognizes only the Phase A state-machine transitions. Arbitrary status movement is not treated as valid.

This helper does not mutate a policy record. It only answers whether a proposed transition belongs to the contract.

## Publication eligibility helper

`evaluatePolicyVersionPublicationEligibility(...)` fails closed unless all version-level requirements are satisfied, including:

- document family identity matches
- canonical route matches
- version format is valid
- source revision exists
- `publicReady=true`
- audience is `public`
- status is `effective`
- effective time exists, parses, and is not in the future
- every required reviewer has an `approved` record
- every required approval references the exact source revision
- no active publication blocker exists

Unknown or missing required conditions produce an ineligible result.

## Public serving helper

`evaluatePolicyPublicServingEligibility(...)` adds two deployment-level checks before a future route may use registry content:

1. global `registryRoutingEnabled` must be true;
2. the document family must be `registry_managed`.

Both conditions are false for the current public route families in Phase B.

A future route migration must use the public-serving boundary, not only the version-level eligibility helper.

## Static verifier

`scripts/verification/verify-policy-content-registry.mjs` checks the repository-backed contract without depending on a browser, database, or public route.

It checks, among other invariants:

- schema version
- Phase B routing switches remain disabled
- unique document IDs
- unique canonical routes
- valid document types/categories/migration states
- current legacy route source files exist
- required version metadata exists for future registry-managed entries
- unique versions per family
- version/document/route relationships
- valid status/audience/approval values
- payload paths exist
- effective versions cannot be future-dated or `publicReady=false`
- internal-only content cannot be public-effective
- scheduled versions require future effective dates, approvals, and no blockers
- required approvals match the exact source revision
- supersession references resolve
- superseded versions retain a successor or replacement relationship
- related document IDs resolve
- first-20 migration-source minimum is present
- matching internal drafts cannot declare `public_ready: true`

The verifier also runs fail-closed fixtures for:

- `publicReady=false`
- internal-only audience
- future effective date
- approval/source-revision mismatch

## CI drift gate

`.github/workflows/policy-content-governance.yml` runs the verifier when the registry, verifier, policy-content documentation, internal drafts, workflow, or current canonical public policy route components change.

The gate is structural. It does not assert that substantive legal text is correct or legally approved.

## Explicitly unchanged

This phase does not:

- change current public policy text
- change current effective dates
- migrate a current public route to registry content
- expose a historical archive route
- publish an internal draft
- create an editorial database
- grant an administrator publication power
- infer Legal approval from GitHub state
- send member notices
- schedule a policy change
- change Support operations
- satisfy counsel review for Issues #667, #670, #674, or other counsel-gated work

## Validation before merge

Require:

1. policy-content governance workflow passes;
2. repository TypeScript/build checks pass;
3. existing Security/CodeQL checks remain green where triggered;
4. Vercel preview succeeds;
5. comparison confirms no current public route file changed;
6. no migration is present.

## Next phase

After Phase B is merged and deployed, Phase C should create the first immutable structured content payload and migration/parity tooling for a low-risk document family without immediately switching the canonical public route.

The first route switchover should happen only after immutable payload parity, publication metadata, version history, accessibility/mobile review, and all required approvals are proven for that specific version.
