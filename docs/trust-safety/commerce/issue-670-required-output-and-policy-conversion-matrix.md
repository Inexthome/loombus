# Issue #670 Required Output and Policy Conversion Matrix

## Status

**Tracks:** Issue #670  
**Status:** Internal completion and policy-conversion matrix  
**Public ready:** No  
**Qualified legal review:** Required before public publication or jurisdiction-specific legal claims  
**Production authorization created by this document:** None

This document consolidates the remaining Issue #670 policy-output work after the deployed `commerce_integrity.v1` taxonomy, classification ledger, and manual reviewer workspace.

It is an internal owner/operations crosswalk. It does not decide whether conduct is unlawful, authorize a regulated category, change moderation powers, create enforcement, send member notices, enable restricted Room or private-message classification, or publish public policy.

## 1. Deployed technical baseline

The following Issue #670 foundations are complete and should not be rebuilt:

- canonical commerce/professional-integrity taxonomy with `COM-01` through `COM-15`;
- application registry `commerce_integrity.v1`;
- explicit `POLICY.S0` through `POLICY.S5` severity namespace;
- separate `TS.S1_CRITICAL` through `TS.S4_STANDARD` Trust and Safety triage namespace;
- restricted append-only classification ledger;
- exact source/report validation at classification time;
- single-head append-only supersession controls;
- restricted classification event history;
- preservation-hold compatibility;
- human-review-only administrator classification API and workspace;
- write-enabled classification only for Marketplace, Businesses, Services, Requests, Jobs, Events, and conditional Appointments;
- Rooms and private messages/conversations remain write-disabled;
- Local remains inherited-only;
- no AI classification or historical fuzzy/semantic conversion;
- no automatic report resolution, source moderation, enforcement, notice, legal action, or external action.

## 2. Required-output completeness

Issue #670 requires each category to provide:

1. canonical category ID and definition;
2. allowed discussion versus prohibited transaction boundary;
3. module applicability;
4. report reason;
5. enforcement reason;
6. escalation owner;
7. age or location dependency;
8. evidence and retention requirement;
9. member notice language;
10. appeal evidence and exception rules.

The canonical taxonomy already contains the category definition, transaction boundary, module applicability, safety-reason mapping, escalation owner, age/location dependency, evidence expectations, member-notice basis, and appeal/exception considerations for each `COM-*` category.

The remaining conversion rule is:

- member-submitted report text stays original and is never silently rewritten into a confirmed canonical finding;
- the reviewer selects a canonical `COM-*` category and canonical safety reason only after human review;
- enforcement uses the existing platform safety/enforcement reason model rather than a second contradictory commerce-only enforcement vocabulary;
- member notice uses the narrowest supported approved reason derived from the reviewed classification and enforcement decision;
- public policy may describe categories in plain language but must preserve the same underlying `COM-*` scope.

## 3. Category output crosswalk

### COM-01 Weapons, ammunition, explosives, and dangerous items

**Canonical transaction boundary:** Discussion, news, safety, history, sport, documentary, policy, and prevention context can remain distinguishable from offering, requesting, sourcing, transferring, financing, or facilitating a prohibited transaction.

**Primary canonical reasons:**

- `GOODS.WEAPON_OR_EXPLOSIVE`
- `VIOLENCE.WEAPON_WRONGDOING`
- `VIOLENCE.OPERATIONAL_FACILITATION`

**Escalation owner:** Platform Operations / Trust and Safety for ordinary records; severe-harm routing for credible threats or dangerous facilitation; Legal/Compliance for jurisdiction-specific ambiguity.

**Age/location dependency:** High. Teen commerce remains excluded. Jurisdiction-specific legality must not be inferred from a member statement.

**Evidence/retention:** Preserve minimum source-record metadata, relevant item description, platform-native images/references, actor identifiers, linked report identifiers, moderation history, classification history, and audit events under existing Issue #668 retention and Issue #674 preservation controls.

**Notice basis:** Prohibited weapons or dangerous-item transaction, using the narrowest approved reason.

**Appeal/exception evidence:** Misclassification, ordinary tools, sporting/safety equipment, documentary context, or another non-transactional context. Local legality alone does not create an automatic Loombus commerce exception.

**Primary public conversion targets:** `CS-010 Illegal and Regulated Goods`, `MC-001 Marketplace Prohibited Items`.

### COM-02 Drugs, medicines, intoxicants, and age-restricted products

**Primary canonical reasons:**

- `GOODS.DRUG_OR_CONTROLLED_PRODUCT`
- `GOODS.PRESCRIPTION_OR_REGULATED_MEDICAL`
- `GOODS.AGE_RESTRICTED_PRODUCT`
- fraud reasons where independently supported

**Transaction boundary:** Public-health, recovery, educational, research, historical, news, and policy discussion remains distinguishable from offering, requesting, delivering, arranging, or promoting a transaction.

**Escalation owner:** Platform Operations / Trust and Safety; Legal/Compliance for regulated-category ambiguity; child-safety routing where a minor is targeted.

**Age/location dependency:** High. Current protected-commerce controls do not authorize teen transactions in age-restricted categories.

**Evidence/retention:** Minimum source metadata, product claims, seller/provider identity, price/fulfillment representation, relevant reports, reviewed platform-native evidence, classification history, and audit events.

**Notice basis:** Prohibited or unsupported drug, medicine, intoxicant, or age-restricted product.

**Appeal/exception evidence:** Ordinary lawful non-prescription product, informational discussion, misclassification, or future explicitly approved verified program. No ad hoc regulated-category exception.

**Primary public conversion targets:** `CS-010`, `MC-001`.

### COM-03 Stolen, counterfeit, forged, recalled, unsafe, and infringing goods

**Primary canonical reasons:**

- `GOODS.STOLEN_PROPERTY`
- `GOODS.COUNTERFEIT_OR_FORGED`
- `GOODS.RECALLED_OR_UNSAFE_PRODUCT`
- `IP.COPYRIGHT`
- `IP.TRADEMARK`
- `IP.COUNTERFEIT`
- `FRAUD.IMPERSONATION` where separately supported

**Transaction boundary:** Authentication education, anti-counterfeit reporting, news, criticism, documentary context, and ownership discussion remain distinguishable from offering or facilitating the goods.

**Escalation owner:** Platform Operations / Trust and Safety; IP/legal process for rights claims; specialist safety escalation for immediate product hazards.

**Age/location dependency:** Usually low for age, potentially high for recall, safety, ownership, or infringement jurisdiction.

**Evidence/retention:** Source record, seller identity, claimed brand/source, stored images, serial/ownership references legitimately provided, report context, duplicate/repost indicators, classification and enforcement history.

**Notice basis:** Narrowest supported stolen, counterfeit, forged, unsafe, recalled, or infringing reason.

**Appeal/exception evidence:** Ownership, authorization, authenticity, lawful resale, parody/documentary context, recall-status correction, or misclassification.

**Primary public conversion targets:** `CS-010`, `MC-001`, `CS-009` where deceptive identity or repeated evasion is present.

### COM-04 Hazardous, environmental, wildlife, and biological materials

**Primary canonical reasons:**

- `GOODS.HAZARDOUS_MATERIAL`
- `GOODS.WILDLIFE_OR_ENVIRONMENTAL_CONTRABAND`
- `GOODS.RECALLED_OR_UNSAFE_PRODUCT`

**Transaction boundary:** Scientific, environmental, regulatory, safety, educational, historical, or journalistic discussion remains distinguishable from commercial sourcing or operational facilitation.

**Escalation owner:** Trust and Safety / Platform Operations; Legal/Compliance for regulated or jurisdiction-specific treatment; emergency/security routing for credible immediate danger.

**Age/location dependency:** High location dependency; current model does not support teen commerce in high-risk regulated categories.

**Evidence/retention:** Minimum item/material claim, source metadata, location context already available, report/evidence references, transaction-facilitation indicators, and audit history.

**Notice basis:** Prohibited hazardous, environmental, wildlife, or biological commercial activity.

**Appeal/exception evidence:** Ordinary household goods, lawful plants/agricultural items, non-hazardous materials, scientific discussion, or misclassification. No one-off creation of a specialized regulated program.

**Primary public conversion targets:** `CS-010`, `MC-001`.

### COM-05 Sexual exploitation, sexual services, trafficking, and coercive labor

**Primary canonical reasons:**

- `CHILD.SEXUAL_EXPLOITATION_MATERIAL`
- `CHILD.GROOMING`
- `CHILD.SEXUAL_SOLICITATION`
- `CHILD.SEXTORTION`
- `INTIMATE.NONCONSENSUAL_DISTRIBUTION`
- `INTIMATE.SEXTORTION`
- `FRAUD.EMPLOYMENT_SCAM` where independently supported

**Transaction boundary:** Survivor support, prevention, legal discussion, documentary, research, news, and education remain distinguishable from recruitment, solicitation, payment, arrangement, trafficking, or facilitation.

**Escalation owner:** Trust and Safety severe-harm process. Any external child-safety reporting or emergency disclosure remains separately controlled under the Issue #667 and #674 counsel-gated procedures.

**Age/location dependency:** Critical. Any minor-related sexual exploitation follows the child-safety path and is never normalized as ordinary commerce.

**Evidence/retention:** Minimum necessary evidence references, protected-source handling, restricted access, preservation where required, classification history, case links, and audit trail. Avoid unnecessary copying of traumatic or illegal material.

**Notice basis:** Narrowest approved exploitation, trafficking, sexual-solicitation, coercion, or related reason that can safely be disclosed.

**Appeal/exception evidence:** Misclassification, survivor-support/prevention context, documentary context, or another clearly non-facilitating use. No transactional exception for exploitation.

**Primary public conversion targets:** `CS-010`, `MC-001`, `JC-001`, `SC-001`, plus the separate child-safety standards.

### COM-06 Security, account access, personal data, malware, hacking, and surveillance abuse

**Primary canonical reasons:**

- `SECURITY.PHISHING`
- `SECURITY.MALWARE`
- `SECURITY.CREDENTIAL_THEFT`
- `SECURITY.ACCOUNT_COMPROMISE`
- `SECURITY.UNAUTHORIZED_SURVEILLANCE`
- `SECURITY.EXPLOIT_OR_BYPASS`
- `GOODS.PERSONAL_DATA_OR_ACCOUNT_ACCESS`
- applicable `PRIVACY.*` reasons

**Transaction boundary:** Defensive security research, authorized testing, education, incident reporting, news, and prevention remain distinguishable from selling credentials, unauthorized access, malware deployment, phishing, surveillance abuse, or circumvention services.

**Escalation owner:** Security / Trust and Safety, with Legal/Compliance where authorization or jurisdiction is unclear.

**Age/location dependency:** Usually not age-specific; authorization and local law may be material.

**Evidence/retention:** Source/report IDs, security indicators, exact account/resource references, audit events, minimum stored technical evidence, and case links. Do not copy secrets or credentials into classification notes.

**Notice basis:** Narrowest security, credential, account-access, privacy, or surveillance reason.

**Appeal/exception evidence:** Demonstrable authorization, defensive purpose, research context, false positive, or unrelated security discussion.

**Primary public conversion targets:** `CS-009`, `CS-010`, `MC-001`, `SC-001`, `JC-001` where recruiting abuse is involved.

### COM-07 Gambling, financial schemes, investment promotions, and money-mule activity

**Primary canonical reasons:**

- `FRAUD.INVESTMENT_OR_FINANCIAL_SCHEME`
- `FRAUD.MONEY_MULE_OR_RESHIPPING`
- `FRAUD.PAYMENT_SCAM`
- `JOBS.MONEY_MULE_OR_RESHIPPING`
- `SERVICE.DECEPTIVE_LEGAL_OR_FINANCIAL_CLAIM`

**Transaction boundary:** General financial education, news, analysis, lawful discussion, and criticism remain distinguishable from deceptive solicitation, money movement, unapproved gambling commerce, fraudulent recruiting, or false professional claims.

**Escalation owner:** Platform Operations / Trust and Safety; specialist financial/compliance or Legal review where regulated status is material.

**Age/location dependency:** High for gambling and regulated financial products; location may determine additional restrictions.

**Evidence/retention:** Offer/claim text, pricing/payment method, actor identity, linked report, recruiting or transaction instructions, related account/network indicators, and audit history.

**Notice basis:** Narrowest supported financial-scheme, payment-scam, money-mule, gambling, or deceptive professional claim.

**Appeal/exception evidence:** Ordinary financial discussion, non-transactional educational context, supported lawful business description, or misclassification. Regulated financial activity requires approved program rules rather than reviewer assumption.

**Primary public conversion targets:** `CS-009`, `CS-010`, `JC-001`, `SC-001`, `MC-001`.

### COM-08 Government documents, public benefits, permits, licenses, and credentials

**Primary canonical reasons:**

- `GOODS.GOVERNMENT_DOCUMENT_OR_BENEFIT`
- `SERVICE.FALSE_CREDENTIAL`
- `FRAUD.IMPERSONATION`
- `PRIVACY.GOVERNMENT_IDENTIFIER`

**Transaction boundary:** Education, application guidance, news, policy discussion, and legitimate professional assistance remain distinguishable from sale, forgery, unauthorized transfer, impersonation, benefit fraud, or credential fabrication.

**Escalation owner:** Platform Operations / Trust and Safety; Legal/Compliance or specialist professional review where credential or government-process rules are unclear.

**Age/location dependency:** Primarily jurisdiction/location-dependent.

**Evidence/retention:** Source record, credential claim, issuer/reference already supplied, actor identity, relevant report, professional/business attribution, and classification/audit history. Avoid unnecessary storage of complete government identifiers.

**Notice basis:** Prohibited government-document, benefit, permit, credential, or impersonation activity.

**Appeal/exception evidence:** Legitimate document-assistance service, public informational material, lawful credential display, misclassification, or verified authorization.

**Primary public conversion targets:** `CS-010`, `MC-001`, `JC-001`, `SC-001`.

### COM-09 Live animals, food, cosmetics, medical devices, and other conditionally allowed categories

**Primary canonical reasons:**

- `GOODS.UNAPPROVED_LIVE_ANIMAL_OR_FOOD`
- `GOODS.RECALLED_OR_UNSAFE_PRODUCT`
- `GOODS.PRESCRIPTION_OR_REGULATED_MEDICAL`
- fraud reasons where independently supported

**Transaction boundary:** Ordinary discussion and potentially ordinary low-risk lawful goods remain distinguishable from categories requiring unavailable safety, health, age, transport, veterinary, medical, or regulatory controls.

**Escalation owner:** Platform Operations / Trust and Safety; specialist commerce/compliance or Legal review where the category is conditionally permitted or regulated.

**Age/location dependency:** Variable; jurisdiction and product class may be material.

**Evidence/retention:** Exact item/product claim, source record, seller/business attribution, location already provided, health/safety representations, relevant report, and classification history.

**Notice basis:** Unsupported or prohibited high-risk product category, using the narrowest approved product reason.

**Appeal/exception evidence:** Ordinary lawful food/product, non-regulated device, lawful live-animal category under an approved program, safety-status correction, or misclassification.

**Primary public conversion targets:** `CS-010`, `MC-001`.

### COM-10 Illegal, dangerous, or unsafe services

**Primary canonical reasons:**

- `SERVICE.ILLEGAL_OR_DANGEROUS_WORK`
- `VIOLENCE.OPERATIONAL_FACILITATION`
- `SECURITY.EXPLOIT_OR_BYPASS`
- `ROOM.ILLEGAL_OR_SEVERE_HARM_PURPOSE` where separately applicable

**Transaction boundary:** Discussion, research, commentary, safety education, prevention, and ordinary lawful service descriptions remain distinguishable from offering, requesting, arranging, or operationally facilitating dangerous or prohibited work.

**Escalation owner:** Services/Platform Operations and Trust and Safety; severe-harm, Security, or Legal/Compliance routing according to the underlying facts.

**Age/location dependency:** Often location-dependent; teen eligibility requires the existing protected-commerce rules.

**Evidence/retention:** Service/request record, provider/requester identity, business attribution, claimed scope, location already provided, report references, appointment links where relevant, classification history, and audit events.

**Notice basis:** Prohibited or unsafe service/request activity, with the narrowest canonical reason.

**Appeal/exception evidence:** Lawful ordinary service, misclassification, clearly educational/consultative context, or proof that the reviewed activity differs materially from the prohibited description.

**Primary public conversion targets:** `CS-010`, `SC-001`, `JC-001` where a job recruits for the work.

### COM-11 Professional credentials, licensing, and scope-of-practice integrity

**Primary canonical reasons:**

- `SERVICE.FALSE_CREDENTIAL`
- `SERVICE.UNLICENSED_OR_OUT_OF_SCOPE`
- `FRAUD.IMPERSONATION`
- `JOBS.FAKE_EMPLOYER_OR_AUTHORITY`

**Transaction boundary:** General professional discussion and accurately represented unregulated services remain distinguishable from false credential claims, unauthorized protected titles, deceptive licensing claims, or services represented outside an approved scope.

**Escalation owner:** Services/Business/Jobs operations and Trust and Safety; qualified professional-practice or Legal/Compliance review for jurisdiction-specific credential requirements.

**Age/location dependency:** High location dependency because licensing and protected-title rules vary.

**Evidence/retention:** Exact claim, provider/business/job record, credential reference voluntarily supplied, issuer/jurisdiction asserted, relevant report, classification history, and audit events. Do not collect unnecessary sensitive identity documents.

**Notice basis:** False, unsupported, or out-of-scope professional credential/authority claim.

**Appeal/exception evidence:** Valid credential/authorization, corrected jurisdiction, non-protected descriptive title, accurate unregulated-service framing, or misclassification.

**Primary public conversion targets:** `SC-001`, `JC-001`, `CS-009` where impersonation is present.

### COM-12 Employment integrity, discrimination, recruitment scams, and unsafe opportunities

**Primary canonical reasons:**

- `JOBS.FAKE_EMPLOYER_OR_AUTHORITY`
- `JOBS.NONEXISTENT_OR_MISREPRESENTED_ROLE`
- `JOBS.APPLICATION_FEE_OR_PAYMENT_SCAM`
- `JOBS.MONEY_MULE_OR_RESHIPPING`
- `JOBS.DISCRIMINATION`
- `JOBS.MISLEADING_COMPENSATION`
- `JOBS.SENSITIVE_INFORMATION_ABUSE`
- `JOBS.UNSAFE_TEEN_OPPORTUNITY`
- `JOBS.EXTERNAL_APPLICATION_DECEPTION`
- `JOBS.DUPLICATE_OR_STALE_POSTING`

**Transaction boundary:** Legitimate employment discussion, career advice, employer criticism, recruiting education, and genuine job postings remain distinguishable from deceptive, exploitative, discriminatory, fraudulent, or unsafe recruitment.

**Escalation owner:** Jobs Operations / Trust and Safety; Privacy/Security for sensitive-data abuse; child-safety routing for unsafe teen targeting; qualified employment counsel for legal standards.

**Age/location dependency:** High for teen eligibility and jurisdiction-specific employment/discrimination requirements.

**Evidence/retention:** Job record, employer/business attribution, compensation/application claims, external destination, linked reports, applicant-safety evidence references, duplicate indicators, classification history, and audit events.

**Notice basis:** Narrowest canonical Jobs integrity reason.

**Appeal/exception evidence:** Legitimate employer authority, corrected role/compensation/location, lawful job requirement, resolved external destination error, duplicate/stale correction, or misclassification.

**Primary public conversion targets:** `JC-001`, `CS-009`, `CS-010` where prohibited activity is recruited.

### COM-13 Commercial claims, pricing, fees, endorsements, testimonials, and AI representations

**Primary canonical reasons:**

- `SERVICE.DECEPTIVE_PRICE_OR_FEE`
- `SERVICE.FALSE_RESULT_OR_PORTFOLIO`
- `FRAUD.FALSE_TESTIMONIAL_OR_ENDORSEMENT`
- `AI_MEDIA.FALSE_COMMERCIAL_REPRESENTATION`
- `JOBS.MISLEADING_COMPENSATION`
- `INTEGRITY.FAKE_ENGAGEMENT`

**Transaction boundary:** Opinion, clearly disclosed advertising, ordinary sales language, satire, and accurately represented AI-assisted material remain distinguishable from deceptive pricing, undisclosed material promotion, fabricated results/testimonials, false commercial identity, or materially misleading AI representations.

**Escalation owner:** Platform Operations / Trust and Safety; Advertising/Commerce or Legal review for disclosure and regulated-claim standards.

**Age/location dependency:** Usually not age-dependent, but consumer-protection and advertising rules may vary by location/category.

**Evidence/retention:** Exact claim, displayed price/fee/compensation, disclosure state, testimonial/portfolio reference, AI-media representation where relevant, actor/business attribution, report/classification history, and audit events.

**Notice basis:** Narrowest deceptive commercial claim, price/fee, testimonial, compensation, or AI-representation reason.

**Appeal/exception evidence:** Corrected disclosure, substantiation, accurate price/fee, genuine testimonial/portfolio authority, non-material AI use, or misclassification.

**Primary public conversion targets:** `CS-009`, `MC-001`, `JC-001`, `SC-001`.

### COM-14 Duplicate, evasive, manipulative, and off-platform transaction abuse

**Primary canonical reasons:**

- `INTEGRITY.DUPLICATE_OR_EVASIVE_REPOSTING`
- `INTEGRITY.SIGNAL_OR_RANKING_MANIPULATION`
- `INTEGRITY.FAKE_ENGAGEMENT`
- `INTEGRITY.BAN_OR_RESTRICTION_EVASION`
- `INTEGRITY.ACCOUNT_NETWORK`
- `ABUSE.REPORT_MISUSE`

**Transaction boundary:** Legitimate renewal, recurring events, corrected reposts, authorized templates, and relevant cross-posting remain distinguishable from evasion, deceptive duplication, manipulation, fake engagement, account networks, retaliatory reporting, or off-platform redirection used to bypass protections.

**Escalation owner:** Platform Operations / Trust and Safety; Security where compromised accounts or evasion tooling is involved.

**Age/location dependency:** Usually not location-dependent.

**Evidence/retention:** Related source IDs, account/business relationships, timing, exact duplicate/evasion indicators, prior moderation/enforcement, linked reports, classification history, and audit events.

**Notice basis:** Narrowest duplicate, evasion, manipulation, fake-engagement, account-network, or report-misuse reason.

**Appeal/exception evidence:** Legitimate renewal, distinct audience/context, material record changes, authorized organization workflow, false linkage, or misclassification.

**Primary public conversion targets:** `CS-009`, plus module-specific Marketplace/Jobs/Services rules.

### COM-15 Sensitive-data, inquiry, appointment, and professional-intake abuse

**Primary canonical reasons:**

- `SERVICE.PRIVACY_OR_INTAKE_ABUSE`
- `SERVICE.APPOINTMENT_OR_INQUIRY_MISUSE`
- `JOBS.SENSITIVE_INFORMATION_ABUSE`
- `PRIVACY.GOVERNMENT_IDENTIFIER`
- `PRIVACY.FINANCIAL_INFORMATION`
- `PRIVACY.AUTHENTICATION_SECRET`
- `PRIVACY.MEDICAL_OR_VULNERABILITY_INFORMATION`

**Transaction boundary:** Legitimate professional intake, scheduling, application questions, and necessary contact information remain distinguishable from unnecessary sensitive-data collection, credential collection, inquiry harassment, appointment misuse, or exploitation of vulnerable information.

**Escalation owner:** Platform Operations / Trust and Safety; Privacy/Security for sensitive data; child-safety or Legal/Compliance where protected-party or regulated-profession issues are implicated.

**Age/location dependency:** May be high where minors, medical information, regulated professionals, or jurisdiction-specific privacy obligations are involved.

**Evidence/retention:** Minimum necessary request/inquiry/appointment metadata, exact sensitive-data request or misuse indicator, actor/source identifiers, relevant report, classification history, and audit events. Do not copy authentication secrets or unnecessary sensitive values into notes.

**Notice basis:** Narrowest privacy, intake, appointment/inquiry, or sensitive-information abuse reason.

**Appeal/exception evidence:** Demonstrable legitimate necessity, corrected intake practice, authorized professional workflow, false positive, or misclassification.

**Primary public conversion targets:** `SC-001`, `JC-001`, privacy/help-center materials where applicable.

## 4. Existing policy-draft conversion matrix

### CS-009 Fraud, Spam, and Coordinated Manipulation

**Current state:** Substantial internal draft; public-ready false; legal review required.

**Canonical categories that must be reflected without changing the draft's broader platform scope:**

- `COM-03` for stolen/counterfeit deception where commercial;
- `COM-06` for phishing, malware, credentials, account compromise, surveillance, and unauthorized access;
- `COM-07` for investment/payment/money-mule schemes;
- `COM-08` for impersonation and fraudulent credentials where commercial;
- `COM-12` for employment scams;
- `COM-13` for false testimonials, commercial disclosures, pricing/compensation deception, and AI commercial representations;
- `COM-14` for duplicate/evasive reposting, ranking manipulation, fake engagement, account networks, and report misuse;
- `COM-15` for sensitive-data collection abuse.

**Conversion rule:** CS-009 remains the broad platform manipulation standard. It should reference canonical commerce categories where conduct occurs in a commerce/professional surface rather than redefining those categories.

### CS-010 Illegal and Regulated Goods

**Current state:** Substantial internal draft; public-ready false; legal review required.

**Canonical categories:** `COM-01` through `COM-11` as applicable, plus `COM-15` where intake/sensitive data is part of a regulated-service workflow.

**Conversion rule:** CS-010 should become the general regulated-goods/services baseline and use the canonical category names. It must avoid claiming a category is legally prohibited everywhere. Public wording should distinguish Loombus policy prohibitions from legal conclusions.

### MC-001 Marketplace Prohibited Items

**Current state:** Substantial internal draft; public-ready false; legal review required.

**Canonical categories:** Primarily `COM-01`, `COM-02`, `COM-03`, `COM-04`, `COM-06`, `COM-07`, `COM-08`, `COM-09`, `COM-13`, `COM-14`; other categories only where Marketplace facts support them.

**Conversion rule:** Marketplace may be stricter than the platform baseline but must use the same category meaning. Marketplace-specific prohibited-item examples are implementation examples, not new category definitions.

### JC-001 Jobs Integrity Standard

**Current state:** Substantial internal draft; public-ready false; legal review required.

**Canonical categories:** Primarily `COM-05`, `COM-06`, `COM-07`, `COM-08`, `COM-10`, `COM-11`, `COM-12`, `COM-13`, `COM-14`, `COM-15`.

**Conversion rule:** Jobs-specific reasons should remain precise (`JOBS.*`) while `COM-12` provides the shared commerce/professional category. Employment-law statements, discrimination standards, teen eligibility, compensation disclosures, and sensitive-data rules require qualified review before publication.

### SC-001 Services and Professional Claims Standard

**Current state:** Substantial internal draft; public-ready false; legal review required.

**Canonical categories:** Primarily `COM-05`, `COM-06`, `COM-07`, `COM-08`, `COM-10`, `COM-11`, `COM-13`, `COM-14`, `COM-15`.

**Conversion rule:** Services/professional claims may be stricter where Loombus cannot verify licensing, scope, credential, health, legal, financial, or safety requirements. The public standard must not imply universal credential verification or make unreviewed jurisdiction-specific scope-of-practice conclusions.

## 5. Administrator reason consistency

The administrator reason model should use three distinct layers:

1. **Reporter allegation:** Original member-submitted reason/details, preserved exactly under the source module's report contract.
2. **Reviewed canonical classification:** `COM-*` category plus one primary canonical safety reason and optional secondary reasons, recorded in the Issue #670 append-only ledger.
3. **Operational enforcement reason:** Existing platform safety/enforcement reason selected for an actual enforcement decision. Classification does not itself create the enforcement decision.

The Phase D Commerce Integrity Review workspace satisfies the requirement for an administrator tool that exposes the shared canonical reason vocabulary. Existing module-native moderation screens do not need to rewrite historical or incoming report text to appear consistent.

Future module integration may display the current canonical classification read-only beside a source record or report, but it must not auto-resolve the report or auto-select enforcement.

## 6. Member notice conversion rule

The canonical taxonomy's `Member notice basis` is a drafting input, not an automatic notice.

A final notice must be tied to the actual action taken and should:

- identify the affected module/record when safe and appropriate;
- use the narrowest approved policy reason;
- avoid unsupported criminal or legal conclusions;
- distinguish a Loombus policy restriction from a statement of law;
- avoid exposing reporter identity or protected evidence;
- explain the available appeal path when one exists;
- be withheld, delayed, or modified where another approved safety/legal process requires it.

No Issue #670 classification status automatically sends a notice.

## 7. Appeals and exceptions

Appeal review should test the reviewed facts and category application rather than merely accepting a member's disagreement.

Relevant evidence may include:

- proof of ownership or authorization;
- corrected product/service/job information;
- legitimate credential or business authority;
- proof that a record is discussion/documentary/educational rather than transactional;
- corrected price, compensation, disclosure, or destination;
- evidence of legitimate renewal or non-evasive reuse;
- evidence of authorization for defensive security/testing;
- evidence that an allegedly sensitive intake request was reasonably necessary and properly handled;
- evidence that the source record was misidentified or the canonical category does not apply.

Exceptions must be programmatic and documented where a regulated or high-risk category requires special controls. A reviewer should not create a new regulated-commerce program through one appeal decision.

## 8. Evidence and retention rules

Issue #670 does not create a new retention schedule.

Use the approved Issue #668 record-class/disposition framework and Issue #674 exact preservation-hold controls. Classification history remains append-only under the deployed Phase C foundation.

Evidence principles:

- retain the minimum information needed to support review, audit, appeal, and approved retention obligations;
- prefer identifiers/references over copying sensitive source material into classification notes;
- never place authentication secrets, complete payment credentials, unnecessary government identifiers, or unnecessary protected evidence in classification basis notes;
- preserve the source/report relationship at classification time without creating a new foreign-key deletion blocker;
- where a source is later disposed under an approved lifecycle, classification history may retain its non-cascading historical identifiers subject to the separately approved classification retention/disposition policy;
- active legal preservation applies only to the exact held target/scope.

## 9. Public-policy publication boundary

The following remain internal until qualified review and final owner approval:

- jurisdiction-specific legality statements;
- age thresholds beyond already approved Loombus product rules;
- licensing, credential, or scope-of-practice standards represented as law;
- employment discrimination/legal-compliance statements;
- medical, legal, financial, advertising, consumer-protection, gambling, alcohol, nicotine, cannabis, prescription-product, wildlife, hazardous-material, weapon, and other regulated-category legal claims;
- any claim that Loombus verifies compliance universally;
- public promises about response times, specialist review, law-enforcement contact, reporting, or monitoring that operations cannot support.

## 10. Internal completion determination

After the deployed PRs through Phase D, Issue #670 is internally complete for:

- canonical category structure;
- cross-module applicability;
- consistent administrator classification vocabulary;
- human-review classification workflow;
- append-only classification history;
- severity namespace separation;
- report/classification/enforcement separation;
- preservation compatibility;
- category-level discussion/transaction boundaries;
- escalation ownership proposals;
- age/location dependency flags;
- evidence expectations;
- proposed member-notice bases;
- appeal/exception considerations;
- canonical conversion mapping for the five existing public-policy drafts.

Still gated:

- final public wording;
- jurisdiction-specific rules;
- qualified commerce legal review;
- qualified employment legal review;
- qualified advertising/consumer-protection review;
- qualified professional-practice review;
- qualified regulated-goods review;
- public publication;
- any future restricted Room/private-message classification workflow;
- any future automatic enforcement, notice, or external action.
