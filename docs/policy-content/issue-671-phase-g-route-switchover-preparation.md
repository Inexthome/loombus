# Issue #671 Phase G — Canonical Route Switchover Preparation

Status: implementation foundation only

Document: `POLICY-ACCESSIBILITY`

Version: `2026.07.18.1`

Canonical route: `/accessibility`

## Purpose

This phase prepares the reviewed Accessibility policy for a later controlled canonical-route switchover without making the reviewed registry version public.

It adds a route-specific dormant adapter and a fail-closed canonical-route resolver. The adapter preserves the existing legacy page whenever the registry cannot produce one fully publication-eligible current version with a matching structured payload.

## Production state in this phase

The following values remain unchanged:

- `registryRoutingEnabled=false`
- `archiveRoutingEnabled=false`
- `POLICY-ACCESSIBILITY` migration state `registry_candidate`
- version status `approved`
- `publicReady=false`
- `effectiveAt=null`
- `registry_route_switchover_not_authorized` remains active
- `/accessibility` remains the reviewed legacy page because the canonical resolver fails closed

No effective date is assigned by this phase.

## Canonical route resolver

`src/lib/policy-content-canonical-route.ts` composes the existing current-version resolver with the static structured-payload registry.

A registry version may reach the structured renderer only when:

1. global registry routing is enabled;
2. the document family is `registry_managed`;
3. exactly one current version satisfies the existing publication eligibility gate;
4. that version is `effective`, public-ready, public audience, effective on or before the current time, fully approved for the exact source revision, and has no active publication blocker;
5. a validated static payload source exists for the exact document ID and version;
6. payload document ID, version, payload path, source revision, and canonical route match the resolved registry version.

Any failure returns an unresolved result and does not select structured content for the canonical route.

## Accessibility route adapter

`src/app/accessibility/layout.tsx` is intentionally route-specific for the first migration.

When canonical resolution fails, it returns the existing page child unchanged. When a later separately authorized publication phase makes the registry version fully eligible, it can render the already-reviewed `StructuredPolicyRenderer` payload instead.

This design leaves `src/app/accessibility/page.tsx` unchanged in Phase G. The exact reviewed source revision therefore remains:

`git-blob:21b0c0eb9504012d8926dc73dcb88d5591a17780`

The route adapter has no environment-variable override, request query override, cookie override, administrative bypass, or fallback that can force structured publication around the registry gate.

## Verification

`scripts/verification/verify-policy-canonical-route-switchover.mjs` verifies:

- the production registry and archive routing flags remain false;
- Accessibility remains `registry_candidate`, `approved`, `publicReady=false`, and `effectiveAt=null`;
- the route-switchover blocker remains active;
- the live Accessibility page still hashes to the exact reviewed source revision;
- the adapter preserves the legacy child while canonical resolution is unavailable;
- the canonical resolver validates registry eligibility and payload identity;
- disabled routing, candidate-family state, approved-only state, and active blockers remain fail-closed;
- only a synthetic fully eligible effective version can resolve;
- payload path, source-revision, and canonical-route mismatches fail closed.

## Not authorized by this phase

This phase does not:

- mark the policy `effective`;
- set `publicReady=true`;
- assign an effective date;
- move the family to `registry_managed`;
- clear `registry_route_switchover_not_authorized`;
- enable registry routing;
- enable archive routing;
- change policy wording, links, section structure, source revision, or canonical URL;
- send a member notice;
- create legal approval;
- modify Issue #667, #670, or #674 capabilities.

## Required next decision

Before a later activation PR can be prepared, the publication effective date must be explicitly authorized. The activation itself must remain a separate, reviewable change that sets the publication state and routing gates together and verifies rollback/fail-closed behavior.
