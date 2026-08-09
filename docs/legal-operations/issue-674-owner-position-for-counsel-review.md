# Issue #674: Owner Position for Counsel Review

## Status

**Owner approved for counsel review:** August 9, 2026  
**Qualified counsel review:** Pending  
**Final legal standard:** Not approved  
**Production authority granted by this document:** None

This document records the Loombus platform owner's operational position for the remaining counsel-gated portions of Issue #674. It is an internal business and operating position prepared for qualified counsel review. It is not legal advice, does not establish a final legal standard, and does not authorize any export, disclosure, emergency approval, member-notice sending, external report, external contact, external transmission, or destructive deletion capability.

The corresponding technical readiness baseline is documented in `docs/legal-operations/issue-674-counsel-handoff-readiness-matrix.md`.

## Production boundary that remains in force

The following authorities and actions remain disabled unless and until qualified counsel decisions are recorded and a later narrow implementation phase separately enables and validates them:

- `can_export = false`
- `can_disclose = false`
- `can_approve_emergency = false`
- external reporting = disabled
- external contact = disabled
- external transmission = disabled
- member-notice sending = disabled
- `ACCOUNT_DELETION_DESTRUCTIVE_HANDLERS_ENABLED = disabled`
- `ROOM_PERMANENT_DELETION_ENABLED = disabled`

Nothing in this owner-position document overrides those controls.

## Review model

For each section below:

- **Owner position** records the operating position approved by the platform owner.
- **Counsel decisions still required** identifies the legal standards, conditions, or templates that qualified counsel must review or define before downstream implementation.
- **Implementation state** confirms whether the position changes production behavior now.

All sections are approved by the owner only for presentation to qualified counsel. They are not final legal determinations.

---

## 1. Intake, identity, jurisdiction, and authority

### Owner position

- `legal@loombus.com` is the official electronic legal-request intake channel.
- Legal requests received through Support, Trust & Safety, employees, or other Loombus channels should be routed internally to Legal Operations and not substantively processed by those teams.
- For now, Loombus will use electronic legal-request intake only. Physical-mail or service procedures are deferred until separately established.
- Questionable, unusual, ambiguous, conflicting, or jurisdictionally uncertain requests should default to `requires_counsel`.
- Only specifically authorized Legal Operations personnel may review requester identity and asserted legal authority.
- AI or automated systems may assist with administrative organization or summarization, but must not independently validate legal authority, determine legal sufficiency, or authorize disclosure.

### Counsel decisions still required

- accepted legal-request channels and service/receipt rules
- identity and agency/requester verification evidence
- legal sufficiency standards by request type
- jurisdiction review standards
- when electronic service is sufficient or insufficient
- escalation conditions requiring counsel review

### Implementation state

No new authority is enabled by this position.

---

## 2. Scope, deficiency, rejection, and minimization

### Owner position

- Loombus should disclose only data specifically within the valid scope of a request.
- Ambiguous, vague, or overly broad requests should be narrowed or clarified before disclosure.
- Correctable defects should ordinarily be treated as deficient before rejection.
- Clearly invalid or uncured requests may be rejected, subject to counsel-approved standards.
- Unrelated-member information should be minimized or excluded wherever reasonably possible.
- Loombus should not broaden a request based on assumptions about what the requester probably intended.
- AI may assist with organizing proposed scope, but cannot make the final legal responsiveness, minimization, deficiency, or rejection decision.

### Counsel decisions still required

- overbreadth and narrowing standards
- deficiency categories and cure process
- rejection grounds and final rejection authority
- minimum-necessary disclosure standard
- unrelated-member minimization rules
- treatment of duplicate, superseding, conflicting, or withdrawn requests

### Implementation state

No disclosure or rejection authority is changed by this position.

---

## 3. Preservation

### Owner position

- A hold requires a documented basis, defined scope, and identified target or targets before activation.
- Preservation should be as narrow as reasonably appropriate.
- Active holds override ordinary deletion or retention only within their exact scope.
- Preservation alone should not hide content, suspend accounts, restrict members, or alter public visibility.
- Every active hold should have a scheduled review point.
- Extensions require affirmative, documented review.
- Releasing a hold resumes the applicable ordinary retention or deletion process and does not itself cause immediate deletion.
- When release is uncertain, preservation continues and the matter is escalated to counsel.
- AI cannot independently activate, extend, release, or expire a legal hold.

### Counsel decisions still required

- legal basis requirements for preservation
- applicable duration and renewal rules
- review cadence
- extension criteria
- release and expiry criteria
- treatment of conflicting preservation obligations
- any jurisdiction-specific preservation requirements

### Implementation state

Existing preservation controls remain in place. No destructive feature is enabled.

---

## 4. Protected parties and sensitive material

### Owner position

- Protected-party review should occur before any future export or disclosure.
- Potentially privileged material should stop and escalate to qualified counsel before disclosure.
- Reporter and victim identifying information should be minimized when it is not necessary to the valid scope.
- Unrelated-member information should be excluded unless specifically within valid legal scope.
- Loombus should prefer segregation or redaction over unnecessarily broad disclosure.
- Sensitive source material should not be copied into Legal Operations notes or audit logs unless genuinely necessary.
- Protected-party review should remain restricted to specifically authorized personnel.
- Uncertainty defaults to `requires_counsel`.
- AI may assist administratively but cannot make final privilege or protected-party determinations or authorize disclosure of protected information.

### Counsel decisions still required

- privilege-screening procedure
- reporter and victim protection rules
- unrelated-member minimization rules
- segregation and redaction requirements
- specialist-review requirements
- escalation and final determination authority

### Implementation state

Existing protected-party review controls remain internal-only.

---

## 5. Cross-border and conflicting law

### Owner position

- Foreign or conflicting-jurisdiction requests require dedicated cross-border review before disclosure.
- A foreign request is not treated as enforceable merely because it appears official.
- U.S. legal process is not assumed to automatically override foreign privacy, localization, secrecy, or transfer restrictions.
- Uncertain or conflicting law becomes `requires_counsel`, and disclosure pauses.
- Legal Operations may identify relevant provider or data locations, but counsel determines their legal significance.
- When feasible, the disputed portion should be segregated rather than unnecessarily disclosing or stopping the entire request.
- Relevant information should be preserved where appropriate while jurisdictional questions are resolved.
- Recipient authority and transfer legality must be separately validated before any international transmission.
- AI cannot resolve conflicts of law or authorize an international disclosure.
- Loombus makes no fixed international response-time commitment.

### Counsel decisions still required

- cross-border review triggers
- conflicting-law standards
- specialist-counsel requirements
- data-location and transfer considerations
- enforceability standards
- stop-processing conditions
- jurisdiction-specific transfer restrictions

### Implementation state

No international disclosure or transfer capability is enabled.

---

## 6. Ordinary disclosure approval

### Owner position

- Passing intake or request review does not itself authorize disclosure.
- Disclosure requires a separate final authorization step.
- Separation between preparer and final approver should be used where reasonably possible.
- Identity, authority, scope, protected-party and minimization review, and required counsel escalation must be complete before approval.
- Export generation should occur only after appropriate export-stage authorization.
- Only specifically approved fields and objects may be exported.
- Recipient identity and destination must be independently verified before transmission.
- The disclosure record should identify preparation, review, approval, export, transmission, and timestamps.
- Integrity verification should occur before transmission where applicable.
- Material changes to an approved package require re-review.
- A package may be cancelled or voided before transmission when an error, scope problem, legal issue, or authorization problem is identified.
- `can_export` and `can_disclose` remain separate capabilities.
- AI cannot approve disclosure, choose the final responsive dataset, validate the final recipient, or initiate external transmission.
- External transmission requires explicit authorized human action.

### Counsel decisions still required

- final disclosure approval criteria
- approver role and separation-of-duties requirements
- recipient-verification procedure
- final manifest requirements
- export-generation authorization rules
- transfer method and custody requirements
- cancellation and voiding standards

### Implementation state

`can_export` and `can_disclose` remain disabled.

---

## 7. Emergency disclosure

### Owner position

- Emergency disclosure is an exceptional workflow and not a shortcut around ordinary legal process.
- A requester labeling a matter an emergency is not sufficient by itself.
- Loombus should require concrete facts describing the claimed danger and why disclosure is needed without ordinary process.
- An authorized reviewer should independently assess the request.
- Final emergency approval should require a separately authorized approver.
- `can_review_emergency` and `can_approve_emergency` remain separate capabilities.
- The decision record should document factual basis, legal basis, requested data, approved data, recipient, reviewer, approver, and timestamps.
- Minimum-necessary principles continue to apply during emergencies.
- Recipient or governmental identity should be independently verified before transmission whenever feasible.
- If the facts do not clearly satisfy the counsel-approved emergency standard, the matter should move to `requires_counsel` or ordinary legal process.
- Emergency approval should expire or require revalidation rather than remain indefinitely reusable.
- Each emergency disclosure should receive an after-action review.
- AI may summarize facts or flag missing information, but cannot determine that the legal emergency threshold is satisfied, approve an emergency disclosure, select final data, or transmit it.
- No Trust & Safety severity label, threat classifier, member report, or AI safety signal can automatically trigger external disclosure.
- Loombus should make no guaranteed emergency response-time promise unless the operational capability is actually established and approved.

### Counsel decisions still required

- substantive emergency-disclosure threshold
- required factual documentation
- legal basis
- approver qualifications and independence
- expiration and revalidation rules
- recipient validation
- after-action requirements
- any public emergency-request language

### Implementation state

`can_approve_emergency` remains disabled. No emergency disclosure or transmission capability is enabled.

---

## 8. Child safety and imminent danger

### Owner position

- Child-safety and imminent-danger matters receive priority internal escalation, but severity alone does not authorize an external report or disclosure.
- Internal Trust & Safety action, mandatory reporting, permitted discretionary reporting, and emergency disclosure remain distinct workflows.
- Where applicable law creates a mandatory reporting obligation, Loombus should comply through the legally appropriate channel after the applicable threshold is established.
- NCMEC or CyberTipline procedures should be implemented only under a counsel-approved procedure defining when reporting applies.
- Reports should contain only information appropriate and legally permitted for the applicable reporting purpose.
- Child-safety evidence and sensitive material should receive restricted handling and should not be unnecessarily copied into ordinary Legal Operations notes or general audit logs.
- Potentially reportable material should be preserved according to applicable requirements and the approved preservation procedure.
- Ambiguous legal-reporting questions should escalate rather than be left to ordinary Trust & Safety staff.
- Imminent danger should receive accelerated internal review without bypassing the required legal or emergency approval.
- Loombus should designate a primary operational owner and backup before activating external child-safety or emergency reporting workflows.
- Ordinary moderator, Room owner, administrator, or community-management privileges do not confer external-reporting authority.
- AI classifiers may flag material for urgent human review but cannot independently make an external report, contact law enforcement or emergency services, determine that a reporting threshold is satisfied, or disclose member data.
- Automated detection must not silently broaden the scope of data disclosed.
- Every external child-safety or imminent-danger action should have an auditable internal record showing basis, human decision-makers, destination, scope, and time.
- Loombus should make no 24/7 or guaranteed-response promise unless that capability is actually established and staffed.

### Counsel decisions still required

- mandatory and permitted reporting thresholds
- NCMEC or other specialist reporting procedures where applicable
- law-enforcement or emergency-service contact conditions
- preservation requirements
- minimum-necessary disclosure boundaries
- designated operational owners and backup responsibilities
- documentation and audit requirements

### Implementation state

External reporting, external contact, and external transmission remain disabled.

---

## 9. Confidentiality and member notice

### Owner position

- Loombus should favor member notice when legally permitted and operationally appropriate, but notice is never automatic.
- Applicable nondisclosure, delayed-notice, or confidentiality restrictions must be honored.
- The reason for withholding or delaying notice and the applicable review point should be documented.
- Restrictions should be affirmatively reassessed when they expire or reach a review point.
- Expiration of a restriction does not automatically send notice; human authorization is still required.
- When no prohibition remains and approved criteria are satisfied, Loombus should generally favor transparency to the affected member.
- Member notice should follow minimum-necessary and protected-party principles.
- Notice templates should be counsel-approved and version controlled.
- Separation between notice drafter and final approver should be used where reasonably possible.
- The notice decision, basis, and decision-maker should be recorded.
- If notice is sent, Loombus should audit the approved template or version, delivery method, destination, time, and delivery result where available.
- Failed delivery should be tracked separately and not silently treated as successful notice.
- Notice should never be sent automatically merely because confidentiality expires.
- AI may assist with drafting or organizing a proposed notice, but cannot determine whether notice is legally permitted, release confidentiality, approve the final notice, independently choose the recipient, or send it.
- Uncertainty becomes `requires_counsel`, and no notice is sent until resolved.

### Counsel decisions still required

- confidentiality restrictions and release rules
- delayed-notice standards and review cadence
- notice-required, permitted, prohibited, and delayed criteria
- final notice approver
- timing rules
- approved templates
- delivery methods and evidence of delivery
- failed-delivery treatment

### Implementation state

Member-notice sending remains disabled.

---

## 10. Retention and disposition

### Owner position

- Retention should be defined by record class rather than one universal period.
- Legal requests, holds, disclosures, export and custody records, authorization records, and audit history may each have different schedules.
- Active legal holds override ordinary disposition within their exact scope.
- Hold release resumes ordinary retention rather than causing immediate deletion.
- Loombus should avoid indefinite retention merely because information might someday be useful.
- Legal Operations records themselves should follow data-minimization principles.
- Loombus should preserve enough disclosure and custody evidence to establish what was authorized and what occurred, without unnecessarily retaining duplicate sensitive exports forever.
- Authorization and audit history should follow their own approved schedules.
- Counsel-approved jurisdiction-specific exceptions may override default schedules.
- Every destructive disposition should require authorization and an auditable record.
- Destructive disposition must fail closed when an active hold, unresolved restriction, missing authorization, or uncertain retention requirement exists.
- Failed or partial disposition should be recorded as a failure rather than treated as successful deletion.
- Provider, backup, and storage dependencies should be accounted for before Loombus claims complete disposition.
- AI may assist with identifying records that appear eligible under an approved schedule, but cannot establish retention periods, override a hold, authorize destruction, or certify legal completion.
- Automated destructive disposition remains disabled until counsel approves schedules and a separately controlled implementation is built and tested.
- Account and Room destructive feature flags remain separately controlled and are not activated merely because Legal Operations retention rules are approved.

### Counsel decisions still required

- approved retention periods by record class
- preservation overrides
- post-hold retention
- disclosure, export, and custody-history retention
- authorization and audit-history retention
- jurisdiction-specific exceptions
- disposition approval and evidence requirements

### Implementation state

Automated Legal Operations disposition remains disabled. Account and Room destructive feature flags remain disabled.

---

## 11. Transparency reporting

### Owner position

- Transparency reporting should use aggregate statistics only and should not publish identifiable legal-request records or member information.
- Loombus should publish only metrics with a clearly defined counting methodology.
- The methodology should be documented for consistency across reporting periods.
- Materially different legal-request categories should be distinguished.
- Emergency disclosures should be tracked separately where counsel approves that distinction.
- Preservation requests should be distinguishable from actual disclosures.
- Requests received should be distinguishable from requests where information was actually produced.
- Outcomes should support meaningful categories such as complied with, partially complied with, rejected, deficient, withdrawn, or no data found, subject to counsel-approved definitions.
- Jurisdiction information should be aggregated sufficiently to protect confidentiality and reduce re-identification risk.
- Small or sensitive counts should use a counsel-approved suppression rule.
- Loombus should not manipulate categories or reporting periods to make the company appear to receive fewer requests or disclose less information than it actually does.
- Material reporting errors should be correctable through documented corrections rather than silent historical rewriting.
- Internal source Legal Operations data used for transparency reporting should remain access-controlled.
- A defined review and approval process should exist before publication.
- Public methodology should explain meaningful limitations, exclusions, and changes.
- Confidential individual-case, protected-party, or member information must not be exposed through transparency reporting.
- AI may assist with aggregation, consistency checking, or drafting explanations, but cannot decide what confidential information may be published or approve the final report.
- No public transparency report or dashboard should launch until counsel approves the taxonomy, suppression rules, methodology, and publication procedure.

### Counsel decisions still required

- counting unit and taxonomy
- reporting periods
- jurisdiction grouping
- outcome definitions
- suppression and re-identification standard
- correction methodology
- review and approval procedure
- publication owner
- public methodology language

### Implementation state

Transparency aggregation execution and publication remain disabled.

---

## 12. Public legal-request guidelines

### Owner position

- Loombus should eventually publish counsel-approved Law Enforcement Request Guidelines.
- Loombus should eventually publish separate counsel-approved Emergency Disclosure Guidelines rather than mixing emergency requests into ordinary legal-process instructions.
- `legal@loombus.com` should remain the ordinary public electronic legal-request channel, subject to counsel review.
- Public guidelines should explain the information a requester should provide so Loombus can identify, authenticate, and evaluate the request.
- Submission of a request must not be presented as guaranteeing disclosure.
- Public guidelines should explain that Loombus evaluates validity, authority, scope, and applicable legal requirements before disclosure.
- Loombus should reserve the ability to seek clarification, narrow an overbroad request, identify deficiencies, or reject legally insufficient requests.
- Preservation instructions should remain distinct from disclosure authorization.
- Emergency submission requirements may explain what information is needed for review, but must not expose internal approval thresholds, reviewer identities, security mechanisms, or anti-abuse controls.
- Loombus should make no guaranteed response-time commitment unless it later establishes and reliably operates that service level.
- Loombus should make no 24/7 specialized law-enforcement or emergency-response claim unless that capability is actually established and staffed.
- Public guidelines should not promise automatic member notification and should use counsel-approved language regarding notice and confidentiality.
- Sensitive internal Legal Operations procedures, retention details, security architecture, export mechanisms, employee identities, privileged procedures, and abuse-sensitive information should remain nonpublic.
- Loombus should not ask requesters to send unnecessary passwords, authentication credentials, or unrelated sensitive information merely to submit legal process.
- Legal-request channels should remain distinct from ordinary Support and Trust & Safety channels.
- Public guidelines should contain a version and effective date, with change history maintained internally.
- Material guideline changes require Legal Operations review and qualified-counsel approval before publication.
- AI may assist with drafting or formatting public guidance, but cannot independently change Loombus legal standards, publish new legal-request requirements, make response promises, or approve a new policy version.
- Publication of guidelines must not automatically enable `can_export`, `can_disclose`, `can_approve_emergency`, external reporting, member-notice sending, or external transmission.
- The first public version should not be published until qualified counsel has reviewed the full Issue #674 operating model and relevant templates rather than approving public wording in isolation.

### Counsel decisions still required

- final Law Enforcement Request Guidelines
- final Emergency Disclosure Guidelines
- child-safety or imminent-danger public references, if any
- approved public contact channels
- disclaimers and scope
- response-time language
- specialized-service language
- preservation language
- notice and confidentiality language
- versioning and publication approval process

### Implementation state

No public legal-request or emergency-disclosure guideline is approved or published by this document.

---

## Consolidated counsel review request

Qualified counsel is asked to review the 12 owner positions above and, for each section, record one of the following outcomes:

- **Approved as proposed**
- **Approved with required changes**
- **Not approved**
- **Requires follow-up information**

Counsel should provide the specific legal standard, condition, template requirement, exception, or implementation constraint needed for any item that is not approved as proposed.

## Counsel review record

| Field | Value |
| --- | --- |
| Document | `issue-674-owner-position-for-counsel-review.md` |
| Owner approval date | 2026-08-09 |
| Owner decision status | Approved for qualified counsel review |
| Counsel reviewer | Pending |
| Counsel organization | Pending |
| Counsel review date | Pending |
| Counsel outcome | Pending |
| Counsel-approved version/commit | Pending |
| Exceptions or required changes | Pending |
| Follow-up required | Pending |

This table is a recordkeeping placeholder only. It must not be completed with an approval outcome unless qualified counsel actually performs the review.

## Post-counsel boundary

Qualified counsel approval of this document will not automatically enable any production capability. After counsel decisions are recorded, downstream implementation must continue through narrow, separately reviewed phases with controlled fictional testing and production-readiness verification before any new authority is enabled.

Until those phases are complete, the production boundary at the top of this document remains controlling.
