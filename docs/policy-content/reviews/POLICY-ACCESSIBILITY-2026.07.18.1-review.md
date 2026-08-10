# POLICY-ACCESSIBILITY 2026.07.18.1 Review Record

Status: reviewer approvals complete

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

The required Product Owner and Accessibility reviews for this exact candidate are complete. The candidate remains publication-ineligible because public route migration, publication status, effective date, `publicReady`, and routing authorization remain separate controlled steps.

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

Current registry state: `approved`

The Product Owner review confirms the candidate faithfully represents the intended current public Accessibility page without introducing a new product promise.

The deployed restricted preview was reviewed for:

1. Title, description, and overall meaning matching the current `/accessibility` page.
2. All current sections present in the expected order.
3. The Support link pointing to `/support?category=accessibility`.
4. The accessibility email target remaining `support@loombus.com` with the intended subject.
5. No added text representing a new legal, product, staffing, response-time, certification, or accessibility guarantee.
6. No current text missing or materially rephrased.
7. The preview clearly labeled as a non-public candidate.
8. No edit, approve, publish, schedule, notice, or route-switchover action available in the preview.

Outcome: `approved` for this exact version and source revision.

Evidence: Issue #671 comment `5237391065` records the explicit Product Owner confirmation.

## Accessibility review

Reviewer role: `Accessibility`

Current registry state: `approved`

Static parity alone was not treated as sufficient for Accessibility approval. The rendered candidate and relevant interaction behavior were reviewed.

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

The initial manual keyboard review exposed insufficiently apparent focus. PR #880 added explicit focus treatment and link affordances. After merge/deployment, keyboard and reverse-keyboard navigation were re-tested and confirmed.

### Link semantics

- `Loombus Support` has a meaningful accessible name;
- the email link has a meaningful accessible name;
- links remain distinguishable from surrounding text without relying only on color where the shared presentation controls apply.

### Zoom, reflow, and mobile

- content remains readable at 200% browser zoom;
- narrow mobile layouts do not introduce ordinary-reading horizontal scroll;
- headings and lists remain understandable on mobile;
- long identifiers in the review chrome do not break the main content layout.

### Screen-reader and semantic review

- paragraphs render as paragraphs;
- bullet collections render as semantic lists;
- links remain links rather than visually styled plain text;
- reading order follows the source order;
- preview-only status information does not obscure the policy content.

VoiceOver was used to sample the page title, headings, paragraphs, lists, navigation links, Support link, and email link.

### Theme and contrast review

- Light, Dark, and System modes were reviewed;
- text, links, focus states, and review-status chrome remained readable in supported themes.

Outcome: `approved` for this exact version and source revision.

Evidence on Issue #671:

- `5237485912`: initial keyboard review recorded changes requested;
- `5237561231`: PR #880 production verification;
- `5237584669`: keyboard re-test passed;
- `5237607269`: 200% zoom/reflow passed;
- `5237677111`: mobile/narrow viewport passed;
- `5237705005`: Light/Dark/System theme review passed;
- `5237757572`: screen-reader/semantic review passed and completed the Accessibility evidence sequence.

## Review evidence rule

A registry review state may change from `pending` only when an explicit review outcome exists for the exact version and source revision.

The approvals in this record are based on the explicit human review evidence listed above. They were not inferred from:

- PR merge;
- deployment;
- Vercel success;
- Policy Content Governance success;
- Product Owner status alone;
- administrator status;
- AI review;
- issue closure;
- a prior version's approval.

## Current blockers after review

The candidate retains the publication blocker:

- `registry_route_switchover_not_authorized` remains active.

The review-specific state changes are limited to:

- `accessibility_parity_review_pending` is inactive because exact parity plus required human review are complete;
- `current-accessibility-route-parity` is non-blocking for this exact version/source revision.

These changes do not authorize public registry routing or archive routing.

## What the completed review satisfies

- Product Owner approval satisfies only the `Product Owner` reviewer requirement.
- Accessibility approval satisfies only the `Accessibility` reviewer requirement.
- Completed parity evidence satisfies the parity-specific dependency/blocker for this exact reviewed candidate.

Neither approval authorizes public route migration.

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

### Product Owner

State: approved

Approved by: `Inexthome`

Approved at: `2026-08-10T08:27:14.000Z`

Source revision: `git-blob:21b0c0eb9504012d8926dc73dcb88d5591a17780`

Notes: explicit Product Owner review completed for the exact candidate; evidence is recorded on Issue #671.

### Accessibility

State: approved

Approved by: `Inexthome`

Approved at: `2026-08-10T08:27:14.000Z`

Source revision: `git-blob:21b0c0eb9504012d8926dc73dcb88d5591a17780`

Notes: rendered Accessibility review completed after keyboard remediation and re-test, 200% zoom/reflow, mobile, supported-theme, and VoiceOver semantic checks.

## Safety boundary

This record is internal review evidence. It does not publish policy text, create a legal approval, notify members, change Support operations, authorize route switchover, or enable any Issue #667, #670, or #674 capability.
