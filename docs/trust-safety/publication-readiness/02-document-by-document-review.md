# Loombus First Policy Package: Document-by-Document Readiness Review

Status: Internal review  
Prepared: July 27, 2026  
Applies to: `docs/trust-safety/drafts/01` through `20`  
Public release authorized: No

## Review method

Each draft was assessed for:

- fidelity to current Loombus features;
- consistency with the other drafts;
- reliance on unimplemented product behavior;
- reliance on undefined operations or staffing;
- privacy, retention, and vendor dependencies;
- legal-review intensity;
- suitability for an early public release wave.

Readiness labels:

- **Foundation ready:** the policy structure and substantive direction are sound.
- **Product verification required:** a current capability must be confirmed in production.
- **Engineering blocker:** a material capability does not yet exist consistently.
- **Operations blocker:** the policy depends on staffing, escalation, evidence, or support procedures.
- **Legal blocker:** qualified legal review is required before publication.
- **Public conversion candidate:** may enter member-facing editing after named blockers close.

## 1. Community Standards Overview

**Foundation status:** Ready.  
**Public status:** Blocked.  
**Potential release:** Wave 1.

### Strengths

- establishes signal over noise without turning the standards into civility-only rules;
- protects direct disagreement and criticism;
- gives Rooms additional authority without allowing them to override Loombus-wide rules;
- correctly separates report submission from guaranteed removal;
- uses proportionality rather than a fixed strike ladder;
- identifies public, restricted, private, commercial, and AI-enabled surfaces.

### Required revisions before public conversion

- replace the current list of possible actions with only actions verified for the relevant surfaces;
- link every category to an effective public standard;
- state the current appeal contract after #665;
- replace broad legal or emergency referral language with the process verified through #667 and #674;
- add an explicit explanation that private content remains subject to safety review while access remains limited;
- align “minor,” “teen,” “member,” “restricted,” and “private” with the canonical definitions.

### Blockers

- #665 enforcement and appeals;
- #667 Trust and Safety operations;
- #668 retention for reports and enforcement data;
- #671 content system and archive;
- legal, accessibility, product, and safety approval.

## 2. Harassment and Bullying

**Foundation status:** Ready.  
**Public status:** Blocked.  
**Potential release:** Wave 1.

### Strengths

- distinguishes criticism from intimidation;
- covers coordinated harassment, stalking, sexual harassment, block bypass, and moderator retaliation;
- allows public-figure criticism while retaining threat, privacy, and exploitation protections;
- considers patterns rather than isolated phrases;
- includes commerce and Room-system misuse.

### Consistency corrections

- use `targeted degrading abuse` as the internal category and plain `targeted harassment` publicly;
- ensure stalking involving precise location also maps to the Doxxing standard;
- use one term for repeated contact after blocking or denial: `restriction bypass`;
- avoid implying that every Room rule dispute receives Loombus review;
- define whether “one-time unwanted contact” is allowed only when it stops after a clear boundary and does not independently violate another policy.

### Product and operations checks

- verify block behavior across profiles, People, Search, Discussions, viewer lists, follows, messages, and Rooms;
- verify report targets for person, Discussion, Reply, message, and Room activity;
- define repeated-contact and stalking escalation;
- define reporter confidentiality and evidence retention.

### Blockers

- #665;
- #667;
- relevant portions of #668;
- legal review of off-platform conduct, stalking, public-figure context, and employment or service retaliation.

## 3. Hate and Dehumanizing Conduct

**Foundation status:** Ready.  
**Public status:** Blocked.  
**Potential release:** Wave 1.

### Strengths

- focuses on protected-group dehumanization, inferiority, dangerousness, exclusion, and collective punishment;
- permits criticism of ideologies, religions, governments, institutions, and policies;
- handles reclaimed language, quotation, counterspeech, coded language, and satire contextually;
- recognizes overlap with harassment and violence.

### Required decisions

- approve the final protected-characteristic list;
- decide how age, immigration status, veteran status, caste, serious medical condition, and perceived or associated characteristics are treated;
- define the dangerous-organization relationship between hate and violence policies;
- determine whether unlawful discriminatory commerce or employment activity is enforced under Hate, Jobs, Services, or multiple reason codes;
- create reviewer guidance for coded language and quoted material.

### Publication caution

The draft currently says protected characteristics “should include.” The public version must use a final definitive list and state that applicable law may require additional protections.

### Blockers

- #665;
- #667 for severe hate escalation;
- canonical taxonomy approval;
- qualified civil-rights, speech, employment, and platform-policy legal review.

## 4. Threats, Violence, and Dangerous Organizations

**Foundation status:** Ready.  
**Public status:** Major operations blocker.  
**Potential release:** Wave 2.

### Strengths

- separates threat assessment from vague anger;
- covers incitement, operational facilitation, targeting information, violent glorification, dangerous organizations, weapons, and graphic content;
- preserves documentary, journalistic, human-rights, historical, and prevention context;
- correctly warns against promising continuous monitoring or emergency dispatch.

### Required decisions

- define dangerous organizations and the review authority;
- decide whether external legal designations are determinative, evidentiary, or one factor;
- define imminent-risk criteria and emergency escalation;
- define graphic-content actions that actually exist, such as removal, preview suppression, or recommendation exclusion;
- define preservation and lawful disclosure procedures;
- distinguish general weapons discussion from prohibited commerce and violent facilitation.

### Blockers

- #667;
- #674;
- #665 for notices and review;
- #670 for weapons commerce consistency;
- specialist threat, civil-liberties, and legal review.

## 5. Child Safety and Sexual Exploitation

**Foundation status:** Strong and appropriately strict.  
**Public status:** Critical operations and legal blocker.  
**Potential release:** Wave 2.

### Strengths

- treats anyone under 18 as a minor for sexual-exploitation rules;
- covers real, altered, AI-generated, linked, requested, traded, or threatened material;
- identifies grooming patterns and Room-specific risks;
- discourages members from copying or publicly investigating harmful material;
- correctly avoids claiming universal age verification;
- requires least-access evidence handling and specialized review.

### Required decisions

- confirm the platform minimum age separately from the under-18 sexual-exploitation definition;
- establish the legally required child-safety reporting process;
- assign trained reviewers and backups;
- define evidence access, preservation, external reporting, and deletion;
- implement underage-account reporting and age correction;
- define adult-to-teen contact protections;
- define safe Room operation involving minors;
- define what member notice can be provided without compromising victims or legal duties.

### Blockers

- #666;
- #667;
- #668;
- #674;
- #665 where review is legally and safely available;
- specialized child-safety and privacy counsel.

## 6. Non-consensual Intimate Imagery

**Foundation status:** Ready.  
**Public status:** Critical report and evidence blocker.  
**Potential release:** Wave 2.

### Strengths

- uses distribution-specific consent rather than assuming creation consent equals publication consent;
- covers synthetic intimate depictions, voyeurism, sextortion, external links, and organized sharing;
- recognizes that material involving a minor belongs under the stricter child-safety standard;
- proposes a victim-centered, low-burden reporting process;
- correctly limits claims about exact-media fingerprinting.

### Required decisions

- create an expedited report route;
- define authorized representative handling;
- define identity confirmation without unnecessary collection;
- define temporary containment during review;
- define duplicate-location handling and external-link treatment;
- define evidence preservation and reviewer access;
- align synthetic intimate material with AI-media reason codes;
- define member notice and appeal language.

### Blockers

- #667;
- #668;
- #665;
- #669 where automated detection is described;
- intimate-image and privacy legal review.

## 7. Suicide and Self-Harm

**Foundation status:** Ready.  
**Public status:** Specialist operations blocker.  
**Potential release:** Wave 2.

### Strengths

- protects help-seeking, recovery, medical, journalistic, artistic, and policy discussion;
- targets encouragement, instructions, coercion, pacts, graphic promotion, and eating-disorder promotion;
- rejects punishment solely for expressing distress;
- avoids claiming clinical assessment or emergency response;
- includes teen and recommendation concerns.

### Required decisions

- choose crisis-resource presentation by region and device;
- define imminent-risk escalation and documentation;
- define whether Loombus contacts a member and under which authority;
- define automated-signal limitations;
- determine which recommendation, preview, or sensitive-content controls exist;
- train reviewers to distinguish help-seeking from harmful facilitation;
- define privacy and retention for highly sensitive reports.

### Blockers

- #667;
- #668;
- #669 for automated systems;
- #666 for teen-specific treatment;
- medical, mental-health, privacy, and legal review.

## 8. Doxxing and Personal Information

**Foundation status:** Ready.  
**Public status:** Blocked.  
**Potential release:** Wave 1.

### Strengths

- recognizes harmful aggregation even when some facts are public;
- covers location, credentials, medical, financial, minor, witness, and report information;
- handles Local, Rooms, commerce, and member-directory misuse;
- accurately distinguishes discoverability, private accounts, and direct links;
- avoids promising total deletion or invisibility.

### Required decisions

- approve the canonical personal-information taxonomy;
- define public-interest handling for public records and public officials;
- verify Local does not return stored coordinates;
- verify Room directories, support cases, join requests, forms, and reports have correct access;
- define representative review and emergency requests;
- define redaction, notice, retention, and restoration.

### Blockers

- #668;
- #665;
- #667 for stalking and urgent exposure;
- privacy and legal review.

## 9. Fraud, Spam, and Coordinated Manipulation

**Foundation status:** Ready.  
**Public status:** Blocked.  
**Potential release:** Wave 1.

### Strengths

- combines fraud, spam, fake engagement, coordinated reporting, account networks, automation, impersonation, and commercial disclosure;
- distinguishes permitted pseudonyms and parody from material identity deception;
- accurately limits duplicate detection to operational similarity rather than plagiarism or ownership;
- covers Search, Signal, Rooms, commerce, messaging, and account access.

### Required decisions

- define canonical fraud, integrity, impersonation, and security reasons;
- identify which automated signals only route review and which trigger temporary containment;
- define account-network and coordinated-manipulation evidence standards;
- define commercial sponsorship and referral disclosure requirements;
- define payment and fraud support escalation;
- align repeat violations with account standing and ban-evasion controls.

### Blockers

- #665;
- #670 for commerce mapping;
- #669 for automated detection disclosures;
- fraud, payments, privacy, and legal review.

## 10. Illegal and Regulated Goods

**Foundation status:** Ready as a platform baseline.  
**Public status:** Canonical-taxonomy blocker.  
**Potential release:** Wave 4.

### Strengths

- distinguishes discussion from transaction;
- permits stricter Loombus rules where jurisdictional verification is impractical;
- covers goods and unlawful services;
- recognizes age, licensing, location, custody, and regulatory limitations;
- avoids pretending Loombus can authenticate every transaction.

### Required decisions

- complete #670 and treat it as the source of truth;
- decide final rules for alcohol, nicotine, cannabis, knives, fireworks, defensive tools, live animals, food, cosmetics, medical devices, vehicles, tickets, financial products, and high-risk industrial equipment;
- define jurisdiction-sensitive exceptions, if any;
- define age-verification requirements and whether Loombus will offer any regulated program;
- define evidence, escalation, relisting, and appeals.

### Blockers

- #670;
- #665;
- #668 for records;
- regulatory, commerce, wildlife, health, weapons, and financial legal review.

## 11. AI-Generated and Manipulated Media

**Foundation status:** Ready.  
**Public status:** Product-disclosure blocker.  
**Potential release:** Wave 1 or Wave 3 depending on labeling capabilities.

### Strengths

- does not prohibit AI merely because AI was used;
- focuses on material deception, impersonation, fabricated evidence, sexual exploitation, civic harm, and commercial misrepresentation;
- preserves satire, art, accessibility, simulation, and disclosed illustration;
- correctly says detection results are signals rather than proof;
- covers commercial records and professional claims.

### Required decisions

- define when disclosure is mandatory;
- implement or verify disclosure controls;
- decide whether Loombus applies labels or only removes deceptive material;
- define high-risk civic and emergency cases;
- align synthetic intimate and child material with severe-harm policies;
- define provider-independent member obligations;
- verify appeal handling for satire, authorized use, and mistaken identity.

### Blockers

- #669;
- #665;
- relevant implementation through #671;
- AI, speech, intellectual-property, privacy, and legal review.

## 12. Enforcement and Appeals Policy

**Foundation status:** Strong target contract.  
**Public status:** Fully blocked by product implementation.  
**Potential release:** After #665, likely Wave 1 infrastructure.

### Strengths

- separates detection, decision, notice, appeal, outcome, and restoration;
- defines multiple proportional actions rather than one ladder;
- protects reporter, victim, security, and legal confidentiality;
- recognizes Room-level versus Loombus-wide decisions;
- defines upheld, modified, reversed, remanded, and unable-to-review outcomes;
- includes restoration and exception handling.

### Required product work

Everything in #665 is load-bearing. The public version must be generated from the implemented decision schema and routes, not from the aspirational target alone.

### Additional required decisions

- appeal deadlines by action family;
- whether report outcomes can be re-reviewed separately from enforcement appeals;
- reviewer independence rules;
- handling of deleted or expired source content;
- billing and export access during suspension;
- legal and emergency exceptions;
- repeat or abusive appeals;
- restoration of Search and recommendation state.

### Blockers

- #665;
- #668;
- #671;
- legal, privacy, safety, product, engineering, support, and accessibility review.

## 13. Reporting Guide

**Foundation status:** Ready.  
**Public status:** Report-inventory blocker.  
**Potential release:** Wave 1.

### Strengths

- explains the difference between reporting a content item and a person;
- discourages public investigation, mass reporting, and duplication;
- distinguishes Room and Loombus reporting;
- avoids promises of removal, refunds, legal action, or emergency response;
- provides appropriate severe-harm and privacy cautions.

### Required production verification

- inventory every live report button and API;
- confirm report targets and categories;
- confirm status and receipt behavior;
- confirm Room versus platform routing;
- confirm member, reporter, and reported-person notices;
- confirm outcome visibility;
- confirm support versus conduct-report boundaries;
- confirm attachment and evidence handling.

### Blockers

- #665;
- #667;
- #668;
- #670 for module report categories;
- #671 for public routing;
- legal and accessibility review.

## 14. Room Owner and Moderator Code

**Foundation status:** Ready.  
**Public status:** Verification and minors blocker.  
**Potential release:** Wave 1.

### Strengths

- assigns duties alongside authority;
- preserves the difference between Room rules and Loombus-wide standards;
- accurately states that resolving a report is not automatic removal;
- covers ownership transfer, billing, support-case isolation, evidence, retention, archive, deletion, organization controls, and minors;
- prevents Room leaders from promising verification Loombus does not provide.

### Required production verification

- exact role and permission matrix;
- which roles may see reports, evidence, cases, files, member data, billing, and audit history;
- separate action routes after report resolution;
- ownership transfer and eligibility;
- organization administration boundaries;
- Room archive, recovery, billing, retention hold, legal hold, and deletion states;
- Customer Support case isolation;
- member notice and review behavior.

### Blockers

- #665;
- #666 for minors;
- #668;
- #674 for holds and legal requests;
- Rooms product, privacy, safety, billing, legal, and accessibility review.

## 15. Teen Safety Overview

**Foundation status:** Strong target system.  
**Public status:** Fully blocked by product and legal work.  
**Potential release:** Wave 2.

### Strengths

- prioritizes privacy by default rather than surveillance;
- preserves age-appropriate independence;
- proposes clear follower, message, discovery, Discussion, location, recommendation, commerce, and Room protections;
- treats turning 18 as a controlled transition rather than automatic exposure;
- limits identity and age-data collection;
- avoids representing Loombus as a verified guardian or school system.

### Required product and legal work

Everything in #666 is load-bearing. In addition:

- decide whether the product can reliably know teen status;
- define age-state correction and disputes;
- define parental or guardian requests;
- define local-law differences;
- define teen data export and deletion;
- define recommended-content treatment;
- define teen commercial participation;
- define adult-to-teen contact exceptions for legitimate family, education, work, or support relationships.

### Blockers

- #666;
- #667;
- #668;
- #669;
- #674;
- specialized youth, privacy, product, accessibility, and legal review.

## 16. AI and Automated Systems Notice

**Foundation status:** Ready as an inventory template.  
**Public status:** Fully blocked by data-flow verification.  
**Potential release:** Wave 3.

### Strengths

- inventories Loombus-specific AI, Search, Signal, matching, duplicate, and moderation systems;
- separates deterministic automation from generative AI;
- avoids claims of truth, neutrality, professional advice, or verification;
- identifies private-content, provider, retention, training, human-review, and contesting questions;
- limits duplicate and fingerprinting claims correctly.

### Required work

Everything in #669 is load-bearing. Also:

- verify external-web use, if any, by feature;
- verify citations and grounded-source selection;
- document Signal inputs and exclusions;
- document paid-plan effects, if any;
- define teen treatment;
- identify every fully automated adverse decision;
- align member correction routes with #665.

### Blockers

- #669;
- #665;
- #668;
- #671;
- privacy, security, AI, safety, product, and legal review.

## 17. Public Content and Search Indexing Policy

**Foundation status:** Ready.  
**Public status:** Production and retention blocker.  
**Potential release:** Wave 3.

### Strengths

- clearly separates public, member-only, restricted, private Room, private message, and saved content;
- treats source records as authoritative over derived indexes;
- accurately distinguishes private account and discoverability;
- explains dynamic relationship audiences;
- gives realistic external search-engine limitations;
- covers Local approximate location and grounded AI boundaries.

### Required production verification

- all indexed source types;
- authentication and permission filtering;
- person discoverability and block behavior;
- restricted Discussion exclusion from Search, AI, metrics, and notifications;
- private Room and support-case exclusion;
- sitemap, robots, canonical, and external indexing behavior;
- stale and orphan repair;
- Search, query, click, AI, and index retention;
- current public attachment limitation.

### Blockers

- #668;
- #669;
- #671;
- #672 for future restricted media claims;
- Search, privacy, AI, SEO, and legal review.

## 18. Marketplace Prohibited Items

**Foundation status:** Strong category draft.  
**Public status:** Taxonomy and operations blocker.  
**Potential release:** Wave 4.

### Strengths

- uses a conservative baseline for categories Loombus cannot verify safely;
- covers weapons, drugs, exploitation, stolen and counterfeit goods, data and accounts, hazardous items, financial products, government privileges, and animals;
- includes AI-generated listing-media deception;
- makes transaction-safety limitations explicit;
- does not imply escrow, authenticity, refunds, or payment protection.

### Required decisions

- complete #670;
- decide conditionally allowed categories;
- define listing moderation and relisting prevention;
- define whether businesses receive different eligibility;
- define recall, counterfeit, ownership, animal-welfare, food-safety, and high-value fraud procedures;
- define notices and appeal evidence;
- verify all Marketplace lifecycle and report controls.

### Blockers

- #670;
- #665;
- #668;
- Marketplace, fraud, consumer, regulatory, and legal review.

## 19. Jobs Integrity Standard

**Foundation status:** Ready.  
**Public status:** Taxonomy, teen, and employment-law blocker.  
**Potential release:** Wave 4.

### Strengths

- covers employer authority, role accuracy, compensation, fees, remote-work scams, privacy, external applications, discrimination, teens, lifecycle, and applicant misconduct;
- correctly says administrator approval is not employer or Job verification;
- avoids promising refunds, hiring outcomes, or background checks;
- recognizes external-application privacy boundaries.

### Required decisions

- confirm employer attribution and publication requirements;
- define compensation and fee fields;
- define discrimination review and legal escalation;
- define teen eligibility and contact;
- define external-link warnings and malicious-destination handling;
- define application-data storage and retention;
- define Job close, expire, reopen, and duplicate behavior;
- define administrator reasons, notices, and appeals.

### Blockers

- #666;
- #670;
- #665;
- #668;
- employment, privacy, anti-discrimination, youth-work, fraud, and legal review.

## 20. Services and Professional Claims Standard

**Foundation status:** Ready.  
**Public status:** Taxonomy and professional-law blocker.  
**Potential release:** Wave 4.

### Strengths

- covers identity, authority, licensing, credentials, medical, legal, financial, home-improvement, care work, pricing, testimonials, Requests, inquiries, Appointments, and member responsibilities;
- accurately separates Loombus subscription billing from member-provider payments;
- warns against claiming Loombus verification;
- includes AI-generated portfolios and results;
- addresses vulnerable people and sensitive intake data.

### Required decisions

- complete #670;
- decide which high-risk service categories are prohibited, allowed, or permitted only under a verified program;
- define credential-display and verification language;
- map inquiry, Request, Appointment, Business, and external payment flows;
- define sensitive-data minimization and retention;
- define medical, legal, financial, care, construction, transportation, and other licensed-profession rules;
- define administrator reasons, notices, and appeals.

### Blockers

- #670;
- #666 for teen and care contexts;
- #665;
- #668;
- professional advertising, licensing, privacy, consumer, safety, and legal review.

## Cross-document contradiction register

The review found no fatal contradiction. The following points require one canonical decision before public conversion.

| Topic | Draft tension | Required resolution |
|---|---|---|
| Appeals | most drafts describe a target but no universal current right | implement #665 and use one eligibility model |
| Age restrictions | some drafts list age restriction as a possible action | publish only where the product supports it |
| Labels and interstitials | some drafts propose context or warning labels | map each label to an implemented surface |
| Dangerous organizations | Hate and Violence both address support | use Violence as primary, Hate as secondary where identity-based |
| Synthetic intimate imagery | NCII, Child Safety, and AI Media overlap | use INTIMATE or CHILD as primary harm, AI_MEDIA as method modifier |
| Doxxing and stalking | Harassment and Privacy overlap | use VIOLENCE or ABUSE for pursuit, PRIVACY for exposed data |
| Fraud and professional claims | Fraud, Jobs, Services, and Marketplace overlap | use module reason as primary when record-specific, FRAUD as secondary |
| Private content | private Rooms and messages remain safety-reviewable | define access-controlled, not secret |
| Room report resolution | resolution can be mistaken for enforcement | keep separate report, action, and appeal records |
| Exact media fingerprints | could be mistaken for perceptual or copyright detection | state exact stored-byte scope only |
| Duplicate detection | could be mistaken for plagiarism or fraud proof | state operational similarity only |
| External search removal | source deletion could be mistaken for immediate web removal | disclose external cache and crawler delay |
| Teen defaults | proposed controls could be mistaken for live controls | block public release until #666 or state only verified basics |
| Malware | file validation could be mistaken for security scanning | resolve #673 and disclose exact posture |
| Legal and emergency disclosure | reserved authority could be mistaken for staffed service | resolve #674 and avoid response-time promises |

## Recommended review order

1. Approve the canonical taxonomy and definitions.
2. Assign owners to #665 through #674.
3. Verify the current reporting and enforcement data model.
4. Verify Room role, report, action, audit, retention, and deletion behavior.
5. Complete the retention and AI inventories.
6. Decide teen product requirements.
7. Decide commerce taxonomy.
8. Build the versioned content system.
9. Perform product and operational redlines on Wave 1 documents.
10. Obtain legal and accessibility review.
11. Publish no document until the complete Wave 1 approval packet is signed.
