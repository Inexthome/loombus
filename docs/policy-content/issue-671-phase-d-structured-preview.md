# Issue #671 Phase D: Shared Structured Renderer and Restricted Preview

Status: internal implementation record

Issue: #671

Public publication authorized by this document: no

## Objective

Add the first reusable rendering and preview path for the repository-backed versioned policy-content system without changing the live `/accessibility` route or weakening the publication gate established in Phases A through C.

This phase is intentionally read-only. It exists to let Loombus inspect a registered structured candidate using production UI primitives before any route-switchover decision.

## Baseline

Phase D begins from merged PR #877 at merge commit:

`e6307a38a4166610415c225dbaa2554d097ff5c0`

At that baseline:

- `registryRoutingEnabled=false`;
- `archiveRoutingEnabled=false`;
- `POLICY-ACCESSIBILITY` is `registry_candidate`;
- version `2026.07.18.1` is in `review`;
- `publicReady=false`;
- Product Owner review is pending;
- Accessibility review is pending;
- active publication blockers remain;
- `/accessibility` still renders `src/app/accessibility/page.tsx` directly.

## Added application contract

`src/lib/policy-content-payload.ts` defines the reusable `policy_payload.v1` structure used by the first candidate payload.

The contract currently supports:

- page metadata;
- document/version identity;
- canonical route;
- exact legacy source revision;
- eyebrow, title, description, reviewed/effective date fields;
- sections with stable IDs and titles;
- paragraph blocks;
- bullet-list blocks;
- text and link inline nodes.

The runtime validator rejects incomplete or unsupported payload structures.

## Link safety

Structured links are not rendered as arbitrary URL strings.

The shared payload contract allows only:

- same-origin absolute paths beginning with a single `/`;
- `mailto:` links without control characters or angle-bracket injection;
- valid `https://` URLs.

Protocol-relative URLs, `javascript:`, `data:`, insecure `http:`, control-character injection, and unsupported schemes fail validation.

The renderer checks the link boundary again before rendering.

## Shared renderer

`src/components/policy-content/structured-policy-renderer.tsx` converts a validated `StructuredPolicyPayload` into the existing `PublicPolicyPage` presentation system.

This preserves:

- current PageShell/PageHeader/Panel styling;
- Light, Dark, and System behavior;
- existing section numbering;
- established typography and spacing;
- current document-status presentation;
- normal accessible internal and mail links.

The renderer does not use `dangerouslySetInnerHTML` and does not interpret payload text as executable markup.

### Current block-order compatibility

The existing `PublicPolicyPage` contract renders paragraph content before a section bullet list. The Phase D renderer intentionally retains that behavior for parity with the current public routes.

A future arbitrary-block-order renderer must use a new reviewed payload/rendering contract rather than silently changing the presentation of an existing version.

## Restricted preview API

The read-only endpoint is:

`GET /api/admin/policy-content-preview`

The request currently accepts the exact registered document/version identity for the Accessibility candidate.

The endpoint:

- authenticates through the existing request-account-access contract;
- requires `profile.is_admin=true`;
- uses a source-code static payload allowlist;
- does not dynamically import a path selected by the request;
- checks the family is still `registry_candidate`;
- checks the requested version exists in the registry;
- checks payload path identity;
- runs the structured-payload validator;
- checks payload document/version/route/source-revision identity against the registry;
- evaluates publication eligibility but does not change it;
- returns `private, no-store` responses;
- emits `X-Robots-Tag: noindex, nofollow, noarchive`;
- exposes no write method.

The API does not update the registry, approvals, blockers, member notices, search, Support, or a public route.

## Restricted preview page

The preview surface is:

`/admin/policy-content-preview`

It obtains the current authenticated session and calls the restricted preview API with the bearer token.

It displays:

- candidate document ID and version;
- migration state;
- review status;
- `publicReady` state;
- calculated publication eligibility;
- generic publication-gate reasons;
- exact source revision;
- the shared structured rendering of the candidate payload.

It contains no edit, approve, schedule, publish, notice, or route-switchover control.

The page is explicitly `noindex`, `nofollow`, and `noarchive`.

A person guessing the preview URL does not receive the payload without passing the server-side administrator authorization check.

## Publication boundaries preserved

This phase does not change any of the following:

- `registryRoutingEnabled` remains false;
- `archiveRoutingEnabled` remains false;
- Accessibility remains `registry_candidate`;
- candidate status remains `review`;
- `publicReady` remains false;
- `effectiveAt` remains null;
- current approvals remain pending;
- active publication blockers remain active;
- `/accessibility` remains on the legacy component;
- no archive route is created;
- no search indexing of candidate content is enabled;
- no member notice is created;
- no administrator publication power is created;
- merge/deployment does not count as Product Owner, Accessibility, or Legal approval.

## Governance verification

`scripts/verification/verify-policy-structured-preview.mjs` fails when the Phase D boundaries drift.

It checks:

- registry and archive routing remain disabled;
- Accessibility remains a blocked `registry_candidate`;
- the candidate remains `review`, `publicReady=false`, and without an effective date;
- payload identity and registry source revision remain aligned;
- all current structured links satisfy the safe-link boundary;
- the payload contract contains runtime validation and safe-link handling;
- the renderer uses no raw HTML injection and does not import a concrete payload;
- the preview API remains admin-only, GET-only, static-allowlisted, and no-store;
- the preview page remains non-indexable;
- the preview client exposes no editor/write form;
- the live Accessibility route remains disconnected from the structured renderer;
- the policy-content governance workflow watches and runs all Phase D controls.

The pre-existing Phase C Accessibility parity verifier remains active as an independent guard on wording, source revision, section identity, metadata, and early route wiring.

## No database migration

Phase D is repository-backed and introduces no Supabase table, function, RLS policy, grant, data mutation, or migration.

## Review plan

Before a later route-switchover phase, Loombus should use the restricted preview to compare the structured renderer against the live `/accessibility` route for:

- exact wording;
- heading and section order;
- paragraph/list presentation;
- internal and email links;
- Light, Dark, and System themes;
- keyboard navigation and visible focus;
- narrow mobile, tablet, and desktop layouts;
- zoom/reflow;
- screen-reader semantics;
- print behavior if a print contract is added before switchover.

Any substantive content edit requires a controlled version/review decision. The preview itself cannot approve the candidate.

## Next phase boundary

After Phase D is merged and the restricted preview is verified, the next safe phase should record explicit internal Product Owner and Accessibility parity-review outcomes for this exact candidate revision and close any purely technical parity blocker that the review actually satisfies.

That next phase still should not automatically enable global registry routing or switch `/accessibility` to the registry. Route switchover should remain a separate, explicit phase with a rollback path and production verification.
