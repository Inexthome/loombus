# Issue #671 Phase H: Accessibility registry activation

## Purpose

Activate the already-reviewed `POLICY-ACCESSIBILITY` version `2026.07.18.1` through the versioned policy registry after the review, history/archive, and fail-closed canonical-route preparation phases are complete.

This phase changes lifecycle/routing state only. It does not change the reviewed policy wording, links, section structure, payload, renderer contract, or source revision.

## Explicit authorization

Product Owner authorization is recorded on Issue #671 comment `5248313219`.

Authorized technical effective timestamp: `2026-08-11T02:24:00.000Z` (`2026-08-10 22:24` America/New_York).

Exact authorized version:

- document ID: `POLICY-ACCESSIBILITY`
- version: `2026.07.18.1`
- source revision: `git-blob:21b0c0eb9504012d8926dc73dcb88d5591a17780`
- payload: `src/content/policies/POLICY-ACCESSIBILITY/2026.07.18.1.json`
- canonical route: `/accessibility`

## Authorized state transition

- `registryRoutingEnabled: false -> true`
- `archiveRoutingEnabled: false -> true`
- Accessibility family: `registry_candidate -> registry_managed`
- version status: `approved -> effective`
- `publicReady: false -> true`
- `effectiveAt: null -> 2026-08-11T02:24:00.000Z`
- `registry_route_switchover_not_authorized: active -> inactive`

All other policy/help families remain in their existing migration states. Enabling the global routing gates does not make a legacy or candidate family eligible because the resolver still requires `registry_managed` plus a fully publication-eligible effective version.

## Publication gates that remain mandatory

Canonical serving still fails closed unless all of the following are true:

- registry routing is enabled;
- family is `registry_managed`;
- exactly one version is `effective` and publication-eligible;
- `publicReady=true`;
- the effective timestamp is valid and not in the future;
- required reviewer approvals are approved and bound to the exact source revision;
- no publication blocker is active;
- the structured payload is in the server-only static allowlist;
- payload document ID, version, payload path, source revision, and canonical route match the registry version.

Archive/history serving independently requires archive routing and only exposes effective/superseded public-safe version metadata.

## No content reapproval bypass

The existing Product Owner and Accessibility approvals remain valid only because the exact reviewed source revision and structured payload are unchanged.

Any later change to policy text, links, section structure, source revision, canonical route, or renderer contract must not silently inherit these approvals. The approval records retain `reapprovalRequiredAfterChange=true`.

## Post-deploy verification

After merge and deployment, verify:

1. `/accessibility` resolves through the canonical registry adapter and renders the exact reviewed content.
2. The canonical route still uses `https://loombus.com/accessibility` metadata.
3. Light, Dark, and System rendering remains readable.
4. Keyboard/focus behavior remains intact.
5. Mobile/reflow remains intact.
6. The Support link and accessibility email remain correct.
7. `/policies/history/POLICY-ACCESSIBILITY` exposes only public-safe version metadata.
8. `/policies/archive/POLICY-ACCESSIBILITY/2026.07.18.1` resolves the exact effective version.
9. No other legacy policy/help family becomes registry-served merely because global routing is enabled.

## Rollback boundary

If post-deploy verification exposes a route, content, metadata, accessibility, or archive regression, revert this activation PR as a unit. Reversion should restore:

- both global routing gates to disabled;
- Accessibility to `registry_candidate`;
- version status to `approved`;
- `publicReady=false`;
- `effectiveAt=null`;
- the route-switchover blocker to active.

The reviewed legacy `src/app/accessibility/page.tsx` remains unchanged so the dormant adapter can immediately fall back to the previously verified route content after rollback.

## Explicitly not authorized

This phase does not:

- change Accessibility policy wording;
- create legal approval or legal advice;
- claim WCAG certification or regulatory compliance;
- send member notice;
- alter Support operations;
- activate any other policy/help family;
- enable any restricted Issue #667, #670, or #674 capability.

## Broader Issue #671 status

This phase completes the first controlled registry activation for one reviewed policy family. Issue #671 remains open for the broader content-system acceptance criteria, including wider inventory migration, unified search, category navigation, Jump to navigation, printable legal views, scheduled future-effective workflows, change-note presentation, privacy-appropriate analytics, and scalable additional-family migration.
