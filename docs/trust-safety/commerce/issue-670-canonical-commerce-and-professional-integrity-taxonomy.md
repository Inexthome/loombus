# Issue #670: Canonical Commerce and Professional-Integrity Taxonomy

## Status

**Status:** Internal proposed taxonomy  
**Tracks:** Issue #670  
**Public ready:** No  
**Qualified legal review:** Required before public-policy conversion or jurisdiction-specific claims  
**Production reason-code migration authorized by this document:** No

This document establishes the proposed shared policy vocabulary for Loombus commercial, professional, employment, appointment, event, Room, Local, and messaging surfaces. It is designed to prevent Marketplace, Businesses, Services, Requests, Jobs, Events, Appointments, Rooms, Local, and private messages from developing contradictory prohibited-activity definitions.

It does not itself create a legal conclusion, approve a regulated activity, create a new moderation power, change member access, change billing, or authorize external reporting.

## 1. Relationship to the existing safety taxonomy

This taxonomy is subordinate to the existing `Loombus Canonical Safety Taxonomy and Decision Model` and reuses its established reason families where possible:

- `GOODS.*`
- `SERVICE.*`
- `JOBS.*`
- `FRAUD.*`
- `INTEGRITY.*`
- `SECURITY.*`
- `IP.*`
- `PRIVACY.*`
- `VIOLENCE.*`
- `CHILD.*`
- `INTIMATE.*`
- `ROOM.*`

Commerce classification does not replace the platform-wide safety reason. A single commercial record may carry both a commerce category and one or more canonical safety reasons.

Example: a Marketplace listing for stolen account credentials may be classified as `COM-06 Security, account access, personal data, and surveillance abuse` while also carrying `GOODS.PERSONAL_DATA_OR_ACCOUNT_ACCESS`, `SECURITY.CREDENTIAL_THEFT`, and `FRAUD.STOLEN_PAYMENT_OR_ACCOUNT` where supported by the reviewed facts.

## 2. Core operating rules

1. A policy category describes the concern. It does not automatically determine the enforcement action.
2. The same conduct should map to the same canonical category across modules unless a module-specific rule is intentionally stricter.
3. A module-specific rule may be stricter than the platform baseline but may not silently redefine the underlying category.
4. Discussion, reporting, documentary, educational, scientific, journalistic, historical, legal, counterspeech, or prevention context must be distinguished from offering, soliciting, arranging, financing, delivering, recruiting for, or facilitating a prohibited transaction.
5. A valid discussion context does not authorize a prohibited transaction.
6. A commercial record may have multiple applicable reasons. Reviewers should select one primary commerce category and add secondary safety reasons when materially relevant.
7. Severity, confidence, evidence sufficiency, member notice, account action, module action, legal preservation, and external escalation remain separate decisions.
8. Automated detection confidence is not proof, is not severity, and must not independently establish professional misconduct or criminal conduct.
9. A listing or claim should not be described as legally prohibited unless the applicable legal standard has been reviewed and supports that conclusion. Internal policy may still prohibit categories that Loombus chooses not to support operationally.
10. Public language must distinguish `Loombus does not allow this category` from `this conduct is unlawful` unless qualified review supports the legal statement.

## 3. Canonical commerce category contract

Every category defined below has:

- a stable category ID;
- a plain-language definition;
- the transaction boundary;
- the principal canonical safety reasons;
- module applicability;
- escalation ownership;
- age or location dependency;
- evidence expectations;
- member-notice basis;
- appeal and exception considerations.

## COM-01 Weapons, ammunition, explosives, and dangerous items

### Definition

Offers, requests, promotions, transfers, services, or arrangements involving weapons, ammunition, explosives, destructive devices, dangerous weapon components, or other items Loombus does not support because of safety, regulatory, age-verification, custody, or transaction-risk concerns.

### Transaction boundary

Allowed context may include news, history, safety education, lawful policy debate, product discussion, documentary material, or prevention content when it does not become an offer, request, procurement channel, operational instruction for wrongdoing, or transaction arrangement.

Commercial offering, solicitation, sale, transfer, sourcing, or transaction facilitation of a prohibited category is not allowed unless a future separately approved verified program expressly permits a narrow category.

### Canonical safety reasons

- `GOODS.WEAPON_OR_EXPLOSIVE`
- `VIOLENCE.WEAPON_WRONGDOING` when harmful use is implicated
- `VIOLENCE.OPERATIONAL_FACILITATION` where the record materially facilitates violence

### Module applicability

Marketplace, Requests, Services, Businesses, Events, Rooms, Local, private messages, and any future commercial feature.

### Escalation owner

Routine prohibited listing: Platform Operations / Trust and Safety.  
Credible threat, dangerous facilitation, or severe-harm context: Trust and Safety S1-S3 routing as applicable.  
Jurisdiction-specific ambiguity: Legal or Compliance review.

### Age/location dependency

High. No minor commercial participation. Location-specific treatment requires qualified review before Loombus represents a category as lawful or unlawful in a particular jurisdiction.

### Evidence

Preserve the commercial record, relevant item description, category, price, seller/requester identifiers, associated images or references already stored by Loombus, relevant message/report identifiers, moderation history, and audit events under the approved retention and preservation controls. Avoid unnecessary duplication of dangerous or traumatic material.

### Member notice basis

`Prohibited weapons or dangerous-item transaction` unless a more precise approved reason applies.

### Appeal / exception

Possible review may consider misclassification, ordinary tools, safety equipment, sporting equipment, documentary context, or another non-transactional context. No exception should be inferred for a prohibited commercial transaction solely because the member asserts local legality.

## COM-02 Drugs, medicines, intoxicants, and age-restricted products

### Definition

Commercial activity involving illegal drugs, controlled substances, prescription products, diverted or counterfeit medicines, cannabis, nicotine, alcohol, dangerous drug-related products, or other age- or prescription-restricted goods that Loombus does not support without a separately approved verified program.

### Canonical safety reasons

- `GOODS.DRUG_OR_CONTROLLED_PRODUCT`
- `GOODS.PRESCRIPTION_OR_REGULATED_MEDICAL`
- `GOODS.AGE_RESTRICTED_PRODUCT`
- `FRAUD.PAYMENT_SCAM` or other fraud reasons where deception is present

### Module applicability

Marketplace, Requests, Services, Businesses, Events, Rooms, Local, private messages.

### Transaction boundary

Educational, public-health, recovery, news, research, historical, or policy discussion may be allowed. Offering, requesting, arranging, delivering, or promoting a prohibited transaction is not.

### Escalation owner

Platform Operations / Trust and Safety; Legal or Compliance for regulated-category ambiguity; child-safety escalation where a minor is targeted.

### Age/location dependency

High. Age-restricted commercial access remains unavailable to teens under the current protected-commerce model. Jurisdictional availability is not inferred from a member's assertion.

### Evidence

Record-level metadata, product claims, seller/provider identifiers, price, fulfillment method, relevant reports, and available platform-native evidence.

### Member notice basis

`Prohibited or unsupported drug, medicine, intoxicant, or age-restricted product`.

### Appeal / exception

May consider ordinary lawful non-prescription products or a misclassified informational Discussion. Regulated or prescription exceptions require an explicitly approved program rather than ad hoc reviewer discretion.

## COM-03 Stolen, counterfeit, forged, recalled, unsafe, and infringing goods

### Definition

Goods or records that are stolen, fraudulently obtained, counterfeit, forged, materially misrepresented, recalled, unsafe, or offered in violation of intellectual-property or ownership rights.

### Canonical safety reasons

- `GOODS.STOLEN_PROPERTY`
- `GOODS.COUNTERFEIT_OR_FORGED`
- `GOODS.RECALLED_OR_UNSAFE_PRODUCT`
- `IP.COPYRIGHT`
- `IP.TRADEMARK`
- `IP.COUNTERFEIT`
- `FRAUD.IMPERSONATION` where source identity is deceptive

### Module applicability

Marketplace, Businesses, Services, Requests, Jobs where credentials are implicated, Events where tickets/credentials are implicated, private messages.

### Transaction boundary

Discussion, authentication education, anti-counterfeit reporting, news, criticism, or documentary context is distinguishable from offering or facilitating the goods.

### Escalation owner

Platform Operations / Trust and Safety. Intellectual-property claims may require the separately approved IP/legal process. Immediate product-safety concerns may require specialist escalation.

### Age/location dependency

Usually not age-dependent; recall, product-safety, and infringement standards may be jurisdiction-specific.

### Evidence

Listing/record ID, seller identity, claimed brand/source, images already stored, serial or ownership references where legitimately provided, report context, prior enforcement, and duplicate/repost indicators.

### Member notice basis

`Stolen, counterfeit, forged, unsafe, recalled, or infringing commercial record` using the narrowest supported reason.

### Appeal / exception

Ownership, authorization, authenticity, lawful resale, parody/documentary context, or recall-status correction may be relevant. Review should not demand unnecessary identity documents or confidential credentials.

## COM-04 Hazardous, environmental, wildlife, and biological materials

### Definition

Commercial activity involving hazardous chemicals, toxins, dangerous biological materials, radioactive materials, unsafe industrial materials, protected wildlife, environmental contraband, dangerous pesticides, or other categories that Loombus cannot safely or lawfully support through ordinary member-to-member commerce.

### Canonical safety reasons

- `GOODS.HAZARDOUS_MATERIAL`
- `GOODS.WILDLIFE_OR_ENVIRONMENTAL_CONTRABAND`
- `GOODS.RECALLED_OR_UNSAFE_PRODUCT`

### Module applicability

Marketplace, Services, Requests, Businesses, Events, Rooms, Local, private messages.

### Transaction boundary

Scientific, environmental, regulatory, journalistic, historical, safety, or educational discussion may be allowed. Commercial sourcing or operational facilitation of a prohibited material is not.

### Escalation owner

Trust and Safety / Platform Operations, with Legal or Compliance escalation for regulated or jurisdiction-specific questions. Security or emergency routing applies when a credible immediate danger exists.

### Age/location dependency

Location-dependent and generally unsuitable for teen commerce.

### Evidence

Minimum record metadata, item/material claim, location context when available, associated report/evidence references, and transaction-facilitation indicators.

### Member notice basis

`Prohibited hazardous, environmental, wildlife, or biological commercial activity`.

### Appeal / exception

Ordinary household products, lawful plants/agricultural items, non-hazardous materials, scientific discussion, or misclassification may be reviewed. A specialized regulated program cannot be created through one-off appeal decisions.

## COM-05 Sexual exploitation, sexual services, trafficking, and coercive labor

### Definition

Commercial or recruitment activity involving sexual exploitation, sexual services, trafficking, grooming, coercive labor, exploitative recruitment, non-consensual intimate material, or any sexual exploitation of a minor.

### Canonical safety reasons

- `CHILD.SEXUAL_EXPLOITATION_MATERIAL`
- `CHILD.GROOMING`
- `CHILD.SEXUAL_SOLICITATION`
- `CHILD.SEXTORTION`
- `INTIMATE.NONCONSENSUAL_DISTRIBUTION`
- `INTIMATE.SEXTORTION`
- `FRAUD.EMPLOYMENT_SCAM` when deceptive recruitment is also present

### Module applicability

Jobs, Services, Requests, Marketplace, Businesses, Events, Rooms, Local, Appointments, private messages.

### Transaction boundary

News, prevention, survivor support, legal discussion, documentary, research, or educational context may be allowed when it does not facilitate exploitation. Commercial solicitation, recruitment, arrangement, payment, or facilitation of prohibited exploitation is not allowed.

### Escalation owner

Trust and Safety severe-harm process. Child-safety external reporting and emergency disclosure remain subject to the counsel-approved procedures prepared under Issues #667 and #674.

### Age/location dependency

Severe minor-safety sensitivity. No teen commercial participation under the current protected-commerce controls.

### Evidence

Use the restricted Trust and Safety case system and minimum-necessary evidence rules. Do not copy suspected illegal sexual material into ordinary commerce moderation notes or public GitHub records.

### Member notice basis

Use the narrowest safe, counsel-reviewed severe-harm notice. Do not expose victims, reporters, witnesses, investigative details, or protected evidence.

### Appeal / exception

No transactional exception for exploitation. Documentary, prevention, news, artistic, legal, or other non-facilitating context may require contextual review. Final external-reporting standards require qualified counsel.

## COM-06 Security, account access, personal data, malware, hacking, and surveillance abuse

### Definition

Commercial activity offering or requesting malware, phishing, credential theft, unauthorized account access, stolen data, hacking, unlawful surveillance, spyware, authentication bypass, account transfer where unauthorized, or services to compromise another system or person.

### Canonical safety reasons

- `SECURITY.PHISHING`
- `SECURITY.MALWARE`
- `SECURITY.CREDENTIAL_THEFT`
- `SECURITY.ACCOUNT_COMPROMISE`
- `SECURITY.UNAUTHORIZED_SURVEILLANCE`
- `SECURITY.EXPLOIT_OR_BYPASS`
- `GOODS.PERSONAL_DATA_OR_ACCOUNT_ACCESS`
- `PRIVACY.AUTHENTICATION_SECRET`
- `PRIVACY.UNAUTHORIZED_DIRECTORY_OR_EXPORT`

### Module applicability

Marketplace, Services, Requests, Jobs, Businesses, Rooms, private messages, Local.

### Transaction boundary

Defensive security research, authorized testing, education, news, responsible disclosure, and prevention content may be allowed when authorization and context are credible. Offering or requesting unauthorized access, malware deployment, credential theft, surveillance abuse, or account compromise is not.

### Escalation owner

Security + Trust and Safety. Legal/Compliance escalation where authorization or lawful testing claims are materially ambiguous.

### Age/location dependency

Not principally age-based; teen commerce remains blocked under current protected-commerce controls.

### Evidence

Preserve links, record identifiers, domain or file references already stored, hashes where available, relevant account and report history, but do not require administrators to download suspected malicious files unnecessarily.

### Member notice basis

`Malicious software, unauthorized access, credential, data, or surveillance abuse`.

### Appeal / exception

Authorized defensive work, security education, or responsible research may be reviewed. Assertions of authorization should be evaluated without collecting unnecessary secrets or credentials.

## COM-07 Gambling, financial schemes, investment promotions, and money-mule activity

### Definition

Commercial or recruitment activity involving unlawful or unsupported gambling, deceptive investment promotions, pyramid or Ponzi-style schemes, money-mule or reshipping activity, fraudulent payment instruments, unlicensed financial products, or materially misleading financial opportunities.

### Canonical safety reasons

- `FRAUD.INVESTMENT_OR_FINANCIAL_SCHEME`
- `FRAUD.MONEY_MULE_OR_RESHIPPING`
- `FRAUD.PAYMENT_SCAM`
- `JOBS.MONEY_MULE_OR_RESHIPPING`
- `SERVICE.DECEPTIVE_LEGAL_OR_FINANCIAL_CLAIM`

### Module applicability

Jobs, Services, Requests, Marketplace, Businesses, Events, Rooms, private messages, The Floor where commercial promotion is involved, and Local.

### Transaction boundary

Financial education, market discussion, news, investment analysis, lawful criticism, or non-transactional discussion is distinct from deceptive solicitation, unlicensed service claims, money movement, or fraudulent opportunity recruitment.

### Escalation owner

Platform Operations / Trust and Safety; Legal or Compliance for regulated financial activity; Security where account compromise is involved.

### Age/location dependency

High for gambling and regulated financial products. Teen commerce remains blocked. Location and licensing standards require qualified review.

### Evidence

Record claims, compensation or return claims, fee/payment instructions, destination links, business identity, associated messages and reports, duplicate or network indicators, and any relevant account enforcement history.

### Member notice basis

`Prohibited or deceptive gambling, financial, investment, or money-movement activity`.

### Appeal / exception

Legitimate educational discussion, licensed-provider claims, non-commercial analysis, or misclassification may be reviewed. Loombus should not infer licensing from profile language alone.

## COM-08 Government documents, public benefits, permits, licenses, and credentials

### Definition

Commercial activity involving government identification, benefits, permits, immigration records, official credentials, professional or education credentials, or services that forge, sell, alter, fabricate, or fraudulently obtain them.

### Canonical safety reasons

- `GOODS.GOVERNMENT_DOCUMENT_OR_BENEFIT`
- `SERVICE.FALSE_CREDENTIAL`
- `FRAUD.IMPERSONATION`
- `PRIVACY.GOVERNMENT_IDENTIFIER`

### Module applicability

Marketplace, Services, Requests, Jobs, Businesses, private messages.

### Transaction boundary

Education, legal assistance by appropriately authorized professionals, document-preparation discussion, news, or public-information guidance may be allowed. Forgery, sale, fraudulent procurement, impersonation, or deceptive credential claims are not.

### Escalation owner

Trust and Safety / Platform Operations; Legal/Compliance for regulated professional or government-process questions.

### Age/location dependency

Location and regulatory status may matter. Sensitive identifiers must not be collected unnecessarily.

### Evidence

Prefer metadata, claims, public verification references, and account records. Do not request full government IDs merely to prove that an abusive listing is abusive unless an approved verification process specifically requires it.

### Member notice basis

`Fraudulent or prohibited government, benefit, permit, license, or credential activity`.

### Appeal / exception

May consider lawful professional assistance, legitimate credential display, authorization to act for an organization, or misclassification. Any verification program must be separately defined.

## COM-09 Live animals, food, cosmetics, medical devices, and other conditionally allowed categories

### Definition

Categories that may be lawful in some contexts but require product-safety, welfare, health, age, licensing, shipping, storage, recall, or location controls that ordinary Loombus commerce may not reliably verify.

### Canonical safety reasons

- `GOODS.UNAPPROVED_LIVE_ANIMAL_OR_FOOD`
- `GOODS.RECALLED_OR_UNSAFE_PRODUCT`
- `GOODS.PRESCRIPTION_OR_REGULATED_MEDICAL`
- `FRAUD.PAYMENT_SCAM` where deceptive sale is present

### Module applicability

Marketplace, Businesses, Services, Requests, Events, Local, private messages.

### Current platform position

No category in this family becomes affirmatively approved merely because the taxonomy exists. Each high-risk category requires an explicit product and legal decision before Loombus represents it as supported.

### Escalation owner

Platform Operations / Trust and Safety; Legal/Compliance or other qualified specialist depending on category.

### Age/location dependency

Potentially high and category-specific.

### Evidence

Listing and claim metadata, condition/safety claims, seller/provider identity, location when relevant, and report history.

### Member notice basis

`Unsupported or conditionally allowed high-risk product category`.

### Appeal / exception

May be appropriate only where an approved category rule exists or the record was misclassified. Reviewers must not create a new regulated program through individual appeals.

## COM-10 Illegal, dangerous, or unsafe services

### Definition

Services or Requests involving unlawful, dangerous, exploitative, materially unsafe, or prohibited work, including violence, stalking, unlawful surveillance, illegal drug or weapon activity, evidence destruction, criminal facilitation, dangerous circumvention, or other work Loombus does not support.

### Canonical safety reasons

- `SERVICE.ILLEGAL_OR_DANGEROUS_WORK`
- `VIOLENCE.OPERATIONAL_FACILITATION`
- `SECURITY.EXPLOIT_OR_BYPASS`
- `ROOM.ILLEGAL_OR_SEVERE_HARM_PURPOSE` where Room operations are involved

### Module applicability

Services, Requests, Businesses, Jobs, Appointments, Rooms, Local, private messages.

### Transaction boundary

Discussion or education about a risky topic is not the same as offering, commissioning, scheduling, or arranging the prohibited work.

### Escalation owner

Trust and Safety / Platform Operations; severe-harm or security routing where applicable.

### Age/location dependency

Category-specific; teen protected-commerce restrictions remain in force.

### Evidence

Service/request record, scope, provider/requester identity, appointment/inquiry metadata, relevant messages or attachments by reference, and moderation history.

### Member notice basis

`Prohibited dangerous or unlawful service/request`.

### Appeal / exception

Misclassification, legitimate safety work, authorized security work, legal compliance work, or non-transactional discussion may require contextual review.

## COM-11 Professional credentials, licensing, and scope-of-practice integrity

### Definition

False, misleading, expired, out-of-scope, or unauthorized claims concerning professional licenses, certifications, degrees, insurance, memberships, clearances, regulated titles, professional authority, or the right to perform a regulated service.

### Canonical safety reasons

- `SERVICE.FALSE_CREDENTIAL`
- `SERVICE.UNLICENSED_OR_OUT_OF_SCOPE`
- `FRAUD.IMPERSONATION`
- `JOBS.FAKE_EMPLOYER_OR_AUTHORITY` where employment authority is implicated

### Module applicability

Services, Businesses, Jobs, Requests, Appointments, Local, profiles used for commercial representation, private messages.

### Transaction boundary

Members may discuss professions and credentials generally. A commercial provider or employer may not materially misrepresent qualifications or authority.

### Escalation owner

Platform Operations; Legal/Compliance or qualified professional-practice reviewer where the legal significance of a credential is uncertain.

### Age/location dependency

Often location-specific. Loombus does not imply universal credential verification unless a defined verification program exists.

### Evidence

Claimed credential type, jurisdiction, provider/employer identity, public or provided verification reference when appropriate, record history, and member-supplied correction evidence. Avoid collecting unnecessary sensitive documents.

### Member notice basis

`Misleading professional credential, license, or scope-of-practice claim`.

### Appeal / exception

Valid credential, lawful scope, corrected claim, title not legally restricted, or mistaken provider attribution may be relevant. Legal conclusions about licensing should be escalated when uncertain.

## COM-12 Employment integrity, discrimination, recruitment scams, and unsafe opportunities

### Definition

Jobs or recruiting conduct involving fake employers, nonexistent roles, application-fee scams, money-mule or reshipping activity, material compensation deception, unlawful discrimination, sensitive-data abuse, unsafe teen opportunities, fraudulent external destinations, trafficking, or stale/evasive job posting behavior.

### Canonical safety reasons

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

### Module applicability

Jobs, Businesses, Rooms, private messages, Services/Requests where a purported service is actually employment or recruitment.

### Transaction boundary

Employment discussion, career advice, labor-law discussion, criticism, or legitimate recruiting is allowed subject to applicable policy. Fraudulent, exploitative, discriminatory, or materially deceptive recruiting is not.

### Escalation owner

Platform Operations / Trust and Safety. Employment-law and protected-characteristic questions require qualified legal review where the conclusion is not straightforward from approved standards.

### Age/location dependency

High. Teen job eligibility remains blocked under the current protected-commerce implementation until separately approved age-aware job participation exists.

### Evidence

Job record, employer attribution, compensation and fee claims, destination link/domain, application instructions, report history, duplicate/stale signals, and relevant account/business records.

### Member notice basis

Use a narrow reason such as `Fake or misleading job`, `Recruitment or payment scam`, `Misleading compensation`, or another approved category. Discrimination notices should use counsel-reviewed wording.

### Appeal / exception

Employer authority, current availability, compensation clarification, lawful job requirement, corrected external destination, or duplicate/stale error may be reviewed. Legal discrimination exceptions cannot be invented ad hoc.

## COM-13 Commercial claims, pricing, fees, endorsements, testimonials, and AI representations

### Definition

Materially deceptive commercial representations concerning price, fees, compensation, results, availability, identity, sponsorship, endorsement, testimonial authenticity, portfolio, review manipulation, before-and-after depictions, or AI-generated media presented as real-world proof.

### Canonical safety reasons

- `SERVICE.DECEPTIVE_PRICE_OR_FEE`
- `SERVICE.FALSE_RESULT_OR_PORTFOLIO`
- `FRAUD.FALSE_TESTIMONIAL_OR_ENDORSEMENT`
- `AI_MEDIA.FALSE_COMMERCIAL_REPRESENTATION`
- `JOBS.MISLEADING_COMPENSATION`
- `INTEGRITY.FAKE_ENGAGEMENT`

### Module applicability

Marketplace, Businesses, Services, Jobs, Requests, Events, Appointments, Rooms, Local, profiles, private messages.

### Transaction boundary

Ordinary puffery, opinion, satire, or illustrative media should be distinguished from materially deceptive factual claims where reasonable members could be misled about the actual product, provider, price, outcome, identity, or transaction.

### Escalation owner

Platform Operations / Trust and Safety; Compliance/Legal for regulated advertising or professional claim questions.

### Age/location dependency

Usually not age-specific, but teen commerce remains blocked and some consumer-protection or professional advertising rules are location-specific.

### Evidence

Exact claim, price/fee field, image/media reference, provider/business identity, disclosure label, comparison to actual listing/service terms, associated complaints/reports, and modification history.

### Member notice basis

`Materially misleading commercial claim` with a narrower subreason where possible.

### Appeal / exception

Correction, substantiation, clear disclosure, illustrative context, or a genuine factual dispute may justify re-review. Reviewers should not require disclosure of confidential trade secrets beyond what is necessary.

## COM-14 Duplicate, evasive, manipulative, and off-platform transaction abuse

### Definition

Behavior intended to evade moderation, manipulate visibility, artificially increase engagement, duplicate removed or stale records, conceal common control, move prohibited transactions to another Loombus surface or private messages, or otherwise bypass a commercial restriction.

### Canonical safety reasons

- `INTEGRITY.DUPLICATE_OR_EVASIVE_REPOSTING`
- `INTEGRITY.SIGNAL_OR_RANKING_MANIPULATION`
- `INTEGRITY.FAKE_ENGAGEMENT`
- `INTEGRITY.BAN_OR_RESTRICTION_EVASION`
- `INTEGRITY.ACCOUNT_NETWORK`
- `ABUSE.REPORT_MISUSE` where retaliation/report abuse is involved

### Module applicability

All commercial/professional modules plus private messages and Rooms.

### Transaction boundary

Legitimate reposting, renewal, corrected records, recurring legitimate opportunities, or cross-posting that complies with product rules is not automatically abusive. Intent and pattern must not be inferred solely from similarity scores.

### Escalation owner

Platform Operations / Trust and Safety. Security may assist with coordinated account abuse where necessary.

### Age/location dependency

Not generally location-based.

### Evidence

Record IDs, timestamps, duplicate-match signals, account/business relationships already known to Loombus, prior actions, visibility manipulation indicators, and cross-module links. Automated similarity is an investigative signal, not proof.

### Member notice basis

`Duplicate, evasive, or manipulative commercial activity`.

### Appeal / exception

Legitimate renewal, separate inventory, independently operated business, corrected record, or mistaken duplicate linkage may be reviewed.

## COM-15 Sensitive-data, inquiry, appointment, and professional-intake abuse

### Definition

Commercial or professional collection, use, disclosure, or solicitation of sensitive information that is unnecessary, deceptive, insecure, unrelated to the stated transaction, or used to facilitate harassment, identity theft, surveillance, discrimination, or unauthorized marketing.

### Canonical safety reasons

- `SERVICE.PRIVACY_OR_INTAKE_ABUSE`
- `SERVICE.APPOINTMENT_OR_INQUIRY_MISUSE`
- `JOBS.SENSITIVE_INFORMATION_ABUSE`
- `PRIVACY.GOVERNMENT_IDENTIFIER`
- `PRIVACY.FINANCIAL_INFORMATION`
- `PRIVACY.AUTHENTICATION_SECRET`
- `PRIVACY.MEDICAL_OR_VULNERABILITY_INFORMATION`

### Module applicability

Services, Requests, Jobs, Appointments, Businesses, Marketplace, Rooms, Local, private messages.

### Transaction boundary

Legitimate intake may require some personal data, but collection should be proportionate to the stage and purpose. Passwords, authentication codes, complete financial credentials, and unrelated sensitive information are not ordinary intake requirements.

### Escalation owner

Privacy + Trust and Safety / Platform Operations. Security where credentials or account compromise are implicated. Legal/Compliance for regulated professional data requirements.

### Age/location dependency

Heightened for minors and regulated professional contexts.

### Evidence

The requested data category, stated purpose, collection channel, provider/employer identity, applicable record, and report context. Avoid reproducing the sensitive value itself in moderation notes where the category and reference are sufficient.

### Member notice basis

`Improper sensitive-data or professional-intake request`.

### Appeal / exception

A legitimate and proportionate collection need may be reviewed, but reviewers should verify the purpose without encouraging unnecessary disclosure of the data itself.

## 4. Module applicability matrix

Legend: `P` primary applicability, `S` secondary/applicable when conduct occurs through the module, `-` ordinarily not applicable.

| Category | Marketplace | Businesses | Services | Requests | Jobs | Events | Appointments | Rooms | Local | Messages |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| COM-01 Weapons/dangerous items | P | S | P | P | S | S | S | S | S | P |
| COM-02 Drugs/medicines/age-restricted | P | S | P | P | S | S | S | S | S | P |
| COM-03 Stolen/counterfeit/unsafe/IP | P | S | S | S | S | S | - | S | S | P |
| COM-04 Hazardous/environment/wildlife | P | S | P | P | S | S | S | S | S | P |
| COM-05 Exploitation/trafficking/coercive labor | S | S | P | P | P | S | S | P | S | P |
| COM-06 Security/data/malware/access abuse | P | S | P | P | P | S | S | S | S | P |
| COM-07 Gambling/financial schemes/mules | P | S | P | P | P | P | S | S | S | P |
| COM-08 Government docs/credentials | P | S | P | P | P | - | - | S | S | P |
| COM-09 Conditional high-risk products | P | P | S | S | - | S | - | S | P | S |
| COM-10 Illegal/dangerous services | S | S | P | P | P | S | P | P | S | P |
| COM-11 Professional credentials/licensing | S | P | P | S | P | S | P | S | P | S |
| COM-12 Employment integrity | - | S | S | S | P | S | - | S | S | P |
| COM-13 Claims/pricing/testimonials/AI | P | P | P | P | P | P | P | S | P | P |
| COM-14 Duplicate/evasive/manipulative abuse | P | P | P | P | P | P | S | S | P | P |
| COM-15 Sensitive-data/intake abuse | S | S | P | P | P | S | P | S | S | P |

## 5. Member-facing report mapping

The existing public report taxonomy should remain concise. Commerce records should map to one of the existing high-level report reasons where possible rather than exposing fifteen new first-level choices.

Recommended mapping:

- `R08 Scam, fraud, or impersonation`: COM-03 when fraudulent, COM-07, COM-08 when deceptive, COM-12 scams, COM-13, COM-14 where deceptive.
- `R10 Illegal or dangerous goods or services`: COM-01, COM-02, COM-04, COM-05 commercial exploitation, COM-09 unsupported high-risk goods, COM-10.
- `R12 Intellectual property`: COM-03 where infringement/counterfeit is the primary concern.
- `R14 Job, Service, Business, or professional claim`: COM-11, COM-12 non-fraud integrity, COM-13 professional/commercial claims, COM-15 professional intake.
- `R15 Account or security concern`: COM-06.
- `R02 Child safety`, `R03 Sexual exploitation or intimate imagery`, `R01 Threat or violence`, and `R07 Personal information or privacy abuse` should supersede the generic commerce label when severe safety is the primary concern.

## 6. Enforcement-reason mapping

Administrator enforcement should store the specific internal reason code rather than only the broad member-facing label.

Examples:

- prohibited firearm listing: `GOODS.WEAPON_OR_EXPLOSIVE`
- fake prescription sale: `GOODS.PRESCRIPTION_OR_REGULATED_MEDICAL`
- counterfeit handbag: `GOODS.COUNTERFEIT_OR_FORGED` plus `IP.COUNTERFEIT` when appropriate
- fake job requiring an application fee: `JOBS.APPLICATION_FEE_OR_PAYMENT_SCAM`
- deceptive provider license claim: `SERVICE.FALSE_CREDENTIAL`
- account-hacking service: `SECURITY.EXPLOIT_OR_BYPASS` plus `SERVICE.ILLEGAL_OR_DANGEROUS_WORK`
- repeatedly relisted removed item: `INTEGRITY.DUPLICATE_OR_EVASIVE_REPOSTING`
- fake AI-generated before/after portfolio: `AI_MEDIA.FALSE_COMMERCIAL_REPRESENTATION` plus `SERVICE.FALSE_RESULT_OR_PORTFOLIO`

The exact action remains separately recorded under the canonical enforcement-decision model.

## 7. Escalation model

### Platform Operations / Trust and Safety

Default owner for routine prohibited listings, Jobs, Services, Requests, Business records, Event commerce, and related reports.

### Trust and Safety severe-harm routing

Required when facts indicate child exploitation, trafficking, credible violence, stalking, intimate-image abuse, severe fraud, coercion, dangerous facilitation, or another S1-S3 severe-harm concern under the approved #667 operating model.

### Security

Required for malware, phishing, credential theft, account compromise, unauthorized surveillance, exploit/bypass activity, or related technical abuse.

### Privacy

Required when professional intake, application, inquiry, appointment, or transaction handling creates a material privacy question beyond routine moderation.

### Legal / Compliance

Required for uncertain legal classification, professional licensing, regulated financial activity, employment-law issues, jurisdiction conflicts, legally sensitive external reporting, or another matter that the approved policy explicitly routes to qualified review.

The taxonomy itself does not authorize external contact or disclosure.

## 8. Age and location controls

- Current teen-safety implementation blocks teen and unresolved-age accounts from protected commercial actions across Businesses, Jobs, Marketplace, Services, Requests, Events, Appointments, Local, and Room provisioning as applicable.
- This taxonomy does not weaken those controls.
- A category marked location-dependent must not be represented as permitted merely because one jurisdiction may allow it.
- Location-specific permission requires an approved product program, operating capability, and legal review.
- Age verification, licensing verification, shipping compliance, custody control, or regulated transaction handling must not be implied unless Loombus actually implements and verifies those capabilities.

## 9. Evidence and retention contract

Commerce moderation should follow these rules:

1. Preserve the minimum platform-native evidence necessary to review and document the decision.
2. Prefer record IDs, timestamps, account/business/provider identifiers, structured fields, hashes, and stored references over unnecessary copies.
3. Do not copy suspected illegal sexual material, malware, authentication secrets, full financial credentials, or unnecessary government identifiers into ordinary moderation notes.
4. Link severe-harm matters to the restricted Trust and Safety case system when escalation is required.
5. Link legal preservation to the approved Legal Operations process when an actual hold applies.
6. Retention and deletion follow the canonical #668 resource/disposition controls and any active legal hold. This taxonomy does not invent fixed retention periods.
7. Evidence interaction and consequential enforcement should remain auditable.

## 10. Member notice contract

Member-facing notices should:

- identify the affected record or feature;
- use a plain-language policy reason;
- identify the action taken;
- provide correction or appeal information where the canonical enforcement system supports it;
- avoid asserting criminal conduct or professional illegality unless the approved standard supports that statement;
- omit reporter identity, victim identity, protected evidence, security methods, legal-request details, or other sensitive internal information;
- use more restricted severe-harm wording when required for safety or legal reasons.

Proposed notice reason families:

- Prohibited or unsupported goods
- Dangerous or unlawful service/request
- Fraudulent or deceptive commercial activity
- Misleading professional credential or claim
- Job integrity or recruiting concern
- Security, credential, or data abuse
- Duplicate or evasive commercial activity
- Sensitive-data or intake misuse

Final public templates require the applicable policy, accessibility, privacy, safety, and legal review.

## 11. Appeals and exception contract

A commerce appeal may challenge:

- category misclassification;
- ownership or authorization;
- authenticity;
- credential or license status;
- lawful scope of professional activity;
- actual price, fee, compensation, or disclosure;
- duplicate or stale-record classification;
- whether the content was a transaction versus documentary/educational discussion;
- whether an approved category-specific exception applies.

Appeals must not:

- create a new regulated-program exception;
- require unnecessary secrets or highly sensitive identity data;
- treat a member's unsupported statement of legality or licensure as conclusive;
- automatically restore a record where another safety, legal-hold, account-standing, or product restriction independently prevents restoration.

The canonical platform enforcement and appeals system remains the authoritative appeal ledger.

## 12. Duplicate and evasive reposting contract

Duplicate detection may identify likely matches but must not independently establish intent.

A reviewer should distinguish:

- legitimate renewed inventory;
- corrected records;
- recurring legitimate Jobs or Events;
- separate inventory from the same seller;
- independently operated Businesses;
- actual evasion after removal or restriction.

When evasion is established, the primary integrity reason is `INTEGRITY.DUPLICATE_OR_EVASIVE_REPOSTING`, with the underlying prohibited category retained as a secondary reason.

## 13. Administrator-tool contract

The Platform Operations Center already supports Marketplace, Businesses, Jobs, Events, Requests, Services, Rooms, and Appointments through existing administrator-protected workflows. The next implementation phase should make those tools consume or map to this canonical taxonomy rather than maintaining isolated free-text reason vocabularies.

Required future technical properties:

- stable reason IDs;
- module-to-category allowlists;
- public report reason to internal reason mapping;
- consistent enforcement reason display;
- ability to retain multiple secondary reason codes;
- no automatic enforcement merely from taxonomy classification;
- audit history for reason changes;
- compatibility with existing enforcement decisions and appeals;
- no public exposure of sensitive internal subreasons that materially assist evasion.

## 14. Public-policy mapping

The following existing internal drafts should use this taxonomy as their commerce source of truth when they are later converted for publication:

- `09-fraud-spam-and-coordinated-manipulation.md`
- `10-illegal-and-regulated-goods.md`
- `18-marketplace-prohibited-items.md`
- `19-jobs-integrity-standard.md`
- `20-services-and-professional-claims-standard.md`

Related public Help/Policy documents may be stricter for a module, but the underlying category definitions and internal reason IDs should not silently conflict.

## 15. Counsel-review areas

Qualified review is still required before Loombus publishes or operationally represents jurisdiction-specific legal conclusions concerning, at minimum:

- weapons, ammunition, explosives, and defensive devices;
- controlled substances, prescription products, alcohol, nicotine, cannabis, and other age-restricted goods;
- gambling and regulated financial products;
- live animals, food, cosmetics, medical devices, hazardous or environmental goods;
- professional licensing and scope of practice;
- employment discrimination and child-labor restrictions;
- medical, legal, financial, immigration, tax, and other regulated professional claims;
- advertising, endorsements, testimonials, price/fee disclosures, and AI-generated commercial representations;
- consumer-protection requirements;
- jurisdiction-specific age, location, shipping, delivery, and transaction restrictions.

Counsel review should distinguish legal requirements from Loombus's independent product choice to prohibit a category it does not want to operationally support.

## 16. Current implementation state

This document is documentation-only.

It does not:

- change Marketplace, Jobs, Services, Requests, Businesses, Events, Appointments, Rooms, Local, or message behavior;
- change administrator permissions;
- create a new enforcement action;
- change teen-safety restrictions;
- change retention or deletion;
- create external reporting;
- change legal-request handling;
- publish a public policy;
- mark any regulated category legally approved.

The next phase should audit the exact production report/enforcement reason fields and Platform Operations actions, then add the narrowest shared technical reason-code contract necessary to map them to this taxonomy.