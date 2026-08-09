# Issue #674: Counsel Handoff & Readiness Matrix

## Status

Internal counsel-handoff document only.

This document does not approve a legal standard, create a legal obligation, authorize an export or disclosure, establish emergency or child-safety reporting criteria, send a member notice, contact an outside party, or publish a public law-enforcement guideline.

Issue #674 has reached the point where the remaining substantive and executable phases depend on qualified counsel review. The technical foundations below are deployed or production-validated, but downstream legal decisions and external-action workflows remain deliberately disabled.

## Current production boundary

The deployed Legal Operations system now provides restricted internal infrastructure for intake, review, preservation, draft disclosure preparation, protected-party review, Legal Data Map review, export-integrity review, retention methodology review, transparency methodology review, member-notice/confidentiality draft review, emergency draft review, and internal Trust & Safety coordination.

Production validation has repeatedly confirmed that downstream authorities remain separated from those review capabilities.

The following must remain disabled until a separately approved implementation phase:

- `can_export`
- `can_disclose`
- `can_approve_emergency`
- external reporting
- external contact
- external transmission
- member-notice sending
- `ACCOUNT_DELETION_DESTRUCTIVE_HANDLERS_ENABLED`
- `ROOM_PERMANENT_DELETION_ENABLED`

No existing foundation should be interpreted as approval to exercise one of those powers.

## Evidence baseline

This handoff is based on the production work completed through PRs #844 through #865, including:

- PR #844: restricted Legal Operations storage and authorization foundation
- PR #845: restricted Legal Operations workspace and server API
- PRs #846 through #850: controlled preservation lifecycle usability and audit hardening
- PR #851: exact legal-hold enforcement at account and Room destructive database boundaries
- PR #852: Room Storage pre-remove legal-hold guard
- PR #853: draft disclosure-preparation controls and least-data manifest preparation
- PR #854: separation of disclosure preparation from export authority
- PR #855: Admin shortcut to Disclosure Preparation
- PR #856: dedicated legal-request review capability and database authorization boundary
- PR #857: protected-party review controls
- PR #858: Legal Data Source Registry and restricted Legal Data Map
- PR #859: chain-of-custody and export-integrity foundation
- PR #860: Legal Operations retention and disposition foundation
- PR #861: aggregate transparency-reporting foundation
- PR #862: restoration of shared legal-request review trigger coverage
- PR #863: member-notice and confidentiality decision-control foundation
- PR #864: emergency-review decision-control foundation
- PR #865: internal safety-coordination foundation

Production verification evidence is recorded on Issue #674. No real legal request, real member data, actual export, disclosure, external transmission, or outside-party contact is required to review this handoff.

## Required-capability matrix

| Issue #674 requirement | Current deployed/control state | Current status | Counsel decision or approval needed before downstream implementation |
| --- | --- | --- | --- |
| Official legal-request intake channel and identity verification | Restricted intake workflow exists. `legal@loombus.com` is the designated formal legal-request channel in the internal operating record. Request records include requester identity status and review metadata. | Foundation deployed | Confirm accepted intake channels, identity-verification evidence, authorized-requester validation, service/receipt handling, and when a request must be treated as unverified, deficient, or rejected. |
| Jurisdiction and authority review | Legal Requests store jurisdiction, asserted authority, authority-review status, summary, and counsel-review state. Review-sensitive changes require dedicated Legal Operations review authority. | Foundation deployed | Define the legal sufficiency standards, escalation conditions, review documentation expectations, and circumstances requiring counsel rather than an internal reviewer. |
| Request-scope validation and narrowing | Original scope, narrowed scope, scope-review status, deficiency, and rejection metadata are available and review-protected. | Foundation deployed | Approve narrowing principles, overbreadth treatment, deficiency language, rejection grounds, and when clarification or amended process is required. |
| Preservation-hold creation, expiry, extension, and release | Draft, active, released, and expired hold lifecycle is deployed with append-only history, target records, explicit activation/release/expiry audit events, and exact destructive-path enforcement. | Operational control deployed | Approve legal-basis requirements, hold duration rules, renewal/extension standards, release criteria, review cadence, and treatment of conflicting preservation obligations. |
| Table, Storage, log, billing, support, Room, message, Search, AI, and account data mapping | Legal Data Source Registry maps 14 source families using `verified`, `partial`, and `unresolved` states. The map is metadata-only and read-only. | Foundation deployed | Review source categories for legal relevance, privilege/sensitivity implications, provider-specific gaps, cross-border issues, and whether additional sources must be inventoried before export work. |
| Least-data disclosure workflow | Draft disclosure metadata and append-only least-data manifest items are supported. Explicit field names are required and broad wildcard fields are rejected. No responsive source data is collected. | Preparation only | Approve minimum-necessary standards, disclosure scope review, permitted field selection, recipient validation, final manifest requirements, and the legal approval sequence before export or disclosure. |
| Emergency request criteria and approval authority | Dedicated emergency-review capability exists. Emergency status is limited to `unreviewed`, `draft`, and `requires_counsel`. `can_approve_emergency` remains disabled. | Draft review only | Establish substantive emergency-disclosure criteria, required evidence, legal threshold, approver qualifications, separation of duties, documentation, expiration/revalidation rules, and any emergency-specific recipient validation. |
| Child-safety and imminent-danger coordination | Internal Legal Operations to Trust & Safety coordination metadata exists. `imminent_danger` coordination additionally requires emergency-review capability. No external reporting or contact exists. | Internal coordination only | Approve child-safety and imminent-danger legal standards, reporting obligations, escalation ownership, NCMEC or other reporting procedures where applicable, law-enforcement/emergency-service contact conditions, preservation requirements, and documentation boundaries. |
| Confidentiality and delayed-notice handling | Dedicated notice/confidentiality draft workflow exists with revision control. No confidentiality-release action exists. | Draft review only | Define when confidentiality restrictions apply, when delayed notice may be required or permitted, review/renewal rules, release criteria, and how conflicting orders or obligations are handled. |
| Member notice where lawful and appropriate | Draft recommendation fields exist. No approved/final/sent state, delivery integration, or member-contact resolution is enabled. | Draft review only | Approve when notice is required, permitted, prohibited, or delayed; timing rules; final approver; templates; delivery method; retry/failure handling; and evidence of delivery. |
| Privilege, reporter, victim, and unrelated-member protections | Dedicated protected-party review statuses and summaries exist and are database-protected. The summaries are not an evidence repository. | Foundation deployed | Approve privilege-screening procedure, reporter/victim protection rules, unrelated-member minimization, escalation to counsel, and how protected information must be excluded or segregated from any future export. |
| Chain of custody, export integrity, and disclosure audit history | Export package, artifact, verification, and custody metadata structures exist. The review workspace is read-only and no export write RPC is enabled. | Foundation deployed | Approve custody requirements, hash/manifest expectations, operator separation, internal/external handoff records, verification requirements, sealing/voiding rules, and acceptable evidence of recipient transfer. |
| Rejection and deficiency process | Deficiency and rejection fields are part of the restricted request-review workflow and protected by `can_review_requests`. | Foundation deployed | Approve substantive deficiency/rejection grounds, required documentation, response templates, cure opportunities, escalation rules, and authority for final rejection. |
| Cross-border and conflicting-law escalation | Cross-border status and conflicting-law summary exist and are review-protected. | Foundation deployed | Define cross-border review triggers, jurisdiction conflicts, data-location considerations, transfer restrictions, escalation to specialist counsel, and circumstances where processing must stop pending review. |
| Retention schedule for requests and disclosures | Legal retention registry exists with unapproved timing values and destructive execution disabled. Active-hold rules are represented without fixed durations. | Methodology only | Approve record-class retention periods, legal/operational basis, preservation overrides, post-release retention, authorization-history retention, disclosure-history retention, and any jurisdiction-specific variations. |
| Aggregate transparency-reporting fields | Internal transparency methodology registry exists. Aggregation execution and publication are disabled, request-specific data is disallowed, and no numeric suppression threshold is approved. | Methodology only | Approve taxonomy, counting methodology, reporting periods, jurisdiction grouping, outcome definitions, suppression/re-identification controls, review process, and public-release approval. |

## Acceptance-criteria readiness

| Acceptance criterion | Readiness assessment | What remains |
| --- | --- | --- |
| Only authorized personnel can accept, preserve, export, and disclose data | Intake, review, preservation, and preparation powers are separated by explicit capabilities. Export and disclosure authority remain disabled. | Counsel-approved export/disclosure operating model plus separately reviewed technical implementation and authorization before `can_export` or `can_disclose` can be enabled. |
| Every disclosure records legal basis, scope, approver, exported fields, recipient, and time | Data structures exist for disclosure metadata, least-data items, integrity metadata, custody history, and timestamps. | Actual export/disclosure execution, final approval workflow, recipient-validation procedure, transfer record, and counsel-approved standards. |
| Preservation does not silently change public content or member access | The preservation system is metadata/control based and does not itself change public content visibility or member access. | Counsel confirmation that the operational procedure accurately reflects intended legal preservation practice. |
| Room deletion, account deletion, and ordinary retention respect active legal holds | Exact legal-hold checks are wired into account deletion and Room permanent-deletion boundaries, including the Room Storage pre-remove guard. Destructive feature flags remain disabled. | No Issue #674 enablement is needed. Future destructive-feature enablement must preserve these hold gates and undergo its own readiness review. |
| Emergency disclosures require documented criteria and approval | Draft emergency-review controls exist, but there is intentionally no approved emergency standard or approval workflow. | Counsel must approve substantive criteria and the approval model before an executable emergency-disclosure phase can be built. |
| Public guidelines contain no fixed response-time or specialized-service promise operations cannot meet | No public law-enforcement or emergency-disclosure guideline has been published through Issue #674. Existing Issue #674 materials remain internal/foundation documents. | Counsel-approved public language, verified operational owners/channels, and final policy publication review. |
| Qualified counsel approves the process and templates | Not yet satisfied. | This is the current gating acceptance criterion. |

## Decisions requested from qualified counsel

Counsel review should produce explicit, versioned decisions for the following topics. This list requests decisions and does not prescribe the legal answer.

### 1. Intake, identity, jurisdiction, and authority

- accepted legal-request channels
- identity and agency/requester verification requirements
- service and receipt handling
- jurisdiction review criteria
- authority sufficiency criteria by request type
- when internal review must stop and be escalated to counsel

### 2. Scope, deficiency, rejection, and minimization

- overbreadth and scope-narrowing rules
- deficiency categories and cure process
- rejection authority and documentation
- minimum-necessary disclosure standard
- unrelated-member minimization
- handling of duplicate, conflicting, superseding, or withdrawn requests

### 3. Preservation

- preservation legal-basis requirements
- standard and exceptional duration rules
- extension/renewal criteria
- release and expiry criteria
- review cadence
- handling of preservation when account/Room deletion or ordinary retention is pending

### 4. Protected parties and sensitive material

- privilege review
- reporter and victim protections
- unrelated-member minimization
- sensitive or high-risk content handling
- whether additional segregation, redaction, or specialist review is required before export

### 5. Cross-border and conflicting law

- cross-border triggers
- conflicting-law escalation
- specialist-counsel requirements
- data-location and transfer considerations
- stop-processing conditions while a conflict is unresolved

### 6. Ordinary disclosure approval

- final disclosure approval criteria
- approver role and separation of duties
- recipient verification
- manifest finalization requirements
- export-generation authorization
- transfer method and custody record
- cancellation/voiding requirements

### 7. Emergency disclosure

- substantive emergency threshold
- required factual documentation
- emergency legal basis
- approver role and independence from preparer/reviewer where required
- revalidation/expiry of emergency determinations
- recipient validation
- after-action review and audit expectations

### 8. Child safety and imminent danger

- internal escalation standard
- mandatory or permitted reporting obligations
- NCMEC or other specialist reporting procedures where applicable
- law-enforcement or emergency-service contact conditions
- preservation requirements
- documentation and minimum-necessary disclosure boundaries
- designated operational owner and backup

### 9. Confidentiality and member notice

- confidentiality restrictions
- delayed-notice legal basis and review
- notice-required/allowed/prohibited criteria
- final notice approver
- timing rules
- templates
- delivery channels and evidence of delivery
- confidentiality-release procedure

### 10. Retention and disposition

- approved retention periods by Legal Operations record class
- preservation overrides
- post-hold retention
- disclosure/export/custody-history retention
- authorization/audit-history retention
- jurisdiction-specific exceptions
- disposition approval and evidence requirements

### 11. Transparency reporting

- counting unit and taxonomy
- reporting periods
- jurisdiction grouping
- outcome definitions
- suppression/re-identification standard
- review/approval procedure
- publication owner
- public methodology language

### 12. Public guidelines

- Law Enforcement Request Guidelines
- Emergency Disclosure Guidelines
- child-safety/imminent-danger references, if any
- contact channels
- disclaimers and scope
- response-time language
- specialized-service language
- preservation language
- notice/confidentiality language
- versioning and publication approval

## Materials for counsel review

Counsel can review the operating design without receiving real member content or a real legal request. Recommended review materials are:

- Issue #674 and its production-verification comments
- the Legal Operations documents under `docs/legal-operations/`
- the relevant Trust & Safety internal drafts referenced by Issue #674
- the Legal Data Map registry and its unresolved/partial source gaps
- the Legal Operations retention registry
- the transparency-reporting methodology registry
- the schema and migration definitions for Legal Requests, holds, disclosures, protected-party review, notice/confidentiality review, emergency review, export-integrity metadata, and internal safety coordination
- the read-only verification scripts used for production readiness

Do not provide counsel with real member messages, attachments, private content, production exports, or actual legal-request documents merely to explain the architecture. If counsel later needs a specific real matter, that should be handled under a separately authorized legal workflow.

## Post-counsel implementation order

Counsel approval should not automatically enable production powers. After counsel decisions are documented, implementation should continue in narrow, separately reviewed phases.

Recommended order:

1. Record counsel-approved standards and templates in versioned internal documentation.
2. Reconcile approved standards against the existing schema and registries without enabling external actions.
3. Implement controlled export generation and package creation behind a default-off `can_export` boundary.
4. Validate export integrity, exact field manifests, hashes, custody metadata, and fail-closed source collection using controlled fictional data only.
5. Implement ordinary disclosure approval separately from export preparation and generation, keeping `can_disclose` default off until production readiness passes.
6. Implement emergency approval as a separate workflow, keeping `can_approve_emergency` default off until substantive criteria and separation-of-duties controls are counsel-approved and production-validated.
7. Implement member-notice delivery only after notice rules, templates, recipient resolution, and delivery evidence are approved.
8. Implement child-safety/imminent-danger external reporting or contact only after counsel-approved criteria, operational owners, channels, and minimum-necessary procedures are in place.
9. Approve retention durations and transparency methodology through separately reviewed changes before enabling disposition execution, aggregation, or publication.
10. Publish public Law Enforcement Request or Emergency Disclosure guidance last, after operational controls, owners, channels, counsel approval, and production verification are complete.

Each future executable phase must preserve least privilege, auditability, revision control where applicable, and fail-closed behavior.

## No-change boundary for this handoff phase

This counsel-handoff phase is documentation only. It must not:

- add or alter a Supabase migration
- add or change a database table, function, trigger, grant, RLS policy, or capability
- enable `can_export`
- enable `can_disclose`
- enable `can_approve_emergency`
- change the controlled Legal Reviewer authorization
- add export generation
- add disclosure execution
- add emergency approval
- add member-notice sending
- add NCMEC, law-enforcement, emergency-service, requester, recipient, or other external contact
- add external transmission
- change account or Room destructive feature flags
- publish a public legal-request or emergency-disclosure guideline

## Issue #674 closure condition

Issue #674 should remain open after this document is merged.

The issue should not be considered complete until qualified counsel has reviewed and approved the applicable process and templates, and any executable downstream phases required by the acceptance criteria have been separately implemented, production-validated, and authorized.
