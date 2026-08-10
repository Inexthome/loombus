# Issue #671 Versioned Policy Content Contract

Status: internal proposed product contract

Issue: #671

Public publication authorized by this document: no

## Objective

Define the application-level contract that future Loombus Legal, Policy, Safety, Help, Room Governance, and Transparency content must satisfy before it can be published through the versioned content system.

This contract is intentionally independent from substantive legal approval. It governs identity, versioning, routing, publication eligibility, archives, navigation, search, and approval state. It does not decide whether any particular legal statement is correct.

## Core invariants

1. Document identity and version identity are separate.
2. A document ID is immutable for the life of the document family.
3. A version is immutable after it becomes effective.
4. Public routes resolve only eligible public versions.
5. Internal drafts never become public solely because they exist in source control.
6. `public_ready: false` is always publication-ineligible.
7. A scheduled version cannot replace the current effective version before its effective time.
8. Superseding a version preserves the prior effective text and metadata.
9. Historical version URLs resolve exact historical text.
10. A canonical route may change only through an explicit redirect/replacement record.
11. Required approvals are version-specific.
12. Approval of one version does not approve future edits.
13. Material content changes require a new version.
14. Search and navigation may expose only information appropriate to the viewer and publication state.
15. Public content rendering must fail closed when publication metadata is incomplete or inconsistent.

## Document identity

Every content family requires an immutable `document_id`.

Recommended format examples:

- `LEGAL-PRIVACY`
- `LEGAL-TERMS`
- `LEGAL-COOKIES`
- `POLICY-COMMUNITY-STANDARDS`
- `SAFETY-REPORTING-GUIDE`
- `HELP-ACCOUNT-SECURITY`
- `ROOM-GOV-MODERATOR-CODE`
- `TRANSPARENCY-LEGAL-REQUESTS`

The ID must not encode a version number.

Renaming a title or changing a slug does not change `document_id` when the underlying policy/document family remains the same.

## Version identity

Every immutable content revision requires a `version`.

Recommended format:

`YYYY.MM.DD.N`

Example:

`2026.08.10.1`

A content system may later adopt semantic or sequential versions, but one canonical version format must be enforced globally.

A version must be unique within its document family.

## Required metadata

Every version record must contain:

- `document_id`
- `version`
- `slug`
- `canonical_route`
- `title`
- `summary`
- `document_type`
- `category`
- `audience`
- `status`
- `public_ready`
- `effective_at`
- `last_reviewed_at`
- `owner`
- `required_reviewers`
- `approvals`
- `product_dependencies`
- `publication_blockers`
- `related_settings`
- `related_reports`
- `related_appeals`
- `related_support`
- `related_emergency_actions`
- `related_articles`
- `search_keywords`
- `jurisdiction`
- `locale`
- `source_revision`
- `change_note`
- `supersedes_version`
- `replacement_document_id`
- `withdrawal_reason`

Optional values must be explicit `null` or empty collections as defined by the future typed contract. Missing required keys must fail validation.

## Document types

Initial supported `document_type` values:

- `legal`
- `policy`
- `safety`
- `help`
- `room_governance`
- `transparency`

A future type requires a reviewed registry change rather than arbitrary free text.

## Categories

Initial categories may include:

- account
- privacy
- security
- content
- community
- messaging
- rooms
- ai
- search
- commerce
- jobs
- services
- marketplace
- billing
- accessibility
- developer
- legal_requests
- child_safety
- moderation
- appeals
- transparency

Category is for navigation and search. It does not establish legal effect.

## Audience

Initial audience values:

- `public`
- `members`
- `room_owners`
- `creators`
- `businesses`
- `developers`
- `administrators`
- `internal_only`

An `internal_only` version is never eligible for a public route.

## Publication status state machine

Allowed status values required by Issue #671:

- `internal_draft`
- `review`
- `approved`
- `scheduled`
- `effective`
- `superseded`
- `withdrawn`

Allowed forward transitions:

- `internal_draft -> review`
- `review -> internal_draft`
- `review -> approved`
- `approved -> review`
- `approved -> scheduled`
- `approved -> effective`
- `scheduled -> approved`
- `scheduled -> effective`
- `effective -> superseded`
- `approved -> withdrawn`
- `scheduled -> withdrawn`
- `effective -> withdrawn` only through a replacement/withdrawal process that preserves the historical record

The future implementation should reject undocumented arbitrary transitions.

## `public_ready` invariant

`public_ready` is an independent fail-closed flag.

The following rule is absolute:

```text
public_ready = false => public publication ineligible
```

Setting `public_ready=true` is necessary but not sufficient for publication.

A version also needs eligible status, required approvals, valid dates, no blocking publication blockers, and a public-compatible audience.

## Approval contract

Each version must declare required reviewers by role, not by an assumed individual identity.

Examples:

- Product Owner
- Trust and Safety
- Privacy
- Security
- Accessibility
- Billing
- Legal
- Employment Counsel
- Commerce Counsel
- Advertising Counsel

Each approval record should contain:

- reviewer role;
- approval state;
- approved by identifier where appropriate;
- approved at timestamp;
- source revision reviewed;
- note/reference;
- whether reapproval is required after change.

Initial approval states:

- `pending`
- `approved`
- `changes_requested`
- `not_required`

A required reviewer cannot be satisfied by `not_required` unless the version contract itself has been formally changed to remove that role.

## Legal-review boundary

The system must not infer legal approval from:

- repository merge;
- owner approval;
- administrator status;
- `public_ready=true` alone;
- prior approval of a different version;
- AI output;
- issue closure;
- a successful build or deployment.

If Legal is a required reviewer, the specific version must contain a valid Legal approval record before publication eligibility becomes true.

## Publication eligibility

A future shared function should calculate publication eligibility instead of letting route components make ad hoc decisions.

Conceptual rule:

```text
eligible =
  public_ready is true
  AND audience is public-compatible
  AND status is effective
  AND effective_at is not in the future
  AND all required reviewers are approved
  AND publication_blockers is empty
  AND source revision matches the approved revision
  AND document/version relationship is valid
```

For scheduled activation, a scheduler/resolver may transition an already approved version to effective only when all required conditions still hold.

If any required condition is unknown, the result is ineligible.

## Source revision integrity

Every version requires `source_revision` tied to the exact content payload reviewed.

Changing content after approval changes the source revision and invalidates approvals unless the approval explicitly covers the new revision through a controlled update.

A future verifier must detect an approval record pointing to a different source revision.

## Content payload

Version metadata and content payload should be separate concerns but tied by immutable identity.

The payload must include a structured long-form representation suitable for:

- semantic headings;
- paragraphs;
- lists;
- callouts;
- related links;
- tables where necessary;
- Jump to navigation;
- print rendering;
- search indexing.

The implementation should avoid arbitrary executable JSX inside policy content where a serializable structured content representation is sufficient.

This reduces the risk that policy text can execute application logic or that route components become the content database.

## Historical immutability

Once a version becomes `effective`, ordinary application operations must not mutate its content payload or approval record in place.

A correction requires a new version.

Administrative metadata such as a post-publication archive annotation may be added only through a separately defined append-only or versioned mechanism.

## Supersession

When version B replaces effective version A:

1. B must be independently approved and publication-eligible.
2. B becomes effective at its configured time.
3. A becomes superseded.
4. A retains its original content, approval record, and effective start.
5. A records B as its superseding version.
6. the canonical route resolves B.
7. A remains available through its exact historical route.

No destructive overwrite occurs.

## Withdrawal

Withdrawal is distinct from supersession.

A withdrawn document/version must preserve:

- original text;
- effective history if previously effective;
- withdrawal reason;
- withdrawal time;
- replacement document if one exists.

The public archive may show an appropriate withdrawn status notice without exposing internal rationale that is not approved for publication.

## Canonical routes

Every public document family requires one canonical current route.

Existing routes should remain stable where possible.

Examples:

- `/privacy`
- `/terms`
- `/cookies`
- `/guidelines`
- `/safety`
- `/dmca`
- `/refunds`
- `/accessibility`
- `/support`

A route migration must not break existing external links when a redirect can preserve them.

## Historical version routes

Recommended public archive pattern:

```text
/policies/archive/<document-id>/<version>
```

The exact route can change during implementation, but the contract requires an immutable addressable version path.

The archive route must not use mutable aliases such as `latest` as the only historical identifier.

## Version history page

A current document should expose an approved version-history view containing public-safe metadata such as:

- current version;
- effective date;
- superseded versions;
- change notes;
- link to each historical version.

Internal review notes, private approval comments, publication blockers, and security-sensitive implementation details are not automatically public.

## Scheduled effective dates

A scheduled version requires:

- status `scheduled`;
- `public_ready=true`;
- all required approvals complete;
- future `effective_at`;
- no publication blockers;
- valid predecessor relationship if replacing a current document.

At activation time the resolver must re-check eligibility rather than assume conditions remain unchanged.

If eligibility fails, the current effective version remains in place.

## Change notes

A `change_note` is required when a version materially changes rights, obligations, eligibility, pricing terms, privacy practices, enforcement standards, or other member-facing commitments.

Change notes should be plain-language and scoped to what actually changed.

A change note does not substitute for the full document.

## Related-document graph

Each document may link to related settings, reports, appeals, support, emergency actions, and articles.

These links should be typed categories instead of arbitrary prose-only references.

Examples:

- privacy policy -> `/privacy-security`
- safety guide -> in-product reporting
- appeal policy -> appeal flow
- subscription terms -> billing management
- Room governance -> Room settings and moderation tools

The graph must not expose internal-only routes to public viewers.

## Search index contract

Public content search may index only versions that are public-visible under the publication contract.

Searchable fields may include:

- title;
- summary;
- headings;
- body text;
- category;
- approved search keywords;
- related article titles.

Search must exclude:

- internal drafts;
- review versions;
- future scheduled body text before publication unless explicitly approved for advance notice;
- internal approval notes;
- publication blockers;
- private reviewer identities where not intended for publication;
- withdrawn internal-only content.

## Category navigation

Navigation should derive from registry metadata and expose only public-visible categories/documents.

Desktop and mobile navigation must use the same source contract to avoid drift.

## Jump to navigation

Long documents should derive section navigation from structured section IDs/headings.

Requirements:

- stable section anchors within a version;
- keyboard accessible links;
- visible focus;
- scroll offset compatible with the site header;
- no duplicate heading IDs.

## Print contract

Legal/policy pages should provide a print-friendly rendering of the same exact effective content.

Print mode must not create a second editable copy of the policy text.

It should remove unnecessary navigation/application chrome while retaining:

- Loombus/document identity;
- version;
- effective date;
- title;
- complete content;
- relevant public contact information;
- historical/current status where applicable.

## Locale and jurisdiction

Initial defaults may use:

- locale: `en-US`;
- jurisdiction: `global` or an explicit scoped value.

A jurisdiction-specific version must not silently replace a global document for users outside its scope.

Future localization needs explicit fallback rules.

## Publication blockers

Blockers are structured records, not freeform hidden exceptions.

Examples:

- qualified legal review pending;
- product behavior not deployed;
- retention schedule not verified;
- accessibility review pending;
- billing terms not configured;
- emergency operation not staffed;
- required support workflow missing.

Any active blocker makes publication ineligible.

## Product dependency contract

Each version may identify implementation dependencies such as:

- account deletion controls;
- Trust and Safety operations;
- Legal Operations;
- file scanning;
- private attachment delivery;
- billing flows;
- AI provider architecture;
- commerce taxonomy;
- Room governance.

A dependency record should identify whether it is informational or publication-blocking.

## Approval and source-control relationship

Git merge and deployment remain engineering events.

The content system must record policy approval separately.

Recommended relationship:

- source revision identifies exact content;
- CI verifies structural validity;
- reviewer approvals attach to that revision;
- publication resolver confirms eligibility;
- deployment makes the eligible content available;
- effective date controls when it becomes current.

## CI verification requirements

Phase B should add a static verifier that fails when:

- duplicate document IDs exist for different families;
- duplicate versions exist within one document;
- canonical routes collide;
- version relationships are invalid;
- an effective version is `public_ready=false`;
- a public effective version lacks required approvals;
- a scheduled version lacks a future effective date;
- an effective version has a future effective date;
- a superseded version lacks a successor where required;
- source revision/approval revision mismatches occur;
- internal-only content is marked public-effective;
- required metadata keys are missing;
- related document IDs reference unknown documents;
- search/navigation metadata attempts to expose internal-only content.

## Public route migration gate

No current public route should be switched to the new loader until the target document has:

- a valid registry record;
- immutable payload;
- parity review against the current route;
- required approvals;
- publication eligibility pass;
- accessibility/mobile review;
- version-history behavior;
- redirect verification where applicable.

## First 20 drafts support

The architecture must support at least the first 20 policy drafts without writing one page component per document.

The intended pattern is:

```text
registry metadata
+ immutable version payload
+ shared resolver
+ shared renderer
= public or internal policy page
```

Route components should be thin routing shells rather than policy text containers.

## No-database initial implementation

Issue #671 can begin with a repository-backed typed registry and immutable content files.

A database is not required solely to satisfy version identity and publication gating.

A future database may be justified for editorial workflows, but it must not weaken source-controlled review, immutable history, or publication eligibility.

## Security boundary

The content system must never use client-supplied status, version, audience, or approval state to decide public visibility.

Public eligibility must be calculated from trusted server/build-time registry data.

Internal content files must not be fetchable from a public asset path merely because the route resolver refuses to render them.

## Rollout boundary

This contract authorizes only future implementation of the content system.

It does not:

- approve any substantive legal text;
- publish an internal draft;
- change an existing public policy;
- satisfy qualified counsel review for Issues #667, #670, #674, or other counsel-gated work;
- change Support operations;
- create member notices;
- schedule any policy change;
- enable external legal or safety actions.

## Phase B implementation target

After this contract is merged, the next narrow PR should add:

- `src/lib/policy-content-registry.ts` typed contract;
- repository-backed initial registry data for document families and internal migration metadata;
- publication eligibility helpers;
- `scripts/verification/verify-policy-content-registry.mjs`;
- CI workflow covering registry/content changes;
- no public route migration yet.

That phase should prove the gate before any internal draft is connected to a public route.