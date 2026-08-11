# Issue #671 Phase I: Jump-to Navigation and Printable Policy Views

Status: implementation candidate, pending CI, preview, and manual review

Baseline: merged/deployed PR #890, merge commit `64e511d1169b94b2c804e4c57c07704423bd0343`

## Purpose

Close two remaining Issue #671 product-capability gaps at the shared policy presentation layer:

1. Jump-to navigation for long policy and Help documents.
2. Browser-printable policy views.

This phase changes presentation only. It does not change policy wording, policy metadata, approval state, effective dates, source revisions, archive identity, or publication eligibility.

## Jump-to behavior

`PublicPolicyPage` derives a Jump-to list from sections that already have stable `id` values.

Each item is a normal same-document fragment link to the existing section heading. The implementation does not add synthetic section identifiers, rewrite payloads, or use client-side scroll interception.

Jump links retain explicit Loombus Gold focus-visible rings and remain in normal sequential keyboard order.

## Print behavior

A small client-only `PolicyPrintButton` calls the browser-native `window.print()` API.

The button:

- performs no network request;
- writes no browser storage;
- creates no export artifact on the server;
- does not bypass policy access/publication gates.

Print-only CSS is scoped to `PublicPolicyPage` and:

- hides the back link, Jump-to navigation, and Print button;
- forces readable black text on a white print surface regardless of Light, Dark, or System screen appearance;
- removes decorative backgrounds and shadows;
- keeps links visibly underlined;
- avoids separating section headings from following content where the browser supports paged-media break controls;
- preserves paragraph/list widow and orphan hints where supported.

## Shared-surface effect

The capability is added to `PublicPolicyPage`, so registry-managed structured policies inherit it through `StructuredPolicyRenderer`. Existing legacy pages that already use `PublicPolicyPage` also receive the same navigation/print presentation without policy-text modification.

The current Accessibility payload remains `POLICY-ACCESSIBILITY` version `2026.08.10.1` and is not modified by this phase.

## Governance gate

`verify-policy-jump-print.mjs` checks:

- same-document fragment navigation from stable section IDs;
- explicit keyboard focus treatment for Jump-to links and the print action;
- absence of negative tab-order overrides;
- client-only native print invocation with no network/storage side effects;
- scoped print CSS and screen-only suppression;
- black-on-white print overrides;
- paged-media heading/widow/orphan controls;
- continued structured-renderer propagation of section IDs and titles;
- current Accessibility payload section IDs are present and unique.

The Policy Content Governance workflow runs this verifier for pull requests and `main` pushes affecting the shared policy surface.

## Manual preview review required

Before merge, verify on the Vercel preview:

1. `/accessibility` shows the Jump-to panel and Print document button without changing policy wording.
2. Keyboard Tab reaches Jump-to links and the Print button with a visible focus ring.
3. At least the first, middle, and last Jump-to links land on the expected headings.
4. Mobile/narrow layout wraps the Jump-to controls without horizontal overflow.
5. Light, Dark, and System remain readable on screen.
6. Print preview hides navigation/tools and renders readable black-on-white policy content.
7. Print preview contains all policy sections and Document status without clipped or missing text.

## Safety and publication boundary

No registry lifecycle state changes in this phase. No new policy becomes public. No counsel-gated document is activated. No member notice, legal approval, external transmission, analytics collection, Supabase migration, or server-side export is added.
