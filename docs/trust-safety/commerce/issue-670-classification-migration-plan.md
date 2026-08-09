# Issue #670: Canonical Classification Migration Plan

## Status

**Status:** Internal implementation plan  
**Tracks:** Issue #670  
**Depends on:** canonical commerce taxonomy and production report/reason audit  
**Public ready:** No  
**Production schema change authorized by this document:** No

This plan defines the controlled path from Loombus's existing module-native reports and moderation actions to a shared canonical commerce classification contract.

It is intentionally additive. It does not authorize rewriting historical reports, changing public policy, changing legal standards, or automatically enforcing a classification.

## 1. Objective

Create one versioned classification layer that can answer, for an authorized reviewer:

- what source record was reviewed;
- which Issue #670 `COM-##` category was confirmed;
- which canonical safety reason or reasons apply;
- what contextual modifiers matter;
- which severity model is being used;
- who classified the record and when;
- what evidence/basis supported the classification;
- whether a later classification superseded the earlier one.

The classification layer must not answer a different question such as whether the member must be suspended, whether a report must be disclosed externally, or whether conduct is unlawful. Those remain separate decisions.

## 2. Architecture direction

### Preferred model

Use a shared classification ledger rather than adding a different canonical-reason implementation to every module.

A shared ledger is preferable because:

- Marketplace, Businesses, Jobs, Events, Requests, Services, Rooms, Appointments, Local-linked records, and messages already have different source schemas;
- the Issue #670 taxonomy must remain consistent across modules;
- a classification may involve several safety reasons;
- classification history should be auditable and supersedable;
- original reports must remain intact;
- enforcement and appeals already have their own canonical records;
- legal preservation already has a separate system.

The final database design must still be verified against current source schemas and RLS before migration.

## 3. Proposed classification record

The following is a proposed contract for the implementation phase. Names may be adjusted during schema review, but the semantic separation should be preserved.

### Identity and source

- `id`
- `source_module`
- `source_record_type`
- `source_record_id`
- `report_id` nullable
- `taxonomy_family = commerce_integrity`
- `taxonomy_version`

### Canonical classification

- `commerce_category_id` using `COM-01` through `COM-15`
- `primary_safety_reason_code`
- `secondary_safety_reason_codes[]`
- `context_modifiers[]`

### Severity

Never store an ambiguous naked `S1` through `S4` value.

If canonical policy severity is required, use an explicitly namespaced value or field such as:

- `POLICY.S0`
- `POLICY.S1`
- `POLICY.S2`
- `POLICY.S3`
- `POLICY.S4`

Trust and Safety queue severity remains separate, for example:

- `TS.S1_CRITICAL`
- `TS.S2_HIGH`
- `TS.S3_ELEVATED`
- `TS.S4_STANDARD`

A commerce classification does not have to duplicate T&S triage severity if no T&S case exists.

### Review state

- `classification_status`, such as `proposed`, `confirmed`, `superseded`, `void`
- `classification_source`, such as `human_review`, `exact_legacy_mapping`, or another approved source
- `classified_by`
- `classified_at`
- `basis_note`
- `supersedes_classification_id` nullable

### Optional linkage

Where useful and authorized:

- `enforcement_decision_id` nullable
- `trust_safety_case_id` nullable

These are links only. A classification must not create an enforcement decision or Trust and Safety case merely by existing.

## 4. Fields that must remain outside the classification ledger

Do not move or duplicate the following into the canonical classification record unless a specific implementation need is established:

- raw member report text;
- private-message body;
- raw protected evidence;
- reporter identity beyond a necessary source reference;
- victim or witness details;
- legal-request contents;
- full administrator investigation notes;
- payment credentials;
- passwords or authentication secrets;
- unnecessary medical or identity documents.

The ledger should point to authorized source records rather than become a new sensitive-data warehouse.

## 5. Authorization model

The classification layer should be restricted to specifically authorized operational roles.

At minimum, the implementation must ensure:

- no anonymous write access;
- no ordinary authenticated member write access;
- no direct browser mutation that bypasses the server authorization contract;
- administrator/Trust and Safety authorization appropriate to the source and category;
- legal-review-only data is not exposed to ordinary Platform Operations;
- private Room/message evidence remains protected by its original authorization boundary;
- every classification create/supersede/void operation is auditable.

A general platform administrator role does not automatically justify access to every class of restricted evidence.

## 6. Immutability and correction model

Confirmed classification history should be auditable.

Prefer supersession over silent mutation when a material classification changes.

For example:

1. reviewer confirms `COM-13` with a primary fraud reason;
2. later evidence shows the commercial record was a credential-deception case better classified as `COM-11`;
3. the original record remains in history as superseded;
4. a new classification references the prior classification;
5. downstream enforcement or notice correction is handled through its own workflow.

This prevents a later edit from making the historical decision disappear.

## 7. Original reporter input

The classification migration must preserve original reporter input.

A member may write a reason that is:

- incomplete;
- mistaken;
- emotionally worded;
- broader than the reviewed violation;
- narrower than the reviewed violation;
- unrelated to the ultimate enforcement action.

Therefore:

- original report reason remains source data;
- original details remain source data;
- canonical classification is a reviewer conclusion;
- report resolution remains a separate conclusion;
- enforcement remains a separate decision.

## 8. Legacy migration strategy

### Default

Historical reports should remain `unclassified` under the new taxonomy unless there is a valid reason to classify them.

### Safe deterministic mapping

An exact mapping may be permitted when an old enumerated value has one unambiguous meaning under the new taxonomy and the mapping is reviewed.

The migration record should identify that it came from `exact_legacy_mapping` rather than human review.

### Prohibited bulk inference

Do not automatically create confirmed classifications by:

- keyword matching free text;
- fuzzy matching;
- embeddings;
- LLM classification;
- assuming the enforcement action identifies the reason;
- assuming a removed record was prohibited under a specific current category.

Automation may queue likely records for human review but must not manufacture historical certainty.

## 9. Module integration strategy

### Marketplace

Add canonical classification to reviewed listings/reports without changing original reporter input or listing lifecycle states.

### Businesses

Separate identity/ownership/verification workflow from confirmed commerce-integrity violations.

### Jobs

Support employment-specific canonical mappings while retaining employer publication and application lifecycle state separately.

### Events

Preserve `report.reason` and `report.details`; canonical classification becomes a separate reviewer field.

### Requests

Preserve Request lifecycle and distinguish prohibited request content from ordinary fulfillment/status issues.

### Services

Support professional-claim categories while avoiding unsupported conclusions about licensing or legal compliance.

### Rooms

Only add a commerce classification where the underlying reviewed conduct is commercial/professional. Do not turn Room governance violations into commerce categories by default.

### Appointments

Do not classify routine cancellation reasons. Create a commerce classification only when the reviewed conduct maps to a covered integrity category.

### Local

Display/inherit source classification where authorized. Local diagnostic records remain operational diagnostics.

### Private messages

Use source-reference linkage only after the exact message-report authorization and schema are audited. Do not copy message bodies into the classification ledger.

## 10. Administrator experience

The eventual Platform Operations classification control should make it difficult to confuse allegation, classification, and action.

A reviewer should see distinct sections for:

1. **Reported concern**: original member reason/details;
2. **Canonical classification**: `COM-##`, safety reasons, context, policy severity if applicable;
3. **Operational decision**: resolve/dismiss and module action;
4. **Enforcement linkage**: any separate canonical enforcement decision;
5. **Escalation**: T&S, Security, Privacy, Legal/Compliance where applicable.

The interface should not preselect a severe category merely because a member selected an alarming report label.

## 11. Member notice

Member-facing notice should use approved, plain-language reasons derived from the confirmed classification and enforcement decision.

The notice system should not expose:

- internal reason-code syntax unless intentionally designed for members;
- reporter identity;
- victim/witness details;
- protected evidence;
- security methods;
- legal-request information;
- internal confidence scores;
- T&S case identifiers.

A classification alone does not send a notice.

## 12. Appeals

The existing universal enforcement and appeals system remains the source of truth for appealable enforcement decisions.

Issue #670 classification should support appeals by making the reviewed reason consistent, but it should not create a separate competing appeal system.

When an appeal changes the underlying determination:

- the enforcement workflow records the appeal outcome;
- any necessary classification correction should supersede the old classification;
- the source report remains unchanged;
- restoration remains governed by the enforcement/restoration contract.

## 13. Duplicate and evasive reposting

Issue #670 requires duplicate/evasive reposting treatment.

The classification layer may reference existing duplicate/evasion evidence or canonical reasons such as `INTEGRITY.DUPLICATE_OR_EVASIVE_REPOSTING`.

However:

- similarity alone is not proof of evasion;
- legitimate relisting/renewal must remain distinguishable from prohibited reposting;
- automated duplicate confidence must not independently create a confirmed policy classification;
- enforcement should record the actual action separately.

## 14. Age and location

Age or location dependency belongs in the taxonomy and review context, not as a shortcut to a legal conclusion.

Existing protected-commerce age controls remain authoritative for member eligibility.

A future classifier may record that a category has `age_dependency` or `location_dependency`, but the actual legal significance and any jurisdiction-specific statement require the applicable reviewed standard.

## 15. Retention and preservation

Classification records must participate in the existing Issue #668 retention and Issue #674 preservation architecture.

Implementation requirements include:

- classification records have a defined record class;
- active legal holds can preserve relevant classification history within scope;
- source deletion does not silently falsify an audit claim;
- retention does not become indefinite merely because the record is a policy classification;
- destructive disposition fails closed where applicable holds or unresolved restrictions exist.

No retention period is invented by this document.

## 16. External reporting and disclosure

Issue #670 must not create an external-reporting side effect.

A classification such as child exploitation, trafficking, credible threat, or another severe category may require internal escalation under the approved T&S process, but it must not automatically:

- contact law enforcement;
- contact NCMEC or another organization;
- create an emergency disclosure;
- export member data;
- transmit data externally;
- send a legal member notice.

Those actions remain controlled by the counsel-gated Issue #667/#674 procedures.

## 17. AI and automation

AI may eventually support a `proposed` classification state if product, privacy, safety, and legal review permit it.

Required boundaries:

- the AI suggestion is visibly non-final;
- model/provider/version or provenance is recorded where necessary;
- a human confirms, changes, or rejects it;
- AI cannot set `confirmed` status independently;
- AI cannot create enforcement or external-reporting authority;
- AI cannot infer legal illegality as a final conclusion;
- AI cannot silently expand evidence access.

For the initial production phase, manual human classification is the safer default.

## 18. Implementation phases

### Phase A: exact source-schema audit

Verify current table/API/report fields for:

- Marketplace;
- Businesses;
- Jobs;
- Events;
- Requests;
- Services;
- Rooms;
- Appointments;
- private messages.

Confirm source identifiers, RLS, deletion behavior, report enums/free text, and enforcement links.

### Phase B: shared application contract

Create a single versioned TypeScript registry for:

- `COM-01` through `COM-15`;
- titles and plain-language internal labels;
- allowed source modules;
- canonical safety-reason compatibility;
- taxonomy version validation;
- namespaced severity validation.

This phase must not alter moderation behavior by itself.

### Phase C: database classification foundation

Create the restricted classification ledger with:

- RLS;
- server-controlled writes;
- append-only or supersession controls;
- source-reference validation;
- audit events;
- no public/member direct access;
- preservation/retention integration.

### Phase D: restricted API and Platform Operations UI

Add manual reviewer classification controls.

Do not auto-enforce.

### Phase E: module mapping

Connect each covered module to the shared classification layer without replacing original reports.

### Phase F: synthetic controlled verification

Use fictional records only. Verify:

- each `COM-##` category can be represented where applicable;
- original reason/details remain unchanged;
- invalid cross-module/category combinations fail closed;
- severity namespaces cannot be mixed;
- supersession works;
- unauthorized access fails;
- no external reporting/transmission occurs;
- no real member data is required.

### Phase G: notice/enforcement integration

Map confirmed classification into the existing enforcement and member-notice systems where appropriate.

Keep classification and action separate.

### Phase H: counsel-ready package

After internal product/technical completion, provide qualified counsel with:

- the canonical taxonomy;
- source-contract audit;
- classification schema and controls;
- module applicability matrix;
- proposed public reason language;
- regulated-category questions;
- employment/professional-practice questions;
- advertising/endorsement questions;
- age/location dependencies;
- verification evidence.

### Phase I: public policy conversion

Only after required counsel decisions are incorporated:

- Marketplace Prohibited Items;
- Jobs Integrity Standard;
- Services and Professional Claims Standard;
- regulated-goods policy language;
- relevant Reporting Guide and Help articles

can be moved toward public-ready status.

## 19. Fail-closed conditions

A future classification mutation should fail when:

- category ID is unknown;
- taxonomy version is unknown;
- source module is unsupported;
- source identifier is malformed or cannot be validated where validation is required;
- reviewer lacks authority;
- bare ambiguous severity code is supplied;
- confirmed status is requested by an unauthorized automated source;
- supersession reference is invalid;
- classification attempts to create an external disclosure/reporting side effect;
- protected source evidence would be exposed to an unauthorized role.

## 20. Validation requirements for the future technical PR

At minimum:

- TypeScript validation;
- targeted ESLint;
- migration replay from empty if a schema migration is included;
- RLS/grant verification;
- no browser write privilege;
- append-only/supersession tests;
- taxonomy ID/version validation;
- severity namespace validation;
- source-module compatibility tests;
- synthetic classification lifecycle tests;
- enforcement-separation tests;
- no-external-action tests;
- diff/scope verification.

## 21. Completion boundary

Issue #670 can become **internally complete / counsel-package ready** when:

- all covered modules map to the shared canonical taxonomy;
- administrator tooling uses consistent structured reasons;
- original reports remain preserved;
- classification history is auditable;
- duplicate/evasive behavior is represented consistently;
- age/location dependencies are explicit;
- member-notice and appeal mappings are prepared;
- controlled synthetic verification passes;
- public drafts are reconciled to the canonical terms;
- all unresolved legal standards are isolated into a consolidated counsel handoff.

Issue #670 is not **final legally approved** until the qualified commerce, employment, advertising, professional-practice, and regulatory review required by the issue is completed and incorporated.

## 22. Immediate next step

After this audit/plan is merged, the next narrow phase should complete the exact source-schema/API audit and then build the shared application taxonomy registry before any database migration is introduced.

That sequence keeps the migration grounded in production reality and prevents irreversible schema decisions based on incomplete assumptions.