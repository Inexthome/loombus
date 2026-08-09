# Issue #670: Commerce Integrity Readiness and Counsel Handoff

## Status

**Status:** Internal readiness and counsel-handoff record  
**Tracks:** Issue #670  
**Public publication:** Not authorized  
**Qualified counsel review:** Pending  
**Production taxonomy wiring:** Pending separate technical phase

This document records the current state of Loombus commerce and professional-integrity policy work after the initial Issue #670 audit. It separates what already exists from what still requires implementation, owner review, specialist review, or qualified legal review.

## 1. Existing foundations already present

### Canonical platform safety taxonomy

The merged `Loombus Canonical Safety Taxonomy and Decision Model` already defines the principal reason families needed for commerce enforcement:

- `GOODS.*`
- `SERVICE.*`
- `JOBS.*`
- `FRAUD.*`
- `INTEGRITY.*`
- `SECURITY.*`
- `IP.*`
- `PRIVACY.*`
- severe-harm families including `VIOLENCE.*`, `CHILD.*`, and `INTIMATE.*`

Issue #670 should extend and operationalize that vocabulary rather than invent an independent second moderation taxonomy.

### Existing commerce policy drafts

The following internal drafts already contain substantial module-specific policy language and should not be restarted:

- `docs/trust-safety/drafts/09-fraud-spam-and-coordinated-manipulation.md`
- `docs/trust-safety/drafts/10-illegal-and-regulated-goods.md`
- `docs/trust-safety/drafts/18-marketplace-prohibited-items.md`
- `docs/trust-safety/drafts/19-jobs-integrity-standard.md`
- `docs/trust-safety/drafts/20-services-and-professional-claims-standard.md`

They already cover prohibited goods, fraud, employment integrity, professional claims, pricing, credentials, privacy, appeals, and publication blockers. They remain internal and `public_ready: false`.

### Platform Operations coverage

The existing Platform Operations Center already provides administrator surfaces for:

- Marketplace
- Business Directory
- Jobs
- Events
- Requests
- Services
- Rooms
- Appointments

Those surfaces reuse existing module moderation/report contracts. Issue #670 does not need to invent a new admin center. The required work is to map the existing module-specific reason and action contracts to one canonical taxonomy.

### Teen-safety dependency

The deployed teen-safety system already blocks protected commercial mutations for teen, underage, unknown-age, or otherwise unresolved protected states across the named commerce modules. Issue #670 must not weaken those controls.

### Enforcement and appeals dependency

The canonical enforcement history and appeals system already represents Marketplace, Business, Service, Request, Job, Event, and Appointment target types even where restoration remains manual. Issue #670 should reuse that ledger rather than create a commerce-specific appeal system.

### Retention dependency

Issue #668 established the canonical account-deletion resource/disposition framework used by commerce and local data. Issue #670 should reference those retention and preservation controls rather than inventing fixed commerce retention periods.

### Severe-harm and legal dependencies

Issue #667 now has a counsel-ready Trust and Safety operations package. Issue #674 now has a counsel-ready Legal Operations owner-position package. Commerce escalation can therefore route severe-harm and legally sensitive matters into those existing internal frameworks while their counsel-gated external powers remain disabled.

## 2. New canonical commerce taxonomy

The companion document:

`docs/trust-safety/commerce/issue-670-canonical-commerce-and-professional-integrity-taxonomy.md`

proposes fifteen stable commerce categories:

1. `COM-01` Weapons, ammunition, explosives, and dangerous items
2. `COM-02` Drugs, medicines, intoxicants, and age-restricted products
3. `COM-03` Stolen, counterfeit, forged, recalled, unsafe, and infringing goods
4. `COM-04` Hazardous, environmental, wildlife, and biological materials
5. `COM-05` Sexual exploitation, sexual services, trafficking, and coercive labor
6. `COM-06` Security, account access, personal data, malware, hacking, and surveillance abuse
7. `COM-07` Gambling, financial schemes, investment promotions, and money-mule activity
8. `COM-08` Government documents, public benefits, permits, licenses, and credentials
9. `COM-09` Live animals, food, cosmetics, medical devices, and other conditionally allowed categories
10. `COM-10` Illegal, dangerous, or unsafe services
11. `COM-11` Professional credentials, licensing, and scope-of-practice integrity
12. `COM-12` Employment integrity, discrimination, recruitment scams, and unsafe opportunities
13. `COM-13` Commercial claims, pricing, fees, endorsements, testimonials, and AI representations
14. `COM-14` Duplicate, evasive, manipulative, and off-platform transaction abuse
15. `COM-15` Sensitive-data, inquiry, appointment, and professional-intake abuse

The commerce category is an organizing layer. Existing canonical safety reason codes remain the actual policy reason vocabulary for enforcement decisions.

## 3. Required Issue #670 output mapping

### Canonical category ID and definition

Status: **Prepared for owner review.**

Each proposed category has a stable `COM-##` identifier and a plain-language definition.

### Allowed discussion versus prohibited transaction boundary

Status: **Prepared for owner review.**

The canonical rule distinguishes discussion, education, research, journalism, history, prevention, legal context, and other legitimate non-transactional uses from offering, requesting, arranging, recruiting for, financing, delivering, or facilitating a prohibited transaction.

### Module applicability

Status: **Prepared for owner review.**

A full matrix maps the fifteen categories to Marketplace, Businesses, Services, Requests, Jobs, Events, Appointments, Rooms, Local, and messages.

### Report reason

Status: **Mapped at policy level; technical mapping pending.**

The proposed commerce categories reuse the existing member-facing reasons, especially:

- `R08 Scam, fraud, or impersonation`
- `R10 Illegal or dangerous goods or services`
- `R12 Intellectual property`
- `R14 Job, Service, Business, or professional claim`
- `R15 Account or security concern`

Severe-harm reasons supersede generic commerce reasons when the primary concern is child safety, sexual exploitation, violence, or privacy abuse.

### Enforcement reason

Status: **Mapped at policy level; production reason-field audit pending.**

The proposed contract reuses the existing internal reason families and does not create an independent commerce-only enforcement vocabulary.

### Escalation owner

Status: **Prepared for owner review.**

Default routing is Platform Operations / Trust and Safety, with Security, Privacy, Legal, or Compliance escalation according to the concern. Severe-harm matters use the #667 model. Legal preservation or disclosure uses #674 only under its existing authorization boundaries.

### Age or location dependency

Status: **Mapped at policy level; counsel review required for jurisdiction-specific claims.**

Current teen protected-commerce restrictions remain authoritative. Location-specific legality or professional authorization is not inferred.

### Evidence and retention requirement

Status: **Internally mapped.**

The proposed contract uses minimum-necessary platform evidence, the restricted Trust and Safety case system for severe harm, the #668 retention/disposition controls, and #674 legal holds when applicable.

### Member notice language

Status: **Reason-family wording prepared; final templates pending policy/accessibility/privacy/legal review.**

The taxonomy proposes plain-language notice families without accusing a member of criminal conduct unless a reviewed standard supports that language.

### Appeal evidence and exception rules

Status: **Prepared for owner review.**

Appeals may address misclassification, ownership, authorization, credential status, pricing/claim correction, duplicate status, or transactional versus documentary context. Appeals may not create a new regulated-program exception.

## 4. Acceptance-criteria readiness

### All commerce and professional modules use or map to the same taxonomy

**Partially ready.**

The policy-level shared taxonomy is now defined. Production module reason fields and report contracts still require a technical audit and mapping phase.

### Module-specific rules may be stricter but cannot silently conflict

**Ready at policy-contract level.**

The canonical document expressly permits stricter module rules while prohibiting silent redefinition of the shared category.

### Administrator tools expose consistent reasons

**Not yet verified.**

The Platform Operations Center already exists, but its exact production reason fields and labels must be audited and then mapped to the canonical reason IDs.

### Duplicate or evasive reposting is addressed

**Ready at policy-contract level.**

`COM-14` maps to `INTEGRITY.DUPLICATE_OR_EVASIVE_REPOSTING` and requires intent/pattern review rather than treating similarity as proof.

### Public Marketplace, Jobs, Services, and regulated-goods policies use canonical terms

**Not yet public-ready.**

Existing drafts remain internal. They should be updated only after owner and qualified review and after production reason mapping is verified.

### Qualified commerce, employment, advertising, professional-practice, and regulatory legal review is completed

**Not complete.**

This is intentionally reserved for the consolidated counsel package.

## 5. Technical audit required next

The next Issue #670 phase should inspect production code/schema for each module and answer:

1. What report table or report record type is canonical?
2. What field currently stores the member-facing report reason?
3. What field currently stores administrator disposition or moderation reason?
4. Is the value constrained by a database enum/check, TypeScript union, UI list, or free text?
5. Can multiple reasons be represented?
6. Can the canonical enforcement-decision system store the target type and reason without a new parallel ledger?
7. How are report resolution and record removal kept distinct?
8. How are duplicate/evasive records represented?
9. What member notice is currently generated?
10. What appeal/restoration behavior exists for the module?
11. Does the admin surface expose a free-text reason that should become a canonical choice?
12. Does any reason value contain language that makes an unsupported legal conclusion?

The audit should cover, at minimum:

- Marketplace
- Businesses
- Jobs
- Events
- Requests
- Services
- Rooms where commercial activity is involved
- Appointments
- Local
- private-message reports or safety escalation used to move prohibited transactions off the originating module

## 6. Implementation principles for the technical phase

The technical implementation should prefer the narrowest additive mapping possible.

It should not:

- replace existing report tables merely to satisfy the taxonomy;
- collapse report resolution into enforcement action;
- automatically remove a record because a reason was selected;
- infer criminality from a category;
- weaken existing administrator authorization;
- weaken teen-safety controls;
- bypass the canonical enforcement/appeals system;
- bypass Trust and Safety severe-harm escalation;
- bypass Legal Operations hold or disclosure controls;
- create public policy before verification.

Where existing reason fields are free text, a compatibility path should preserve historical records while canonical IDs are introduced for new decisions.

## 7. Owner decisions requested before final policy conversion

The platform owner should eventually confirm the operating position for these product-policy questions. These are business choices subject to qualified counsel review where law is implicated.

1. Keep ordinary Loombus commerce completely closed to firearms, ammunition, explosive devices, and weapon components rather than attempting age/license verification.
2. Keep ordinary Loombus commerce closed to alcohol, nicotine, cannabis, controlled substances, and prescription medicines rather than building age/prescription verification.
3. Keep sexual services and exploitation-related transactions prohibited across all modules.
4. Keep account credentials, personal-data sales, malware, hacking-for-hire, and unauthorized surveillance prohibited.
5. Keep money-mule, reshipping, pyramid, deceptive investment, and unsupported gambling activity prohibited.
6. Keep government IDs, benefits, licenses, permits, and forged credentials prohibited as transaction items.
7. Keep live-animal sales unsupported unless a future separately verified program is deliberately approved.
8. Treat food, cosmetics, medical devices, and similar high-risk goods as conditionally unsupported until explicit category decisions are made.
9. Prohibit deceptive professional credentials and out-of-scope professional practice claims.
10. Prohibit fake Jobs, recruiting fees/scams, money-mule roles, trafficking recruitment, material compensation deception, and unlawful discrimination under counsel-approved standards.
11. Require disclosure when AI-generated commercial media could reasonably be mistaken for actual work, inventory, staff, facility, testimonial evidence, or results.
12. Treat duplicate/evasive reposting as an integrity violation only when evidence supports evasion rather than relying on similarity alone.
13. Apply minimum-necessary data collection to Services, Jobs, Requests, Appointments, and inquiries.
14. Keep teen protected-commerce restrictions in force until a separate age-aware commerce program is deliberately designed and approved.
15. Do not create a module-specific exception through an individual appeal when the platform has no approved program for the regulated category.

These positions can be reviewed with the owner after the technical mapping phase so the final package presented to counsel includes both actual production behavior and explicit business choices.

## 8. Counsel review requested

Qualified counsel should eventually review the categories and public language for:

- weapons and regulated dangerous items;
- drugs, medicines, cannabis, nicotine, alcohol, and age-restricted products;
- gambling and regulated financial activity;
- live animals, food, cosmetics, medical devices, hazardous and environmental goods;
- professional licensing and scope-of-practice claims;
- employment discrimination, child labor, and recruiting requirements;
- medical, legal, financial, immigration, tax, and other regulated professional claims;
- consumer-protection, pricing, fee, testimonial, endorsement, and AI-advertising rules;
- geographic restrictions and any future shipping/delivery obligations;
- member-notice wording that could imply legal guilt or regulatory findings.

The review should identify which rules are:

- legally required;
- legally prohibited;
- legally permitted but operationally unsupported;
- Loombus product-policy choices stricter than law;
- dependent on jurisdiction, age, licensing, or transaction method.

## 9. Current public and production boundary

Until later phases are completed:

- the five commerce policy drafts remain internal;
- no new public Marketplace, Jobs, Services, regulated-goods, or professional-claims promise is authorized by this document;
- no new commerce reason code is enforced merely because it appears in documentation;
- no external regulator, law-enforcement agency, or other outside party is contacted;
- no member data is exported or disclosed;
- no new regulated category is approved;
- current teen-safety, account-standing, moderation, retention, legal-hold, and administrator authorization controls remain unchanged.

## 10. Completion path

Issue #670 can be treated as internally complete for the consolidated counsel package only after:

1. owner review of the proposed commerce operating positions;
2. production reason/report field audit across all named modules;
3. canonical technical mapping of module reports and enforcement reasons;
4. administrator reason consistency verification;
5. enforcement/appeal compatibility verification;
6. update of the affected internal public-policy drafts to use the canonical terms;
7. creation of a final Issue #670 owner-position and counsel-handoff record;
8. no unresolved technical contradiction between the taxonomy and live product behavior.

Qualified counsel approval remains a later consolidated gate before final public policy publication where required.