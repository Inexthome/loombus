# Issue #667: Current Readiness and Counsel Handoff

Status: internal operating and counsel-handoff document
Prepared: August 9, 2026
Owner: Internal Trust and Safety Lead
Tracks: Issue #667
Public ready: no
Qualified legal review: pending

## Purpose

This document records the current, evidence-based readiness state for Issue #667 after the Trust and Safety operating package, restricted case system, production verification, Issue #668 retention work, and Issue #674 Legal Operations foundation work.

It supersedes earlier dependency statements in the July 28, 2026 readiness checklist where those statements conflict with the current repository and production record. It does not replace the Trust and Safety Escalation SOP as the operating procedure.

This document does not create a new legal obligation, authorize external reporting, authorize an emergency disclosure, establish a mandatory-reporting threshold, promise continuous monitoring, promise emergency dispatch, or approve public severe-harm policy language.

## Current operating boundary

Loombus currently operates with the following truthful limitations:

- the primary Trust and Safety owner is the Internal Trust and Safety Lead;
- the backup Trust and Safety owner position is vacant;
- after-hours monitoring is not continuously staffed;
- no guaranteed response time is offered;
- Loombus is not an emergency-dispatch service;
- external child-safety reporting standards remain subject to qualified counsel review;
- emergency-disclosure legal standards remain subject to qualified counsel review;
- member-notice and confidentiality legal standards remain subject to qualified counsel review;
- public detailed severe-harm guidance remains unpublished pending final readiness and counsel review.

Public and reusable materials must continue to use role-based naming such as `Loombus Trust and Safety` or `Trust and Safety Lead`, not the individual operator's identity.

## Current intake and routing

The internally approved routing model remains:

| Purpose | Route |
| --- | --- |
| Urgent safety, abuse, threats, account compromise, severe-harm reports | `security@loombus.com` |
| Privacy complaints, access, correction, deletion, data-handling concerns | `privacy@loombus.com` |
| Formal legal requests and law-enforcement correspondence | `legal@loombus.com` |
| Regulatory, policy-compliance, internal-governance matters | `compliance@loombus.com` |
| Routine support and standard S4 moderation questions | `support@loombus.com` |

Controlled public delivery to the primary Trust and Safety mailbox has been verified. That verification establishes basic delivery only. It does not establish continuous staffing, after-hours monitoring, a response-time guarantee, emergency dispatch, or redundant coverage.

## Existing owner-approved operating positions

The following positions were previously approved or confirmed through the Issue #667 operating work and remain the current business and operational position unless later revised.

### Severity and routing

- S1 Critical matters receive priority during staffed operations.
- S2 High matters are prioritized above the routine queue.
- S3 Elevated matters are reviewed through the documented Trust and Safety process.
- S4 Standard matters use ordinary support or moderation handling.
- credible new information can increase severity;
- S1 through S3 require documented Trust and Safety decision authority unless an approved containment control applies;
- Room owners and moderators must escalate severe-harm concerns rather than conduct independent severe-harm investigations.

### Evidence and case handling

- preserve only minimum-necessary platform-native evidence;
- keep allegations, observed facts, unresolved facts, and reviewer inference distinct;
- restrict sensitive evidence to authorized roles;
- log evidence access and handling;
- do not store severe-harm evidence in public GitHub issues, ordinary chat, personal email, or personal devices;
- avoid unnecessary downloading, duplication, replay, or repeated visual exposure;
- use case IDs, platform identifiers, hashes, timestamps, storage references, and audit history where sufficient.

### Confidentiality

- reporter identities are not disclosed to reported members, Room owners, moderators, or unauthorized personnel;
- victim and witness information is shared only on a documented need-to-know basis;
- Loombus may describe confidential handling but does not promise absolute anonymity;
- reported members may receive an enforcement reason without receiving raw reports, protected evidence, or reporter identities;
- notice can be limited or delayed when safety, evidence integrity, retaliation risk, or applicable legal restrictions require review.

### Reviewer wellness

- review only the minimum material necessary to classify and decide a case;
- stop repeated traumatic-content review once sufficient evidence exists;
- suspected child sexual exploitation material is not assigned to Room moderators, volunteers, or untrained personnel;
- a reviewer may pause or defer non-imminent work when illness, fatigue, distress, dizziness, or the environment would impair safe judgment;
- productivity expectations must not encourage unnecessary traumatic-content exposure.

### Public promises

Loombus does not currently promise:

- 24/7 monitoring;
- continuous severe-harm review;
- emergency dispatch;
- guaranteed response times;
- guaranteed outcomes;
- absolute anonymity;
- an unreviewed mandatory external-reporting rule;
- a fixed public retention period unsupported by the approved retention system.

## Technical and operational evidence now complete

### Restricted Trust and Safety case system

PRs #698 through #700 established and production-verified the restricted Trust and Safety case system and subsequent audit/usability fixes.

Verified controls include:

- restricted `trust_safety_cases` records;
- evidence-reference records without a new raw-media evidence repository;
- append-only case-event history;
- role-limited service-side access;
- no ordinary browser-role case-table access;
- no case-table delete privilege for ordinary service operation;
- same-case enforcement for evidence-linked events;
- stable closure metadata;
- case-access auditing with duplicate-view coalescing;
- fictional production case update, evidence-reference, handling-event, closure, reopen, and re-closure workflows;
- Light, Dark, and System workspace usability verification.

### Controlled synthetic severity scenarios

The technical database-control gate for controlled S1 through S4 scenarios is complete.

Verified examples include:

- S1 credible-threat lifecycle;
- S2 child-safety lifecycle, 8/8 PASS;
- S3 harassment lifecycle, 8/8 PASS;
- S4 account-security lifecycle, 8/8 PASS;
- closure normalization and stable closure timestamps;
- cross-case evidence isolation and no unintended evidence attachment.

These fictional tests do not establish legal reporting thresholds or authorize any real external report.

### Public intake delivery

A controlled, non-harmful external message to the primary Trust and Safety intake was successfully delivered to the monitored inbox.

Still not established by that test:

- continuous staffing;
- after-hours monitoring;
- mailbox administrator hardening;
- backup coverage;
- guaranteed response time.

## Dependency update

### Issue #668

Issue #668 retention and disposition work is complete and merged/deployed. It is no longer an open implementation dependency for Issue #667.

Trust and Safety must still follow the canonical retention/disposition controls and any later counsel-approved exceptions. Completion of #668 does not create a new public fixed-retention promise by itself.

### Issue #674

Issue #674 has completed its internal technical foundation, Counsel Handoff & Readiness Matrix, and owner-position package through PR #867.

For Issue #667, this means the prior missing Legal Operations architecture is no longer an internal design blocker. However, qualified counsel approval remains pending for the legal standards that govern child-safety external reporting, emergency disclosure, preservation, confidentiality, notice, and lawful disclosure.

The following Issue #674 powers remain disabled and must not be inferred from this handoff:

- `can_export`;
- `can_disclose`;
- `can_approve_emergency`;
- external reporting;
- external contact;
- external transmission;
- member-notice sending;
- `ACCOUNT_DELETION_DESTRUCTIVE_HANDLERS_ENABLED`;
- `ROOM_PERMANENT_DELETION_ENABLED`.

## Remaining internally actionable work

The remaining work that can be prepared internally without inventing a legal standard is limited to operational readiness and training evidence.

### Backup owner

Current status: not satisfied.

A future backup Trust and Safety owner must be:

1. formally appointed;
2. granted only the least-privilege mailbox and restricted case-workspace access required for the role;
3. trained on S1-S4 severity, confidentiality, evidence handling, escalation routing, and reviewer-wellness controls;
4. tested through a fictional controlled workflow;
5. recorded as operational only after the controlled verification passes.

No person should be named or granted access merely to satisfy the issue checkbox.

### Mailbox administrative controls

Current status: public delivery verified, administrative hardening not fully evidenced in Issue #667.

Before final operational sign-off, the responsible administrator should verify and internally record, where applicable:

- authorized mailbox members;
- multifactor-authentication posture for accounts with mailbox access;
- forwarding rules;
- recovery paths;
- retention/archive behavior;
- access revocation procedure;
- misrouted-report transfer behavior;
- primary-owner unavailability procedure.

No credentials, recovery codes, or private mailbox configuration secrets belong in GitHub.

### Support and Room-moderation training

Current status: training standard prepared separately; human completion evidence still required.

Training must establish that support personnel and Room moderators can:

- distinguish routine matters from severe-harm escalation;
- route S1-S3 matters to Loombus Trust and Safety;
- avoid amateur investigation;
- avoid unnecessary evidence copying;
- protect reporter and victim information;
- route formal legal correspondence to Legal Operations;
- avoid promises of continuous monitoring, emergency dispatch, response time, anonymity, or guaranteed outcome.

### Specialist coverage

Current status: routing channels are defined, but qualified specialist availability must not be assumed.

Before final operational sign-off, Loombus should record the actual available legal, privacy, security, and executive escalation coverage. A mailbox address or routing label is not evidence that a qualified specialist is continuously available.

## Counsel decisions requested

Qualified counsel should review the following Issue #667 areas together with the Issue #674 owner-position package and relevant Trust and Safety drafts.

### 1. Child safety and sexual exploitation

Counsel should define or approve:

- when Loombus has a mandatory external-reporting obligation;
- when external reporting is permitted but not mandatory;
- applicable NCMEC or other specialist reporting procedures;
- preservation requirements;
- minimum-necessary information boundaries;
- handling of reporter, victim, guardian, and unrelated-member information;
- member-notice or confidentiality restrictions;
- jurisdiction-specific exceptions.

### 2. Credible threats and imminent danger

Counsel should define or approve:

- the legal boundary between internal safety containment and external disclosure;
- emergency-disclosure criteria;
- when law-enforcement or emergency-service contact is permitted or required;
- minimum-necessary disclosure;
- preservation and documentation requirements;
- confidentiality and member-notice treatment.

### 3. Non-consensual intimate imagery and sextortion

Counsel should define or approve:

- identity and representative-authorization requirements where needed;
- treatment involving adults versus minors;
- preservation boundaries;
- victim-safety notice treatment;
- law-enforcement or external-reporting conditions;
- applicable jurisdictional differences.

### 4. Stalking, doxxing, trafficking, and dangerous organizations

Counsel should define or approve:

- escalation and external-reporting conditions;
- protected victim/reporter information handling;
- designation and dangerous-organization terminology;
- trafficking and material-support language;
- preservation and disclosure boundaries;
- cross-border issues where applicable.

### 5. Self-harm and crisis-related language

Counsel and any appropriate qualified specialist should review:

- public crisis-resource wording;
- regional presentation and limitations;
- non-clinical disclaimers;
- emergency escalation boundaries;
- privacy and teen/minor considerations;
- when external disclosure is legally permitted.

### 6. Confidentiality, notice, and evidence handling

Counsel should review:

- reporter, victim, and witness confidentiality language;
- when notice can be delayed, limited, prohibited, or required;
- evidence-preservation interactions with Legal Operations holds;
- privilege and protected-party escalation;
- retention and disposition exceptions;
- final public wording about confidentiality and safety review.

### 7. Public severe-harm guidance

Counsel should review the final public-facing package only after the operational facts are frozen for publication.

Public guidance must not claim capabilities Loombus does not operate, including continuous staffing, guaranteed response time, emergency dispatch, automatic external reporting, or automatic emergency disclosure.

## Materials for consolidated counsel review

Counsel can review Issue #667 without receiving a real severe-harm case or real member content.

Recommended materials:

- this current readiness and counsel-handoff document;
- `docs/trust-safety/operations/trust-safety-escalation-sop.md`;
- `docs/trust-safety/operations/trust-safety-case-record-template.md`;
- `docs/trust-safety/operations/trust-safety-readiness-and-legal-review-checklist.md` as the historical baseline checklist;
- the related Trust and Safety public-policy drafts;
- Issue #667 production-verification comments;
- Issue #668 retention/disposition documentation;
- `docs/legal-operations/issue-674-counsel-handoff-readiness-matrix.md`;
- `docs/legal-operations/issue-674-owner-position-for-counsel-review.md`;
- the restricted case-system schema and verification scripts if counsel needs to understand the control architecture.

Do not send real child-safety material, intimate imagery, private messages, actual member evidence, real legal requests, actual exports, credentials, or unrelated production data merely to explain the architecture.

## Counsel review record

Complete only after qualified counsel actually performs the review.

```text
Issue: #667
Document/version reviewed:
Related #674 owner-position version reviewed:
Reviewer qualification or organization:
Review date:

Outcome:
[ ] Approved as proposed
[ ] Approved with required changes
[ ] Not approved
[ ] Requires follow-up information

Areas approved:

Required changes:

Jurisdictions or limitations:

Required templates or procedures:

Next review date, if any:

Internal approval evidence location:
```

Owner approval, repository merge, or completion of fictional tests must not be recorded as qualified-counsel approval.

## Final Issue #667 completion boundary

Issue #667 should remain open until the applicable acceptance criteria are supported by evidence.

At the current stage, the remaining gates are:

1. a real qualified backup Trust and Safety owner is appointed, least-privilege access is granted, training is completed, and a fictional workflow verification passes;
2. mailbox administrative controls and primary-owner-unavailability procedures are internally verified;
3. support and Room-moderation escalation training is completed by the actual operators who need it;
4. qualified specialist coverage is truthfully recorded where the SOP depends on legal, privacy, or security escalation;
5. qualified counsel completes the required legal review;
6. required counsel changes are incorporated;
7. final operational sign-off confirms the production facts that public policies will describe;
8. public severe-harm guidance is separately reviewed before publication.

No executable external-reporting or emergency-disclosure power should be added merely to make Issue #667 appear complete.