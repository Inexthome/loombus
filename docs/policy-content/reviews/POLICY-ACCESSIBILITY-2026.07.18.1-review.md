# POLICY-ACCESSIBILITY 2026.07.18.1 Review Record

Status: review pending

Issue: #671

Document ID: `POLICY-ACCESSIBILITY`

Version: `2026.07.18.1`

Canonical route: `/accessibility`

Structured payload: `src/content/policies/POLICY-ACCESSIBILITY/2026.07.18.1.json`

Legacy source: `src/app/accessibility/page.tsx`

Exact legacy source revision: `git-blob:21b0c0eb9504012d8926dc73dcb88d5591a17780`

Restricted preview: `/admin/policy-content-preview`

Public route switchover authorized by this record: no

## Purpose

This file is the version-specific review record for the first Issue #671 structured policy candidate.

It gives Product Owner and Accessibility review one exact evidence target. It does not record an approval merely because the payload exists, the preview is deployed, CI passes, or the pull request is merged.

The candidate remains publication-ineligible until the registry itself contains explicit approved review records for this exact source revision and all remaining publication blockers are separately cleared.

## Immutable review target

The review target is the combination of:

- document ID `POLICY-ACCESSIBILITY`;
- version `2026.07.18.1`;
- source revision `git-blob:21b0c0eb9504012d8926dc73dcb88d5591a17780`;
- payload path `src/content/policies/POLICY-ACCESSIBILITY/2026.07.18.1.json`;
- canonical route `/accessibility`;
- restricted preview `/admin/policy-content-preview`.

If the payload text, links, section structure, source revision, canonical route, or renderer contract changes, prior review evidence for this target cannot be silently carried forward.

## Current automated evidence

The following automated checks are supporting evidence only. They are not reviewer approval.

### Exact source parity

The Accessibility parity verifier checks:

- the exact legacy Git blob revision;
- page metadata;
- reviewed date;
- all 19 section IDs in order;
- section titles;
- ordered text fragments;
- Support and email links;
- structured block and inline types;
- registry candidate identity;
- publication blockers;
- route-disconnection boundaries.

### Structured payload validation

The payload validator checks controlled block and inline types and rejects unsupported or unsafe links.

Allowed link forms are:

- same-origin paths beginning with `/`;
- `mailto:` links;
- valid `https://` URLs.

Unsupported, protocol-relative, `javascript:`, `data:`, insecure `http:`, and control-character forms fail validation.

### Restricted preview boundary

The preview is intended to remain:

- administrator-authenticated;
- read-only;
- GET-only;
- private and no-store;
- non-indexable;
- source-code allowlisted;
- disconnected from public registry routing;
- disconnected from archive routing;
- unable to approve, publish, schedule, notify, or switch the public route.

## Product Owner review

Reviewer role: `Product Owner`

Current registry state: `pending`

The Product Owner review should confirm the candidate faithfully represents the intended current public Accessibility page without introducing a new product promise.

Review the deployed restricted preview and verify:

1. Title, description, and overall meaning match the current `/accessibility` page.
2. All current sections are present in the expected order.
3. The Support link points to `/support?category=accessibility`.
4. The accessibility email target remains `support@loombus.com` with the intended subject.
5. No text has been added that represents a new legal, product, staffing, response-time, certification, or accessibility guarantee.
6. No current text is missing or materially rephrased.
7. The preview is clearly labeled as a non-public candidate.
8. There is no edit, approve, publish, schedule, notice, or route-switchover action available in the preview.

Possible outcomes:

- `approved`: the exact candidate is accepted for the Product Owner role;
- `changes_requested`: specific candidate corrections are required;
- remain `pending`: review is incomplete.

An approval must identify this exact version and source revision.

## Accessibility review

Reviewer role: `Accessibility`

Current registry state: `pending`

Static parity alone is not sufficient for Accessibility approval. The review should include the rendered candidate and relevant interaction behavior.

At minimum verify:

### Heading and landmark behavior

- one clear page title;
- section headings appear in a logical hierarchy;
- section IDs support stable in-page navigation where used;
- no duplicate section IDs are introduced by the renderer.

### Keyboard behavior

- all links can be reached by keyboard;
- visible focus remains available;
- no preview control traps focus;
- the page can be read from beginning to end without a pointing device.

### Link semantics

- `Loombus Support` has a meaningful accessible name;
- the email link has a meaningful accessible name;
- links remain distinguishable from surrounding text without relying only on color where the shared presentation controls apply.

### Zoom, reflow, and mobile

- content remains readable at common browser zoom levels;
- narrow mobile layouts do not introduce ordinary-reading horizontal scroll;
- headings and lists remain understandable on mobile;
- long URLs or identifiers in the review chrome do not break the main content layout.

### Screen-reader and semantic review

- paragraphs render as paragraphs;
- bullet collections render as semantic lists;
- links remain links rather than visually styled plain text;
- reading order follows the source order;
- preview-only status information does not obscure the policy content.

### Theme and contrast review

- Light, Dark, and System modes remain usable through the shared public-policy presentation;
- text, links, focus states, and review-status chrome remain readable in supported themes.

Possible outcomes:

- `approved`: the exact candidate is accepted for the Accessibility role;
- `changes_requested`: specific accessibility corrections are required;
- remain `pending`: review is incomplete.

An approval must identify this exact version and source revision.

## Review evidence rule

A later registry update may change a review state from `pending` only when an explicit review outcome exists for the exact version and source revision.

The update must not infer approval from:

- PR merge;
- deployment;
- Vercel success;
- Policy Content Governance success;
- Product Owner status alone;
- administrator status;
- AI review;
- issue closure;
- a prior version's approval.

## Current blockers that remain active

The candidate currently retains both publication blockers:

- `registry_route_switchover_not_authorized`;
- `accessibility_parity_review_pending`.

The route-parity product dependency remains blocking.

This review record does not clear any of them.

## What an explicit review may clear

After the exact candidate has been reviewed:

- Product Owner approval may satisfy only the `Product Owner` reviewer requirement.
- Accessibility approval may satisfy only the `Accessibility` reviewer requirement.
- Completed parity evidence may justify clearing the parity-specific dependency or blocker only if the associated human review also supports that conclusion.

Neither approval automatically authorizes public registry routing or archive routing.

## What remains a separate phase

Even after both reviewer roles are approved, public route migration remains a separate controlled change.

A later route-switchover phase must separately verify:

- registry family migration to `registry_managed`;
- an eligible publication status and effective date;
- `publicReady=true` only after all publication conditions are satisfied;
- no active blockers;
- canonical route behavior;
- version history behavior;
- historical exact-version lookup;
- mobile and accessibility confirmation;
- print behavior;
- search/navigation behavior where enabled;
- rollback to the existing route if the registry resolver fails closed.

## Review outcome section

No outcome is recorded yet.

### Product Owner

State: pending

Approved by: none

Approved at: none

Source revision: `git-blob:21b0c0eb9504012d8926dc73dcb88d5591a17780`

Notes: explicit review required.

### Accessibility

State: pending

Approved by: none

Approved at: none

Source revision: `git-blob:21b0c0eb9504012d8926dc73dcb88d5591a17780`

Notes: rendered accessibility review required.

## Safety boundary

This record is internal review evidence. It does not publish policy text, create a legal approval, notify members, change Support operations, or enable any Issue #667, #670, or #674 capability.
