# Loombus Canonical Safety Taxonomy and Decision Model

Status: Internal specification  
Prepared: July 27, 2026  
Public release authorized: No  
Implementation authorized: Requires product and engineering review

## 1. Purpose

This specification provides one vocabulary for reports, moderation, enforcement, appeals, policy documents, administrator tools, analytics, and transparency reporting.

It is designed to prevent the first 20 policy drafts from drifting into separate definitions or incompatible enforcement systems.

The taxonomy is not itself a public Community Standards document. It is the internal source of truth from which public explanations and product reason codes should be generated.

## 2. Design rules

1. A member-facing report reason must be understandable without legal or moderation expertise.
2. An internal subreason may be more precise than the public category.
3. A reason code describes the policy concern. It does not automatically determine the action.
4. Severity is assessed separately from the reason category.
5. One event may involve multiple reason codes.
6. The primary reason should reflect the most safety-relevant or materially deceptive conduct.
7. Enforcement must record both the policy reason and the action actually taken.
8. Report resolution, content action, account action, Room action, and legal preservation are separate records.
9. Automated detection confidence is not severity and is not proof.
10. Public policy examples must not be treated as an exhaustive checklist.

## 3. Canonical entities

### Member

A person or authorized organizational representative using a Loombus account.

### Account

The authentication identity, account standing, preferences, profile relationship, and authorized access associated with a member.

### Minor

A person under 18 for child-safety and sexual-exploitation rules, regardless of a lower local age of consent.

### Teen

A member ages 13 through 17, subject to the final minimum-age and age-state contract.

### Content

A Discussion, Reply, profile field, message, attachment, Room item, listing, record, AI-assisted output, link, or other material submitted, displayed, transmitted, or generated through Loombus.

### Public content

Content accessible without membership or to the general Loombus audience under the relevant product contract. Public content may be eligible for external indexing, but public status does not guarantee indexing or recommendation.

### Member-only content

Content visible only after authentication but not limited to a specific relationship or Room membership.

### Restricted Discussion

A Discussion whose audience is limited by relationship, selection, custom membership, or owner-only access and whose related records must follow the same authorization contract.

### Private Room

A Room whose membership and role rules govern access. Private does not mean guaranteed secrecy or immunity from Loombus-wide safety, security, support, billing, or legal processing.

### Private message

A message accessible to the authorized conversation participants and permitted operational personnel under applicable product, safety, security, and legal rules.

### Report

A request for review of content, conduct, a person, a Room, a message, a listing, or another record. A report is not itself an enforcement decision.

### Report resolution

The recorded conclusion of a report review. Resolution may be no violation, violation found, escalated, duplicate, insufficient information, outside scope, or another approved result. Resolution does not automatically remove content or change access.

### Enforcement decision

A decision to warn, restrict, remove, suspend, restore, or otherwise alter content, account, Room, feature, distribution, or commercial eligibility because of a policy or integrity concern.

### Room-level action

An action taken by authorized Room staff under Room rules and permissions.

### Loombus-wide action

An action taken by Loombus under platform-wide standards, account standing, integrity controls, legal obligations, or product safety rules.

### Appeal

An authenticated request to review an eligible enforcement decision. An appeal is distinct from a report disagreement or a request for general support.

### Restoration

The reversal or modification of an enforcement effect, including content, account, Room, feature, Search, recommendation, or commercial eligibility where technically and legally possible.

## 4. Member-facing report categories

The member interface should present a concise first level. A second level may refine the concern.

| Code | Member-facing label | Typical examples |
|---|---|---|
| R01 | Threat or violence | credible threat, incitement, violent coordination, dangerous organization |
| R02 | Child safety | grooming, sexual solicitation, exploitative material, dangerous adult contact |
| R03 | Sexual exploitation or intimate imagery | non-consensual intimate media, sextortion, adult sexual coercion |
| R04 | Harassment or bullying | targeted abuse, stalking, repeated unwanted contact, coordinated harassment |
| R05 | Hate or dehumanizing conduct | protected-group attack, dehumanization, exclusion, hateful organization promotion |
| R06 | Suicide or self-harm concern | encouragement, instructions, coercion, imminent-risk expression |
| R07 | Personal information or privacy abuse | doxxing, precise location, credentials, private medical or financial data |
| R08 | Scam, fraud, or impersonation | phishing, fake identity, payment deception, false employer or provider |
| R09 | Spam or manipulation | mass promotion, fake engagement, coordinated reports, platform gaming |
| R10 | Illegal or dangerous goods or services | prohibited item, regulated transaction, unlawful service, trafficking |
| R11 | Misleading AI or manipulated media | deceptive synthetic identity, fabricated evidence, undisclosed material simulation |
| R12 | Intellectual property | copyright, trademark, counterfeit, unauthorized content or goods |
| R13 | Room governance or moderator conduct | retaliation, misuse of authority, rule conflict, privacy abuse |
| R14 | Job, Service, Business, or professional claim | false qualification, discrimination, misleading compensation, unsafe service |
| R15 | Account or security concern | account compromise, malicious link, credential theft, automation abuse |
| R16 | Other policy concern | concern not reasonably captured above |

The public interface should not expose internal categories that would meaningfully assist evasion or reveal sensitive detection methods.

## 5. Internal reason-code families

### ABUSE

- `ABUSE.TARGETED_DEGRADING`
- `ABUSE.REPEATED_UNWANTED_CONTACT`
- `ABUSE.COORDINATED_HARASSMENT`
- `ABUSE.STALKING`
- `ABUSE.SEXUAL_HARASSMENT`
- `ABUSE.RETALIATION`
- `ABUSE.REPORT_MISUSE`
- `ABUSE.BLOCK_OR_RESTRICTION_BYPASS`

### HATE

- `HATE.SLUR_OR_DEGRADING_LABEL`
- `HATE.DEHUMANIZATION`
- `HATE.INHERENT_INFERIORITY`
- `HATE.INHERENT_DANGEROUSNESS`
- `HATE.EXCLUSION_OR_SEGREGATION`
- `HATE.COLLECTIVE_PUNISHMENT`
- `HATE.HATE_ORGANIZATION_SUPPORT`
- `HATE.IDENTITY_TARGETED_HARASSMENT`

### VIOLENCE

- `VIOLENCE.CREDIBLE_THREAT`
- `VIOLENCE.INCITEMENT`
- `VIOLENCE.OPERATIONAL_FACILITATION`
- `VIOLENCE.TARGETING_INFORMATION`
- `VIOLENCE.GLORIFICATION`
- `VIOLENCE.GRAPHIC_ABUSE`
- `VIOLENCE.DANGEROUS_ORGANIZATION_RECRUITMENT`
- `VIOLENCE.DANGEROUS_ORGANIZATION_SUPPORT`
- `VIOLENCE.WEAPON_WRONGDOING`

### CHILD

- `CHILD.SEXUAL_EXPLOITATION_MATERIAL`
- `CHILD.GROOMING`
- `CHILD.SEXUAL_SOLICITATION`
- `CHILD.SEXTORTION`
- `CHILD.SEXUALIZATION`
- `CHILD.PHYSICAL_ABUSE`
- `CHILD.UNSAFE_ADULT_CONTACT`
- `CHILD.UNDERAGE_ACCOUNT`
- `CHILD.UNSAFE_ROOM_OPERATION`

### INTIMATE

- `INTIMATE.NONCONSENSUAL_DISTRIBUTION`
- `INTIMATE.THREATENED_DISTRIBUTION`
- `INTIMATE.VOYEURISTIC_MEDIA`
- `INTIMATE.SYNTHETIC_DEPICTION`
- `INTIMATE.SEXTORTION`
- `INTIMATE.DUPLICATE_OR_EXTERNAL_DIRECTION`

### SELF_HARM

- `SELF_HARM.ENCOURAGEMENT`
- `SELF_HARM.INSTRUCTION`
- `SELF_HARM.COERCION`
- `SELF_HARM.PACT_OR_CHALLENGE`
- `SELF_HARM.GRAPHIC_PROMOTION`
- `SELF_HARM.EATING_DISORDER_PROMOTION`
- `SELF_HARM.IMMINENT_RISK_SIGNAL`
- `SELF_HARM.HELP_SEEKING_CONTEXT`

`SELF_HARM.HELP_SEEKING_CONTEXT` is a safety-routing signal, not a violation reason by itself.

### PRIVACY

- `PRIVACY.HOME_OR_PRECISE_LOCATION`
- `PRIVACY.CONTACT_INFORMATION`
- `PRIVACY.GOVERNMENT_IDENTIFIER`
- `PRIVACY.FINANCIAL_INFORMATION`
- `PRIVACY.AUTHENTICATION_SECRET`
- `PRIVACY.MEDICAL_OR_VULNERABILITY_INFORMATION`
- `PRIVACY.MINOR_INFORMATION`
- `PRIVACY.REPORTER_OR_WITNESS_IDENTITY`
- `PRIVACY.UNAUTHORIZED_DIRECTORY_OR_EXPORT`
- `PRIVACY.HARMFUL_AGGREGATION`

### FRAUD

- `FRAUD.PAYMENT_SCAM`
- `FRAUD.INVESTMENT_OR_FINANCIAL_SCHEME`
- `FRAUD.EMPLOYMENT_SCAM`
- `FRAUD.ROMANCE_OR_RELATIONSHIP_SCAM`
- `FRAUD.CHARITY_OR_PRIZE_SCAM`
- `FRAUD.FAKE_SUPPORT_OR_BILLING`
- `FRAUD.IMPERSONATION`
- `FRAUD.STOLEN_PAYMENT_OR_ACCOUNT`
- `FRAUD.MONEY_MULE_OR_RESHIPPING`
- `FRAUD.FALSE_TESTIMONIAL_OR_ENDORSEMENT`

### INTEGRITY

- `INTEGRITY.SPAM`
- `INTEGRITY.KEYWORD_OR_TAG_MANIPULATION`
- `INTEGRITY.FAKE_ENGAGEMENT`
- `INTEGRITY.COORDINATED_REPORTING`
- `INTEGRITY.ACCOUNT_NETWORK`
- `INTEGRITY.SIGNAL_OR_RANKING_MANIPULATION`
- `INTEGRITY.DUPLICATE_OR_EVASIVE_REPOSTING`
- `INTEGRITY.AUTOMATION_ABUSE`
- `INTEGRITY.SCRAPING_OR_ACCESS_BYPASS`
- `INTEGRITY.BAN_OR_RESTRICTION_EVASION`

### GOODS

- `GOODS.WEAPON_OR_EXPLOSIVE`
- `GOODS.DRUG_OR_CONTROLLED_PRODUCT`
- `GOODS.PRESCRIPTION_OR_REGULATED_MEDICAL`
- `GOODS.AGE_RESTRICTED_PRODUCT`
- `GOODS.STOLEN_PROPERTY`
- `GOODS.COUNTERFEIT_OR_FORGED`
- `GOODS.HAZARDOUS_MATERIAL`
- `GOODS.WILDLIFE_OR_ENVIRONMENTAL_CONTRABAND`
- `GOODS.RECALLED_OR_UNSAFE_PRODUCT`
- `GOODS.PERSONAL_DATA_OR_ACCOUNT_ACCESS`
- `GOODS.GOVERNMENT_DOCUMENT_OR_BENEFIT`
- `GOODS.UNAPPROVED_LIVE_ANIMAL_OR_FOOD`

### SERVICE

- `SERVICE.ILLEGAL_OR_DANGEROUS_WORK`
- `SERVICE.FALSE_CREDENTIAL`
- `SERVICE.UNLICENSED_OR_OUT_OF_SCOPE`
- `SERVICE.DECEPTIVE_MEDICAL_CLAIM`
- `SERVICE.DECEPTIVE_LEGAL_OR_FINANCIAL_CLAIM`
- `SERVICE.UNSAFE_CARE_SERVICE`
- `SERVICE.DECEPTIVE_PRICE_OR_FEE`
- `SERVICE.FALSE_RESULT_OR_PORTFOLIO`
- `SERVICE.PRIVACY_OR_INTAKE_ABUSE`
- `SERVICE.APPOINTMENT_OR_INQUIRY_MISUSE`

### JOBS

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

### AI_MEDIA

- `AI_MEDIA.UNDISCLOSED_MATERIAL_SYNTHESIS`
- `AI_MEDIA.IMPERSONATION`
- `AI_MEDIA.FABRICATED_EVIDENCE`
- `AI_MEDIA.CIVIC_OR_EMERGENCY_DECEPTION`
- `AI_MEDIA.FALSE_COMMERCIAL_REPRESENTATION`
- `AI_MEDIA.NONCONSENSUAL_INTIMATE`
- `AI_MEDIA.CHILD_SEXUALIZATION`
- `AI_MEDIA.ENFORCEMENT_EVASION`

### ROOM

- `ROOM.MODERATOR_RETALIATION`
- `ROOM.CONFIDENTIALITY_BREACH`
- `ROOM.ROLE_OR_AUTHORITY_ABUSE`
- `ROOM.UNSAFE_MINOR_OPERATION`
- `ROOM.ILLEGAL_OR_SEVERE_HARM_PURPOSE`
- `ROOM.GOVERNANCE_DECEPTION`
- `ROOM.BILLING_OR_PLAN_MISREPRESENTATION`
- `ROOM.DELETION_OR_EVIDENCE_ABUSE`
- `ROOM.PLATFORM_REPORT_INTERFERENCE`

### SECURITY

- `SECURITY.PHISHING`
- `SECURITY.MALWARE`
- `SECURITY.CREDENTIAL_THEFT`
- `SECURITY.ACCOUNT_COMPROMISE`
- `SECURITY.UNAUTHORIZED_SURVEILLANCE`
- `SECURITY.EXPLOIT_OR_BYPASS`
- `SECURITY.SECRET_OR_SYSTEM_EXTRACTION`

### IP

- `IP.COPYRIGHT`
- `IP.TRADEMARK`
- `IP.COUNTERFEIT`
- `IP.REPEAT_INFRINGER`
- `IP.CIRCUMVENTION`

## 6. Context modifiers

A reason code should be accompanied by zero or more context modifiers.

| Code | Meaning |
|---|---|
| `CTX.DOCUMENTARY` | reporting or documenting events |
| `CTX.EDUCATIONAL` | teaching or explanatory use |
| `CTX.SCIENTIFIC` | research or technical analysis |
| `CTX.ARTISTIC` | artistic or fictional context |
| `CTX.JOURNALISTIC` | news or public-interest reporting |
| `CTX.HISTORICAL` | historical record or analysis |
| `CTX.LEGAL` | legal claim, evidence, or process |
| `CTX.COUNTERSPEECH` | condemning or exposing harmful conduct |
| `CTX.HELP_SEEKING` | seeking assistance or intervention |
| `CTX.PREVENTION` | safety or prevention guidance |
| `CTX.SATIRE_OR_PARODY` | reasonably understandable satire or parody |
| `CTX.SELF_REFERENCE` | member referring to their own identity or experience |
| `CTX.RECLAIMED_LANGUAGE` | in-group or reclaimed use requiring careful context |
| `CTX.PUBLIC_FIGURE` | target is a public figure or public official |
| `CTX.MINOR_TARGET` | target or depicted person is a minor |
| `CTX.VULNERABLE_TARGET` | target has a material vulnerability relevant to harm |
| `CTX.OFF_PLATFORM_RISK` | conduct occurred elsewhere but creates a substantial Loombus risk |

A context modifier does not automatically permit content. It changes the required analysis.

## 7. Severity model

### S0: No violation or informational concern

Use when:

- no policy violation is found;
- the content is allowed context;
- a safety concern requires resources or monitoring but not enforcement;
- the report is outside scope without misconduct.

Permitted outcomes:

- no action;
- resource or educational notice;
- report closure;
- referral to another route.

### S1: Low-severity or correctable concern

Characteristics:

- limited impact;
- no credible threat or exploitation;
- likely misunderstanding, formatting, relevance, or first low-level conduct concern;
- readily correctable.

Potential actions:

- education;
- revision request;
- warning without broad restriction;
- duplicate or metadata correction;
- narrow content action.

### S2: Material violation

Characteristics:

- clear policy violation with limited or moderate harm;
- repeated low-level conduct;
- misleading listing or spam affecting multiple members;
- privacy or harassment concern without severe escalation factors.

Potential actions:

- content removal;
- distribution restriction;
- feature restriction;
- account warning;
- temporary module restriction;
- Room-level or commercial-record action.

### S3: High-risk violation

Characteristics:

- targeted, repeated, coordinated, deceptive, exploitative, or materially unsafe conduct;
- significant privacy exposure;
- credible fraud pattern;
- serious harassment, hate, or dangerous facilitation;
- bypass of prior restrictions.

Potential actions:

- immediate removal;
- broad feature restriction;
- temporary suspension;
- Room or business restriction;
- specialist escalation;
- evidence preservation.

### S4: Severe violation

Characteristics:

- sexual exploitation;
- credible violence or stalking risk;
- child grooming or sextortion;
- non-consensual intimate imagery;
- dangerous-organization recruitment;
- severe coordinated fraud or doxxing;
- conduct likely to cause substantial physical, financial, or psychological harm.

Potential actions:

- immediate removal or containment;
- account suspension or permanent removal;
- Room or organization closure;
- legal, emergency, child-safety, or security escalation;
- preservation and restricted evidence access.

### S5: Critical or imminent-risk event

Characteristics:

- specific and credible imminent threat;
- active child sexual exploitation;
- ongoing sextortion or trafficking;
- active account compromise causing broad harm;
- urgent legal or emergency request meeting approved criteria;
- active platform use to coordinate severe harm.

Potential actions:

- immediate containment;
- expedited specialist and executive escalation;
- lawful emergency or child-safety disclosure under approved procedures;
- preservation hold;
- permanent action where justified;
- post-incident review.

Severity is not determined solely by the content category. A category can span multiple levels depending on context and risk.

## 8. Confidence model

Detection or review confidence must remain separate from severity.

| Code | Meaning |
|---|---|
| `C0` | unassessed or insufficient information |
| `C1` | weak signal; no adverse action without further review except temporary safety containment where authorized |
| `C2` | plausible concern; additional evidence or context required |
| `C3` | more likely than not based on available evidence |
| `C4` | strong evidence |
| `C5` | verified by direct evidence, authoritative source, or admitted conduct |

Automated systems should normally produce a signal and confidence assessment, not a final severity or legal conclusion.

## 9. Enforcement action codes

### Content and distribution

- `ACT.NONE`
- `ACT.EDUCATION`
- `ACT.REVISION_REQUIRED`
- `ACT.LABEL`
- `ACT.SENSITIVE_INTERSTITIAL`
- `ACT.AGE_RESTRICT`
- `ACT.RECOMMENDATION_EXCLUDE`
- `ACT.SEARCH_EXCLUDE`
- `ACT.FEATURED_SIGNAL_REMOVE`
- `ACT.CONTENT_HIDE`
- `ACT.CONTENT_REMOVE`
- `ACT.ATTACHMENT_DISABLE`
- `ACT.LINK_DISABLE`

Actions such as labels, age restrictions, and interstitials must not be used publicly until the product supports them on the named surface.

### Feature and account

- `ACT.REPLY_RESTRICT`
- `ACT.MESSAGE_RESTRICT`
- `ACT.FOLLOW_RESTRICT`
- `ACT.UPLOAD_RESTRICT`
- `ACT.REPORT_RESTRICT`
- `ACT.COMMERCE_RESTRICT`
- `ACT.ROOM_PRIVILEGE_RESTRICT`
- `ACT.AI_FEATURE_RESTRICT`
- `ACT.ACCOUNT_WARNING`
- `ACT.ACCOUNT_SUSPEND`
- `ACT.ACCOUNT_REMOVE_PERMANENT`

### Room and organization

- `ACT.ROOM_CONTENT_ACTION`
- `ACT.ROOM_MEMBER_REMOVE`
- `ACT.ROOM_MEMBER_BAN`
- `ACT.ROOM_ROLE_REMOVE`
- `ACT.ROOM_RESTRICT`
- `ACT.ROOM_SUSPEND`
- `ACT.ROOM_CLOSE`
- `ACT.ORGANIZATION_RESTRICT`

### Commercial records

- `ACT.RECORD_CHANGES_REQUIRED`
- `ACT.RECORD_SUSPEND`
- `ACT.RECORD_ARCHIVE`
- `ACT.RECORD_REMOVE`
- `ACT.BUSINESS_RESTRICT`

### Safety, security, and legal

- `ACT.SAFETY_ESCALATE`
- `ACT.SECURITY_ESCALATE`
- `ACT.LEGAL_REVIEW`
- `ACT.PRESERVATION_HOLD`
- `ACT.LAWFUL_DISCLOSURE`
- `ACT.EMERGENCY_DISCLOSURE`

## 10. Report resolution codes

- `RES.NO_VIOLATION`
- `RES.VIOLATION_FOUND`
- `RES.CONTEXT_ALLOWED`
- `RES.INSUFFICIENT_INFORMATION`
- `RES.DUPLICATE_REPORT`
- `RES.OUTSIDE_SCOPE`
- `RES.SOURCE_UNAVAILABLE`
- `RES.REPORTER_WITHDREW`
- `RES.ESCALATED_SAFETY`
- `RES.ESCALATED_SECURITY`
- `RES.ESCALATED_LEGAL`
- `RES.ROOM_LEVEL_RESOLUTION`
- `RES.PENDING_EXTERNAL_PROCESS`

A resolution record should link to separate action records rather than implying that `VIOLATION_FOUND` removed content automatically.

## 11. Appeal eligibility model

### Eligibility states

- `APL.ELIGIBLE`
- `APL.ELIGIBLE_AFTER_ACTION`
- `APL.NOT_ELIGIBLE`
- `APL.LEGAL_RESTRICTION`
- `APL.IDENTITY_OR_AUTHORITY_REQUIRED`
- `APL.DEADLINE_PASSED`
- `APL.DUPLICATE_WITHOUT_NEW_INFORMATION`
- `APL.SYSTEM_NOT_SUPPORTED`

### Appeal states

- `APL.SUBMITTED`
- `APL.NEEDS_INFORMATION`
- `APL.QUEUED`
- `APL.UNDER_REVIEW`
- `APL.SPECIALIST_REVIEW`
- `APL.LEGAL_REVIEW`
- `APL.DECIDED`
- `APL.CLOSED`

### Appeal outcomes

- `APL.OUTCOME_UPHELD`
- `APL.OUTCOME_MODIFIED`
- `APL.OUTCOME_REVERSED`
- `APL.OUTCOME_REMANDED`
- `APL.OUTCOME_UNABLE_TO_REVIEW`

## 12. Notice contract

Every member-facing enforcement notice should contain the fields supported by the decision:

- decision ID;
- decision date;
- affected account, content, Room, feature, or record;
- public reason family;
- plain-language explanation;
- policy document and version;
- action taken;
- action scope;
- start date;
- end date or condition, if applicable;
- appeal eligibility;
- appeal route and deadline, if applicable;
- immediate billing, export, safety, or access instructions where relevant;
- contact route for technical problems.

The notice must not expose:

- reporter identity;
- victim or witness details;
- confidential Room report information;
- security-sensitive detection methods;
- illegal sexual material;
- information that materially enables evasion;
- protected legal-request details.

## 13. Decision record contract

A canonical enforcement record should include:

- `decision_id`;
- `subject_account_id`, where applicable;
- affected object type and ID;
- source report or detection IDs;
- primary reason code;
- secondary reason codes;
- context modifiers;
- severity;
- confidence;
- policy document ID and version;
- action codes;
- action parameters and duration;
- evidence references;
- reviewer and approver roles;
- created, effective, expiration, and resolved timestamps;
- notice status;
- appeal eligibility and deadline;
- appeal ID and outcome;
- restoration status;
- legal hold status;
- confidentiality classification;
- audit history.

## 14. Restoration states

- `RST.NOT_APPLICABLE`
- `RST.PENDING`
- `RST.COMPLETED`
- `RST.PARTIAL`
- `RST.BLOCKED_LEGAL`
- `RST.BLOCKED_TECHNICAL`
- `RST.SOURCE_NO_LONGER_EXISTS`
- `RST.INDEPENDENT_RESTRICTION_REMAINS`

A reversed decision does not require removing valid independent safety, fraud, billing, security, or legal restrictions.

## 15. Room moderation mapping

Room moderation must preserve these distinctions:

1. A member reports Room content or conduct.
2. A Room moderator reviews and records a resolution.
3. The moderator may separately remove content, remove a member, ban a member, change a role, or take no action.
4. Severe or Loombus-wide concerns are escalated to Loombus.
5. Loombus may make an independent platform-wide decision.
6. A Room-level review path, when offered, is distinct from a Loombus-wide appeal.

The product and public Room Code should never use “resolved” as a synonym for “removed” or “enforced.”

## 16. Public policy mapping

| Draft | Primary reason families |
|---|---|
| Community Standards Overview | all families |
| Harassment and Bullying | ABUSE, PRIVACY, HATE |
| Hate and Dehumanizing Conduct | HATE, ABUSE, VIOLENCE |
| Threats, Violence, and Dangerous Organizations | VIOLENCE, SECURITY, GOODS |
| Child Safety and Sexual Exploitation | CHILD, INTIMATE, VIOLENCE, PRIVACY |
| Non-consensual Intimate Imagery | INTIMATE, CHILD, ABUSE, PRIVACY |
| Suicide and Self-Harm | SELF_HARM, ABUSE |
| Doxxing and Personal Information | PRIVACY, ABUSE, SECURITY |
| Fraud, Spam, and Coordinated Manipulation | FRAUD, INTEGRITY, SECURITY |
| Illegal and Regulated Goods | GOODS, SERVICE, FRAUD |
| AI-Generated and Manipulated Media | AI_MEDIA plus underlying harm family |
| Enforcement and Appeals Policy | all reason, action, resolution, appeal, restoration families |
| Reporting Guide | member-facing R01–R16 |
| Room Owner and Moderator Code | ROOM plus underlying harm family |
| Teen Safety Overview | CHILD, ABUSE, PRIVACY, SELF_HARM, JOBS, SERVICE |
| AI and Automated Systems Notice | AI_MEDIA, INTEGRITY, SECURITY, automated-decision metadata |
| Public Content and Search Indexing | PRIVACY, INTEGRITY, AI_MEDIA |
| Marketplace Prohibited Items | GOODS, FRAUD, INTEGRITY, IP |
| Jobs Integrity Standard | JOBS, FRAUD, ABUSE, PRIVACY |
| Services and Professional Claims | SERVICE, FRAUD, PRIVACY, CHILD |

## 17. Governance

Changes to this taxonomy require review by:

- Trust and Safety;
- Product owners for affected modules;
- Engineering for data and action compatibility;
- Privacy and Security for evidence and retention effects;
- Support for member-facing language;
- Legal where definitions affect legal or regulated categories;
- Accessibility for public reason labels and notices.

A reason code must not be removed from historical records. It may be deprecated and mapped to a replacement while preserving the original policy version.

## 18. Implementation gate

This specification should not be wired directly into production until:

- existing report and action schemas are inventoried;
- migration and compatibility behavior is designed;
- administrator interfaces can distinguish report, resolution, and action;
- notices and appeals have the required privacy controls;
- analytics cannot expose sensitive case details;
- the P0 issues are assigned and sequenced;
- legal review approves high-risk categories and protected-characteristic handling.
