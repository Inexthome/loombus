# Issue #670 Synthetic Verification and Counsel Handoff

## Status

**Tracks:** Issue #670  
**Status:** Internal synthetic-verification plan and consolidated counsel handoff  
**Public ready:** No  
**Qualified legal review:** Pending  
**Production-data testing authorized by this document:** No

This document completes the remaining internal review package for Issue #670 without using real member reports, real commercial records, real private messages, real legal requests, or real external contacts.

It is intended to let Loombus finish the internal architecture and policy package before sending one consolidated review set to qualified counsel.

## 1. Purpose

The Issue #670 implementation now has four layers:

1. the internal canonical category model (`COM-01` through `COM-15`);
2. the versioned application registry (`commerce_integrity.v1`);
3. the append-only database classification ledger;
4. the administrator-only human review workspace.

The next validation goal is not to prove that Loombus can classify a real member record. It is to prove that the contracts are coherent and fail closed using synthetic/non-production scenarios and static review.

## 2. Prohibited validation shortcuts

Do not:

- create a real classification solely to test the write path;
- use a real member report as a test fixture;
- use a real Marketplace listing, Business, Service, Request, Job, Event, Appointment, Room, Local projection, or private message for convenience testing;
- convert historical free-text reasons through AI, embeddings, fuzzy matching, keywords, or semantic inference;
- mark an allegation as confirmed merely because it resembles a canonical category;
- resolve or dismiss a real report as part of classification testing;
- create a real enforcement decision as part of classification testing;
- send a member notice as part of classification testing;
- create a Trust and Safety case merely to satisfy a test requirement;
- contact law enforcement, regulators, NCMEC, licensing bodies, employers, providers, or another outside party;
- enable Room or private-message classification writes;
- enable direct Local classification writes;
- change an Issue #668 disposition rule or Issue #674 preservation rule simply to simplify testing.

## 3. Static contract verification

The following checks can be completed without creating a classification row.

### Taxonomy completeness

Verify:

- exactly one active `commerce_integrity.v1` taxonomy version exists;
- exactly 15 category IDs exist (`COM-01` through `COM-15`);
- every category has at least one canonical safety reason;
- every category maps to at least one source module;
- primary and secondary module sets do not overlap;
- all module names are from the known source-module registry;
- no bare `S1`, `S2`, `S3`, `S4`, or `S5` severity is accepted;
- policy severity uses `POLICY.S0` through `POLICY.S5` only;
- Trust and Safety triage uses `TS.S1_CRITICAL` through `TS.S4_STANDARD` only.

### Source-mode boundaries

Verify:

- Marketplace: direct/write-enabled;
- Businesses: direct/write-enabled;
- Services: direct/write-enabled;
- Requests: direct/write-enabled;
- Jobs: direct/write-enabled;
- Events: direct/write-enabled;
- Appointments: conditional/write-enabled;
- Rooms: restricted/write-disabled;
- Messages: restricted/write-disabled;
- Local: inherited-only/write-disabled.

Matches and Search remain outside the Issue #670 classification-source registry.

### Database authorization

Verify:

- browser roles have zero direct table privileges for classification history;
- the service role has select but no direct insert/update/delete privilege on classification history;
- the guarded create RPC is service-role only;
- the RPC independently verifies the actor remains an administrator;
- source record and optional report association are verified server-side;
- record/report types are derived from the source module rather than accepted as arbitrary browser input;
- the append-only mutation triggers are present;
- only one current classification head can exist for one source record;
- corrections require an exact current-head supersession;
- no destructive classification RPC exists;
- no external-action classification RPC exists.

### Manual reviewer workspace

Verify:

- signed-out access redirects to login;
- non-admin access is denied;
- only the seven write-enabled modules are selectable;
- Rooms, messages, Local, Matches, and Search do not appear as writable source options;
- only category IDs applicable to the selected module are shown;
- primary safety reasons are limited to the selected category's canonical reason set;
- optional secondary reasons cannot duplicate the primary reason;
- only `proposed` and `confirmed` review states are offered;
- only `POLICY.S0` through `POLICY.S5` can be selected;
- a confirmed `POLICY.S4` or `POLICY.S5` entry requires an existing Trust and Safety case UUID at the database boundary;
- Appointments expose no report UUID because routine Appointment cancellation reasons are not report classifications;
- the reviewer must acknowledge manual review and the non-legal/non-enforcement nature of the classification;
- the workspace cannot invoke existing approve/reject/suspend/remove/cancel/resolve/dismiss actions;
- the workspace cannot send notices or external communications;
- the workspace cannot create an enforcement decision or Trust and Safety case;
- the module-navigation destination is selected only from literal administrator routes and does not reinterpret DOM-derived text as an arbitrary navigation destination.

## 4. Synthetic scenario matrix

These scenarios are conceptual/static or should be run only in an isolated disposable local/test database with fictional UUIDs and fictional records. They are not instructions to create production records.

### Scenario A: New Marketplace weapons classification

**Fictional facts:** A synthetic Marketplace record offers a prohibited weapon transaction.

Expected contract:

- module `marketplace` accepted;
- record type derived as `marketplace_listing`;
- `COM-01` applicable;
- `GOODS.WEAPON_OR_EXPLOSIVE` accepted as a category-compatible reason;
- `proposed` may be created without a policy severity;
- classification does not remove or suspend the source record;
- classification does not resolve a report;
- classification does not contact an outside party.

### Scenario B: Discussion-only weapons context

**Fictional facts:** The underlying content is a policy/history discussion rather than a commercial offer.

Expected policy outcome:

- the commerce transaction boundary should not be applied merely because weapons are discussed;
- reviewer should not classify a non-commercial discussion as a prohibited transaction without facts supporting facilitation/commerce;
- no legal conclusion should be inferred.

### Scenario C: Marketplace report association mismatch

**Fictional facts:** The reviewer supplies a synthetic report UUID belonging to a different fictional listing.

Expected contract:

- create RPC rejects the association;
- no classification row is created;
- no report is changed.

### Scenario D: Parallel-head attempt

**Fictional facts:** A current classification head exists and a reviewer tries to create another row without the exact supersession ID.

Expected contract:

- create RPC fails closed;
- no second head is created;
- existing history is unchanged.

### Scenario E: Stale supersession attempt

**Fictional facts:** Reviewer tries to supersede a historical row that is not the current head.

Expected contract:

- create RPC rejects the stale target;
- no classification row is created.

### Scenario F: Confirmed severe classification without T&S case

**Fictional facts:** Reviewer submits `confirmed` + `POLICY.S4` without a Trust and Safety case.

Expected contract:

- request fails closed;
- no classification is created;
- no Trust and Safety case is auto-created.

### Scenario G: Proposed severe classification

**Fictional facts:** Reviewer records a `proposed` `POLICY.S4` review before a final severe-harm determination.

Expected contract:

- proposal may remain a review record subject to the database contract;
- it does not itself open or escalate a T&S case;
- it does not authorize enforcement or external action.

### Scenario H: Appointment routine cancellation

**Fictional facts:** An Appointment is cancelled for ordinary scheduling reasons.

Expected policy outcome:

- ordinary cancellation reason is not converted into a commerce-integrity classification;
- no source-report UUID is available in the Commerce Integrity Review form;
- a classification is appropriate only if separate reviewed conduct supports a covered category such as `COM-10`, `COM-13`, or `COM-15`.

### Scenario I: Local projection

**Fictional facts:** A Local result is derived from a Marketplace or Business source with an existing classification.

Expected contract:

- Local has no direct classification write path;
- any presentation of classification state must inherit from the underlying source record;
- no duplicate Local classification row is created.

### Scenario J: Private-message evidence

**Fictional facts:** A commerce concern is reported from a private message.

Expected contract:

- Phase D does not permit message classification writes;
- no message body is copied into the commerce classification workspace;
- existing restricted message-evidence authorization remains controlling;
- future enablement requires a separate reviewed phase.

### Scenario K: Duplicate/evasive reposting

**Fictional facts:** A member repeatedly creates materially equivalent commercial records to evade an earlier restriction.

Expected policy mapping:

- `COM-14` may apply after review;
- `INTEGRITY.DUPLICATE_OR_EVASIVE_REPOSTING` is the principal canonical reason where supported;
- legitimate renewal, recurring events, authorized templates, or materially changed records must remain distinguishable from evasion.

### Scenario L: False professional credential

**Fictional facts:** A Service or Business record claims a credential the provider does not hold.

Expected policy mapping:

- `COM-11` is the shared category;
- `SERVICE.FALSE_CREDENTIAL` may be the principal canonical reason;
- the classification record must not be phrased as a criminal or legal finding;
- jurisdiction-specific licensing conclusions remain counsel/professional-review dependent.

### Scenario M: Job money-mule recruiting

**Fictional facts:** A synthetic Job asks applicants to receive funds or reship goods for deceptive purposes.

Expected policy mapping:

- `COM-12` and `JOBS.MONEY_MULE_OR_RESHIPPING` are available;
- `COM-07` may be a secondary commerce concept where the facts also support financial-scheme activity;
- classification does not automatically remove the Job or sanction the account.

### Scenario N: Commercial AI misrepresentation

**Fictional facts:** A provider uses AI-generated work or imagery and falsely represents it as authentic evidence of completed client results.

Expected policy mapping:

- `COM-13` may apply;
- `AI_MEDIA.FALSE_COMMERCIAL_REPRESENTATION` and/or `SERVICE.FALSE_RESULT_OR_PORTFOLIO` may be selected when supported;
- ordinary disclosed AI assistance is not automatically prohibited.

### Scenario O: Sensitive professional intake

**Fictional facts:** A provider requests passwords or authentication secrets during an ordinary Service inquiry.

Expected policy mapping:

- `COM-15` may apply;
- `PRIVACY.AUTHENTICATION_SECRET` or `SERVICE.PRIVACY_OR_INTAKE_ABUSE` may apply;
- the sensitive value itself should not be copied into the classification basis note.

## 5. Policy-draft conversion verification

The following five existing internal drafts are the principal Issue #670 public-policy conversion targets:

- `docs/trust-safety/drafts/09-fraud-spam-and-coordinated-manipulation.md`
- `docs/trust-safety/drafts/10-illegal-and-regulated-goods.md`
- `docs/trust-safety/drafts/18-marketplace-prohibited-items.md`
- `docs/trust-safety/drafts/19-jobs-integrity-standard.md`
- `docs/trust-safety/drafts/20-services-and-professional-claims-standard.md`

For internal completion, each draft should be evaluated against these rules:

- it does not silently redefine a `COM-*` category;
- module-specific rules may be stricter than the baseline;
- discussion/documentary/educational context remains distinct from transactions/facilitation;
- reporter allegation is not equated to confirmed classification;
- classification is not equated to enforcement;
- Loombus policy restriction is not automatically described as a universal legal prohibition;
- licensing/credential/regulated-category statements are flagged for qualified review;
- member notice language uses the narrowest reviewed reason and avoids unsupported legal conclusions;
- appeal evidence and exception handling do not create ad hoc regulated programs;
- duplicate/evasive reposting is covered through `COM-14` / `INTEGRITY.DUPLICATE_OR_EVASIVE_REPOSTING`;
- sensitive-data/intake abuse is covered through `COM-15` where applicable;
- teen/age-restricted commerce remains consistent with the separate protected-commerce controls.

## 6. Consolidated counsel review package

Issue #670 should be sent to qualified counsel as one package rather than as isolated questions.

### Core architecture documents

Include:

1. `issue-670-canonical-commerce-and-professional-integrity-taxonomy.md`
2. `issue-670-readiness-and-counsel-handoff.md`
3. `issue-670-production-report-reason-audit.md`
4. `issue-670-source-schema-api-audit.md`
5. `issue-670-classification-migration-plan.md`
6. `issue-670-classification-ledger-foundation.md`
7. `issue-670-manual-reviewer-workspace.md`
8. `issue-670-required-output-and-policy-conversion-matrix.md`
9. this synthetic-verification and counsel-handoff document

### Public-policy drafts

Include:

- CS-009 Fraud, Spam, and Coordinated Manipulation;
- CS-010 Illegal and Regulated Goods;
- MC-001 Marketplace Prohibited Items;
- JC-001 Jobs Integrity Standard;
- SC-001 Services and Professional Claims Standard.

### Related control packages

Where necessary for context, include the counsel-ready Issue #667 Trust and Safety operations material and Issue #674 Legal Operations/counsel-handoff material, but do not ask counsel to re-review unrelated completed technical implementation unless a legal dependency requires it.

## 7. Counsel decision questions

Qualified counsel should review the following grouped questions.

### A. Commerce and regulated goods

1. Which categories should Loombus prohibit globally as a platform rule regardless of whether some local transactions could be lawful?
2. Which categories require jurisdiction-specific public wording?
3. Which categories, if any, could later support a verified program, and what minimum age/location/licensing/custody controls would be required before launch?
4. Which categories should remain categorically unavailable because Loombus cannot reasonably support the verification or risk model?
5. Are the proposed discussion-versus-transaction boundaries legally and operationally appropriate?

### B. Marketplace

1. Which Marketplace examples should be stated as Loombus policy versus legal prohibition?
2. What public wording is appropriate for weapons, medicines, controlled substances, alcohol, nicotine, cannabis, gambling, wildlife/environmental goods, hazardous materials, medical devices, and other regulated products?
3. What verification/disclaimer language is appropriate for authenticity, ownership, recall status, and product safety?
4. What seller notice and appeal language should be used for category-based removal?

### C. Employment

1. What Jobs language is appropriate for discrimination, protected characteristics, legitimate occupational requirements, compensation disclosures, applicant fees, teen eligibility, recruiting scams, and sensitive-data collection?
2. Which employment statements require state/local variants?
3. What evidence should Loombus reasonably request or accept on appeal without becoming an employer, recruiter, background-check provider, or credential verifier?
4. What public disclaimer language is appropriate for external application destinations?

### D. Services and professional practice

1. What licensing, protected-title, scope-of-practice, credential, insurance, and jurisdiction language is appropriate for professional Services?
2. Which categories should Loombus prohibit until a verified credential program exists?
3. What wording is appropriate for medical, legal, immigration, tax, financial, therapeutic, engineering, contracting, child-care, elder-care, and other regulated services?
4. What claims/disclaimers avoid implying that Loombus universally verifies provider credentials or professional compliance?

### E. Advertising, endorsements, pricing, and AI representations

1. What disclosure standards should apply to endorsements, testimonials, referral compensation, sponsorships, paid promotion, and material business relationships?
2. What public standard should govern deceptive pricing, mandatory fees, compensation claims, guaranteed results, before-and-after representations, and fabricated portfolios?
3. What disclosure or misrepresentation rules should apply when AI-generated or AI-edited content is used commercially?
4. Which of these standards require jurisdiction-specific consumer-protection wording?

### F. Privacy and sensitive intake

1. What categories of personal data should Loombus expressly prohibit providers/employers from requesting through ordinary public or low-assurance intake?
2. What public language is appropriate for government IDs, financial information, medical information, authentication secrets, and other sensitive data?
3. What retention/minimization requirements should apply when such data appears in a report or investigation?

### G. Member notice and appeals

1. Are the proposed notice bases sufficiently specific without creating unsupported legal conclusions?
2. Which categories should permit documentary/contextual exceptions?
3. Which regulated categories must never receive ad hoc reviewer exceptions?
4. What evidence can reasonably be requested on appeal for ownership, authorization, credentials, lawful scope, authenticity, compensation, disclosure, or security authorization?
5. What notice language should be avoided because it could imply criminality, professional misconduct, or illegality without a legal determination?

### H. Geographic and age controls

1. Which categories require geofencing or location-specific availability if Loombus ever enables them?
2. Which categories require age verification beyond ordinary account-age declarations?
3. Which categories should remain unavailable to teen members even if a future verified adult program exists?

## 8. Counsel approval does not auto-enable production behavior

Even after counsel review:

- no restricted Room/message classification should be enabled automatically;
- no new regulated category should become available automatically;
- no automatic enforcement should be created automatically;
- no automatic member notice should be created automatically;
- no external reporting/contact should be created automatically;
- no retention/destruction schedule should change automatically;
- no public policy should publish automatically.

Counsel-approved changes must be incorporated into versioned documents and, where necessary, implemented through separate narrow technical PRs with normal validation.

## 9. Internal readiness conclusion

With the deployed technical phases and the conversion/counsel package, Issue #670 can be treated as **internally complete / counsel-ready** once this documentation phase is merged.

That status means:

- Loombus has a single canonical commerce/professional-integrity vocabulary;
- the database and administrator review workflow use that vocabulary;
- report allegations remain distinct from reviewed findings;
- reviewed findings remain distinct from enforcement;
- notice and appeal bases are documented as proposed internal positions;
- the existing five public-policy drafts have a defined canonical conversion path;
- all remaining substantive legal questions are grouped for consolidated qualified review.

It does **not** mean Issue #670 meets its final acceptance criteria. The issue should remain open until the required qualified legal reviews are completed and the approved public policies are finalized.
