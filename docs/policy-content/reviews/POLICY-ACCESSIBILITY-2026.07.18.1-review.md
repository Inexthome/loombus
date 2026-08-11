# POLICY-ACCESSIBILITY 2026.07.18.1 Review Record

Status: effective and registry-managed

Issue: #671

Document ID: `POLICY-ACCESSIBILITY`

Version: `2026.07.18.1`

Canonical route: `/accessibility`

Structured payload: `src/content/policies/POLICY-ACCESSIBILITY/2026.07.18.1.json`

Legacy parity source: `src/app/accessibility/page.tsx`

Exact legacy source revision: `git-blob:21b0c0eb9504012d8926dc73dcb88d5591a17780`

Restricted candidate preview: `/admin/policy-content-preview`

Public route switchover authorized by this record: yes

Technical effective timestamp: `2026-08-11T02:24:00.000Z`

Activation authorization evidence: Issue #671 comment `5248313219`

## Purpose

This file is the version-specific review and activation record for the first Issue #671 structured policy version.

It gives Product Owner and Accessibility review one exact evidence target and records the later, separate technical publication authorization. It does not treat payload existence, preview deployment, CI success, administrator status, or PR merge as approval.

The required Product Owner and Accessibility reviews for this exact version are complete. After the route-switchover preparation phase was merged and deployed, the Product Owner separately authorized this exact reviewed version to become effective immediately. The authorization did not change policy wording, links, section structure, source revision, or the reviewed payload.

## Immutable review target

The review target is the combination of:

- document ID `POLICY-ACCESSIBILITY`;
- version `2026.07.18.1`;
- source revision `git-blob:21b0c0eb9504012d8926dc73dcb88d5591a17780`;
- payload path `src/content/policies/POLICY-ACCESSIBILITY/2026.07.18.1.json`;
- canonical route `/accessibility`;
- restricted candidate preview `/admin/policy-content-preview`.

If the payload text, links, section structure, source revision, canonical route, or renderer contract changes, prior review evidence for this target cannot be silently carried forward. The existing approval records require reapproval after a source change.

## Current automated evidence

The following automated checks are supporting evidence only. They are not reviewer approval or publication authorization.

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
- registry identity and lifecycle state;
- required approvals and blocker state;
- the exact authorized technical effective timestamp.

The reviewed legacy `page.tsx` remains the immutable parity source. Canonical serving is selected by the reviewed layout/resolver boundary rather than by rewriting that source file.

### Structured payload validation

The payload validator checks controlled block and inline types and rejects unsupported or unsafe links.

Allowed link forms are:

- same-origin paths beginning with `/`;
- `mailto:` links;
- valid `https://` URLs.

Unsupported, protocol-relative, `javascript:`, `data:`, insecure `http:`, and control-character forms fail validation.

### Restricted preview boundary

The candidate preview remains designed to be:

- administrator-authenticated;
- read-only;
- GET-only;
- private and no-store;
- non-indexable;
- source-code allowlisted;
- unable to approve, publish, schedule, notify, or switch the public route.

The preview API remains candidate-only. Once this version is `registry_managed` and `effective`, the public canonical route is the relevant rendered surface for production verification.

### Canonical route and archive boundary

The canonical resolver requires all of the following before returning structured public content:

- global registry routing enabled;
- family state `registry_managed`;
- exactly one fully eligible `effective` version;
- `publicReady=true`;
- a valid effective timestamp that is not in the future;
- all required approvals bound to the exact source revision;
- no active publication blocker;
- a source-code allowlisted structured payload;
- exact payload document ID, version, payload path, source revision, and canonical-route identity.

The archive resolver independently requires archive routing, a registry-managed family, an `effective` or `superseded` version, and the same publication identity/approval/blocker safeguards.

## Product Owner review

Reviewer role: `Product Owner`

Current registry state: `effective`

The Product Owner review confirms the candidate faithfully represents the intended Accessibility page without introducing a new product promise.

The deployed restricted preview was reviewed for:

1. Title, description, and overall meaning matching the reviewed `/accessibility` source.
2. All current sections present in the expected order.
3. The Support link pointing to `/support?category=accessibility`.
4. The accessibility email target remaining `support@loombus.com` with the intended subject.
5. No added text representing a new legal, product, staffing, response-time, certification, or accessibility guarantee.
6. No current text missing or materially rephrased.
7. The preview clearly labeled as a non-public candidate during review.
8. No edit, approve, publish, schedule, notice, or route-switchover action available in the preview.

Outcome: `approved` for this exact version and source revision.

Evidence: Issue #671 comment `5237391065` records the explicit Product Owner confirmation.

## Accessibility review

Reviewer role: `Accessibility`

Current registry state: `effective`

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

## Publication authorization

After PR #887 established and deployed the fail-closed canonical-route adapter, the Product Owner explicitly authorized immediate technical activation of this exact reviewed version.

Authorization evidence: Issue #671 comment `5248313219`.

Authorization time: `2026-08-11T02:24:00.000Z` (`2026-08-10 22:24` America/New_York).

The authorization is limited to these lifecycle and routing changes:

- `registryRoutingEnabled: false -> true`;
- `archiveRoutingEnabled: false -> true`;
- Accessibility family `registry_candidate -> registry_managed`;
- version `approved -> effective`;
- `publicReady: false -> true`;
- `effectiveAt: null -> 2026-08-11T02:24:00.000Z`;
- `registry_route_switchover_not_authorized: active -> inactive`.

The authorization does not approve any content/source revision change. It does not authorize a member notice, create a legal approval, change Support operations, or alter Issue #667, #670, or #674 capabilities.

## Current blockers after activation

There are no active publication blockers for `POLICY-ACCESSIBILITY` version `2026.07.18.1`.

The retained blocker records are historical/auditable state markers:

- `registry_route_switchover_not_authorized` is inactive because the explicit Product Owner authorization is recorded in Issue #671 comment `5248313219`;
- `accessibility_parity_review_pending` is inactive because exact parity plus required human review are complete.

The `current-accessibility-route-parity` dependency remains non-blocking for this exact version/source revision.

## What the completed review and activation satisfy

- Product Owner approval satisfies only the `Product Owner` reviewer requirement.
- Accessibility approval satisfies only the `Accessibility` reviewer requirement.
- Completed parity evidence satisfies the parity-specific dependency for this exact reviewed version.
- Explicit Product Owner publication authorization permits the technical route/status activation for this exact reviewed version.
- Registry eligibility, canonical payload identity, and archive eligibility still fail closed if any required condition later drifts.

## Current registry lifecycle state

- family migration state: `registry_managed`;
- version status: `effective`;
- public ready: `true`;
- effective at: `2026-08-11T02:24:00.000Z`;
- registry routing: enabled;
- archive routing: enabled;
- active publication blockers: none;
- exact reviewed source revision: unchanged.

## Remaining Issue #671 work outside this activation

This activation completes the first controlled canonical migration for Accessibility. Issue #671 remains broader than this one document. Remaining product-system work includes the wider policy/help inventory and capabilities such as unified search, desktop/mobile category navigation, Jump to navigation, printable legal views, scheduled future effective-date workflows, change-note presentation where required, privacy-appropriate analytics, and scalable migration of additional drafts/families.

Future policy versions must preserve exact-version history and must not silently overwrite this effective version.

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

### Publication activation

State: authorized

Authorized by: `Inexthome`

Authorized at: `2026-08-11T02:24:00.000Z`

Evidence: Issue #671 comment `5248313219`.

Scope: technical activation of the exact reviewed version/source revision only.

## Safety boundary

This record documents policy-content review and technical publication authorization. It does not create a legal approval, legal conclusion, regulatory certification, accessibility certification, member notice, or authority for any Issue #667, #670, or #674 restricted capability.
