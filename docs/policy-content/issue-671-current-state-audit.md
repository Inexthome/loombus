# Issue #671 Current-State Audit

Status: internal implementation audit

Issue: #671

Audit date: 2026-08-10

Public policy change authorized by this document: no

## Purpose

Issue #671 requires Loombus to move from individually embedded public policy pages to a structured, versioned policy and Help content system with publication approval, history, search, navigation, scheduled effective dates, and stable canonical URLs.

This audit records what already exists so the implementation does not rebuild the current public Trust and Reference experience.

## Current public content already in production

Prior merged work established current canonical public routes including:

- `/about`
- `/accessibility`
- `/cookies`
- `/dmca`
- `/guidelines`
- `/privacy`
- `/refunds`
- `/safety`
- `/terms`
- `/support`
- `/settings/guide`
- `/ai-usage`

The existing `/contact` route redirects to `/support` rather than maintaining a second support form.

Current public pages already have a shared presentation layer through `src/components/public-policy-page.tsx` for many legal and policy routes. That component supports a shared page shell, section rendering, effective/reviewed dates, and long-form policy presentation.

## Current Help and search behavior

The existing `/support` route is already the canonical Loombus Help & Support Center.

Existing Support capabilities include:

- public help-area navigation;
- help search across areas, guides, platform actions, and keywords;
- links to current canonical product routes;
- structured support-request submission;
- signed-in account context where available;
- signed-out support access;
- current support request categories;
- safety and policy references;
- mobile-responsive presentation;
- Light, Dark, and System appearance support.

Issue #671 therefore should not create a second Help Center or replace the current support request queue.

## Current route and visual continuity

Existing Trust and Reference work already provides:

- current canonical URLs;
- shared public-reference navigation patterns;
- responsive page presentation;
- Light, Dark, and System support;
- accessibility-oriented heading and layout conventions;
- a shared platform route registry used by search surfaces;
- redirects for selected legacy routes.

The new content system must preserve those routes and visual contracts.

## Current policy-content storage model

The current major public legal/policy pages are still authored directly in route/component source files.

For example, the Privacy Policy stores its section structure directly in `src/app/privacy/page.tsx` and passes the sections into the shared `PublicPolicyPage` component.

The shared component is a presentation primitive, not a version registry. It does not itself provide:

- immutable document identity;
- immutable version identity;
- approval history;
- replacement or supersession links;
- historical-version retrieval;
- scheduled activation;
- publication blockers;
- required reviewer state;
- related document graph;
- jurisdiction/locale metadata;
- source revision tracking;
- material-change notes.

## Existing internal draft estate

The Trust and Safety policy program already contains many internal Markdown drafts under `docs/trust-safety/`.

Those documents use metadata such as:

- `document_id`;
- `status`;
- `public_ready`;
- `owner`;
- `legal_review`;
- `prepared`.

Several recent policy-program phases intentionally keep `public_ready: false` content internal until operational and legal review is complete.

The future publication system must preserve that safety boundary. An internal draft cannot become public merely because it exists in the repository or can be parsed by the application.

## Current version-history gap

The reviewed public-route architecture does not establish a general public version-history route that can retrieve superseded text after a replacement becomes effective.

The current embedded-page model also creates a risk that editing a route source file replaces the text without preserving a public historical copy unless the prior source is recovered from Git history.

Git history is valuable engineering evidence, but it is not an acceptable substitute for an intentional public policy archive because:

- it is not a member-facing policy history;
- it does not provide a stable public version URL;
- it does not encode effective dates and replacement relationships as a product contract;
- it can contain unrelated implementation changes;
- it does not provide a policy-specific approval record.

## Current publication-gate gap

The repository contains internal `public_ready: false` policy drafts, but the current public route model does not expose a shared application-level publication guard that rejects such content.

Issue #671 therefore needs an explicit invariant:

> No content record may render on a public policy route unless its publication state is eligible and all required approvals for that version are satisfied.

This must be enforced in code and verified by automated tests before internal drafts are connected to public routing.

## Current scheduled-effective-date gap

The current route files can display an effective date, but displaying a date is not the same as scheduling a version.

The future system needs to distinguish:

- approved but not yet effective;
- scheduled;
- currently effective;
- superseded;
- withdrawn.

A future effective version must not replace the current effective version before its scheduled activation time.

## Current archive gap

Issue #671 requires prior effective versions to remain retrievable.

The future archive must preserve at minimum:

- document ID;
- version;
- exact version content;
- effective interval;
- source revision;
- approval record;
- change note when applicable;
- superseded-by relationship.

Historical versions must be immutable through ordinary application operations.

## Canonical-route requirements

The current canonical routes should remain stable wherever practical.

The versioned system should use two distinct route concepts:

1. canonical current route, such as `/privacy`;
2. immutable historical route, such as a version-specific archive route.

The canonical route resolves only the currently effective approved version.

A version-specific route resolves only the requested archived version and never silently redirects to newer text unless the requested version does not exist and a deliberate redirect contract applies.

## Required content categories

Issue #671 must support at least these content families without creating separate publishing engines:

- Legal;
- Policy;
- Safety;
- Help;
- Room Governance;
- Transparency.

The content contract should also be extensible to subscription, commerce, developer/API, privacy, AI, and product-reference documents without changing the core versioning model.

## Search requirements

The current Support Center already has help search and the platform has a route registry used by search experiences.

Issue #671 should integrate with those systems rather than create an unrelated search index.

A future policy-content search result should expose only publishable/effective public documents to signed-out users.

Internal drafts, scheduled future versions, withdrawn internal material, review comments, approval metadata, and publication blockers must not become public search results.

## Navigation requirements

The current public presentation already supports long-form pages and shared navigation patterns.

Issue #671 still needs a structured navigation contract that can derive:

- category navigation;
- related documents;
- Jump to section navigation;
- version history links;
- current/superseded status notices.

Navigation should derive from the content registry rather than being duplicated separately in every policy route.

## Print and accessibility requirements

The future page renderer must preserve the current readable legal-page experience and add print-specific behavior without embedding legal content inside print-only components.

Required behavior includes:

- semantic heading order;
- keyboard-reachable Jump to links;
- visible focus state;
- readable line length;
- responsive mobile layout;
- Light, Dark, and System support;
- print view that excludes unnecessary application chrome;
- no information communicated by color alone.

## Analytics boundary

Policy/help analytics should remain minimum-necessary.

The content system does not need to create a member-level legal-reading dossier.

A later analytics implementation should favor aggregate route/content performance and search utility while avoiding unnecessary storage of sensitive query or account linkage.

No analytics schema or tracker is authorized by this audit.

## Migration principle

The current public pages remain the production source of truth until a versioned document has:

1. a complete registry record;
2. a complete immutable content version;
3. required internal review;
4. required qualified legal review where applicable;
5. publication approval;
6. effective-date configuration;
7. route parity verification;
8. accessibility/mobile verification.

The new system must not hide, rewrite, or replace existing public legal pages merely because the registry foundation exists.

## Initial implementation phases

Recommended sequence:

### Phase A: contract and audit

- current-state audit;
- exact metadata contract;
- publication-state machine;
- archive and redirect rules;
- migration plan.

### Phase B: application registry and verifier

- typed registry contract;
- fail-closed publication eligibility function;
- static validation script;
- CI drift check;
- no public route switchover yet.

### Phase C: versioned content loader and archive renderer

- content records stored outside route components;
- current-version resolver;
- immutable version resolver;
- archive/version history renderer;
- no unapproved content publication.

### Phase D: public hub, search, navigation, print

- category hub;
- unified public content search;
- Jump to navigation;
- related-document graph;
- printable legal views.

### Phase E: controlled route migration

- migrate existing public documents one at a time;
- preserve canonical paths;
- create redirects only where intentional;
- compare old and new rendered content;
- keep unpublished drafts inaccessible.

### Phase F: scheduled activation and change notes

- scheduled effective dates;
- version replacement;
- material-change notes;
- superseded archive retrieval.

## Safety boundaries for Issue #671

Until the controlled migration phases are approved:

- do not expose internal `public_ready: false` drafts;
- do not mark a draft legally approved;
- do not publish Issue #670, #674, or other counsel-gated language merely because it is registered;
- do not silently overwrite current public policy text;
- do not delete prior effective versions;
- do not change Support request behavior;
- do not add external legal promises;
- do not create scheduled publication without an explicit approval record.

## Audit conclusion

Loombus already has the visual, route, Support, and search foundations needed for Issue #671.

The missing capability is a single structured document/version contract with a fail-closed publication gate, historical archive, scheduled-effective-state model, and controlled migration path.

The first implementation should therefore add those foundations without rebuilding current public pages.