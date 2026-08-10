# Issue #671 Phase F: History and Archive Foundation

Status: implementation foundation, public archive disabled

Issue: #671

Public route switchover authorized by this phase: no

## Purpose

Phase F adds the generic exact-version archive and version-history infrastructure required by the Issue #671 content contract before any canonical policy route moves to registry serving.

It deliberately does not publish the reviewed Accessibility candidate and does not change the candidate publication state.

## Added foundation

This phase adds:

- a server-only, source-controlled structured payload registry;
- a public-history resolver that derives only public-safe effective/superseded entries from trusted registry state;
- the generic exact-version route pattern `/policies/archive/<document-id>/<version>`;
- the generic history route pattern `/policies/history/<document-id>`;
- a static governance verifier with fail-closed fixtures;
- Policy Content Governance coverage for the new history/archive paths.

The routes are thin shells. Policy text remains in immutable structured payloads rather than being embedded in one route component per document.

## Fail-closed production state

During this phase:

- `registryRoutingEnabled=false`;
- `archiveRoutingEnabled=false`;
- `POLICY-ACCESSIBILITY` remains `registry_candidate`;
- version `2026.07.18.1` remains `status=review`;
- `publicReady=false`;
- `effectiveAt=null`;
- the route-switchover blocker remains active;
- `/accessibility` remains the legacy-rendered production route.

Because archive routing is disabled, the new public archive/history route shells resolve to not-found in production. They cannot expose the review candidate merely because the payload exists in source control.

## Exact archive boundary

The archive route accepts only document/version identity from the URL. That identity is used only to query the trusted source-controlled registry and static payload registry.

The route does not:

- derive a filesystem path from user input;
- dynamically import a user-selected file;
- accept status, audience, approval, or publication state from the request;
- bypass `resolvePolicyArchiveVersion`;
- render a payload whose document/version/path/source revision does not match the resolved registry record.

A disabled, unknown, non-managed, non-effective/non-superseded, publication-ineligible, or mismatched version fails closed.

## Public history boundary

Version history includes only metadata appropriate for a public viewer:

- version identifier;
- title;
- effective/superseded status;
- effective date;
- public change note where present;
- canonical current route;
- exact archive link.

It does not expose reviewer identities, approval timestamps, source revisions, internal review notes, publication blockers, or product dependency records.

Review, approved-but-not-effective, scheduled-before-effective, internal, and otherwise ineligible versions are excluded.

## Synthetic acceptance evidence

The Phase F verifier proves with synthetic registry data that:

- an effective current version and superseded prior version both appear in public history when archive routing is enabled and the family is registry-managed;
- the current version sorts before the older version;
- the superseded version receives an immutable exact-version URL;
- a review version is not exposed;
- disabled archive routing exposes nothing;
- an approval/source-revision mismatch exposes nothing.

Production registry state is checked separately and must remain disabled/non-public in this phase.

## Reviewer evidence preserved

The Product Owner and Accessibility reviewer approvals recorded in PR #881 remain unchanged and bound to the exact Accessibility source revision.

This phase does not alter:

- policy payload text;
- payload section structure;
- canonical `/accessibility` route;
- the reviewed source revision;
- the structured policy renderer;
- Product Owner or Accessibility review outcomes.

## Next controlled state transition

After this foundation is merged, deployed, and verified, the next narrow phase may advance the reviewed Accessibility version through the publication state machine from `review` to `approved` while still keeping:

- `publicReady=false`;
- `effectiveAt=null`;
- public registry routing disabled;
- archive routing disabled;
- the route-switchover blocker active.

That state transition remains separate from making the document effective or switching the canonical route.

## Safety boundary

This phase does not create a legal approval, publish new policy text, send a member notice, change Support operations, or enable any Issue #667, #670, or #674 capability.
