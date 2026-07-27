# Loombus Policy Publication-Readiness Review

Status: Internal review and delivery-control document  
Prepared: July 27, 2026  
Applies to: The 20 internal drafts merged through PR #664  
Public release authorized: No

## 1. Executive conclusion

The first Loombus safety and governance package is structurally strong, internally original, and substantially deeper than the current public policy surface. It is not yet ready to publish.

The review found no reason to discard or restart the package. The correct next step is to preserve the drafts as the target policy system, close the product and operating gaps they identify, normalize terminology and decision rules, then publish in controlled waves.

No draft should be moved from `public_ready: false` until its material statements can be supported by:

1. a production product contract;
2. a documented operating procedure;
3. a named accountable owner;
4. an approved data-retention and access rule;
5. an accessible member-facing route or control where the policy refers to one;
6. qualified legal review where the statement creates legal, contractual, youth, privacy, employment, commerce, intellectual-property, emergency, or regulated-activity obligations.

## 2. What the review validated

The package consistently reflects Loombus rather than copying another platform. Its strongest original characteristics are:

- signal over noise as the organizing product purpose;
- meaningful protection for disagreement, evidence, documentary context, counterspeech, research, and help-seeking;
- a clear distinction between criticism and targeted abuse;
- recognition that private spaces remain subject to platform-wide safety rules;
- separate treatment of Room owner authority and Loombus authority;
- recognition that report resolution is not automatically content or membership enforcement;
- explicit limitations on AI accuracy, neutrality, professional reliability, and verification;
- careful boundaries around Search, Local, private Rooms, restricted Discussions, and external indexing;
- detailed treatment of Marketplace, Jobs, Services, professional claims, and commercial deception;
- refusal to claim universal appeals, age verification, malware scanning, emergency response, professional verification, transaction protection, or private restricted media before those capabilities exist.

These are the correct foundations for the public system.

## 3. Publication status

### Current package status

| Measure | Result |
|---|---|
| Draft documents reviewed | 20 |
| Public-ready documents | 0 |
| Documents requiring legal review | 20 |
| Documents with material engineering dependencies | 13 |
| Documents with material operations dependencies | 16 |
| Documents with material privacy or retention dependencies | 14 |
| Documents that may become first-wave candidates after blocker closure | 8 |
| Documents that must remain blocked until major product work completes | 12 |

Zero public-ready documents does not mean the drafting failed. It means the drafts correctly expose operational and technical work that a serious policy system requires.

## 4. Tracked publication blockers

The review converted the load-bearing blockers into repository issues.

| ID | Priority | Requirement | Blocks |
|---|---|---|---|
| #665 | P0 | Platform-wide enforcement history and appeals | Enforcement, Reporting, Community overview, Room governance, most standards |
| #666 | P0 | Teen privacy defaults and age-aware interactions | Teen Safety, Child Safety, Jobs, Services, Rooms with minors |
| #667 | P0 | Trust and Safety escalation operations | Threats, Child Safety, intimate imagery, self-harm, doxxing, Reporting |
| #668 | P0 | Platform-wide data retention and deletion schedule | Privacy, Search, AI, Reporting, Rooms, viewer records, account deletion |
| #669 | P0 | AI provider, model, prompt, and data-flow inventory | AI Notice, Search AI, recommendations, Signal, automated safety statements |
| #670 | P1 | Canonical commerce and professional-integrity taxonomy | Regulated goods, Marketplace, Jobs, Services, Requests, Events, Businesses |
| #671 | P1 | Versioned policy content system and archive | Every public policy and Help article |
| #672 | P1 | Private attachments for restricted Discussions | Restricted-media privacy claims |
| #673 | P1 | File security scanning posture | Attachment, Room file, message file, and harmful-file claims |
| #674 | P1 | Legal request, preservation, and emergency disclosure operations | Law-enforcement, emergency, preservation, transparency, deletion exceptions |

### Dependency rule

A linked issue does not have to be closed merely because code exists. It should be closed only when:

- the product behavior is deployed;
- production configuration is verified;
- operations and ownership are documented;
- member-facing behavior is tested;
- the relevant draft is revised to match the implemented contract;
- the required reviewers approve the claim.

## 5. Cross-document findings

### 5.1 Terminology is strong but not yet canonical

The drafts use the same general concepts, but the public system needs one controlled vocabulary. The following terms must have one definition across policies, code, administrator tools, and notices:

- member;
- account;
- minor;
- teen;
- public content;
- member-only content;
- restricted Discussion;
- private Room;
- private message;
- Room owner;
- Room administrator;
- Room moderator;
- report;
- safety escalation;
- enforcement decision;
- Room-level action;
- Loombus-wide action;
- warning;
- content restriction;
- distribution restriction;
- feature restriction;
- suspension;
- permanent removal;
- appeal;
- restoration;
- synthetic media;
- personal information;
- dangerous organization;
- prohibited item;
- professional claim;
- public-interest context.

The companion taxonomy document defines the proposed canonical language.

### 5.2 The drafts correctly reject a universal strike system

The package consistently recognizes that severe child exploitation, credible threats, stalking, coordinated fraud, low-level incivility, and an inaccurate listing cannot use one identical ladder.

The public system should use severity, risk, history, intent, reach, coordination, and restorability rather than a fixed three-strike model.

### 5.3 Appeals language is the largest consistency risk

Many drafts correctly state that a universal appeals process is not yet verified. Before publication, each document must use one of three approved formulations:

- `Review available`: a specific implemented review path exists for this decision.
- `Review may be available`: eligibility depends on the action and the member notice identifies the route.
- `No general review promise`: the current feature does not support a published review right.

No public document should state or imply that every report outcome, content removal, Room action, listing decision, account action, or legal removal can be appealed until #665 is complete.

### 5.4 “May take action” needs a capability check

The drafts list labels, recommendation limits, age restrictions, content removal, feature restrictions, account actions, Room actions, preservation, and lawful disclosures.

For public release, each action must be classified as:

- implemented across the stated surface;
- implemented only in named modules;
- operationally available but manual;
- target behavior not yet implemented.

A policy must not present a target action as routine current behavior.

### 5.5 Severe-harm context exceptions are appropriately narrow

The package permits documentary, educational, scientific, artistic, journalistic, historical, legal, counterspeech, prevention, and help-seeking contexts. The exception is not automatic.

The final public language should preserve three tests:

1. the context is genuine and understandable;
2. the harmful material is no broader or more graphic than necessary;
3. the content does not recruit, facilitate, praise, target, or materially increase risk.

### 5.6 Private does not mean secret

The Room, Search, privacy, and personal-information drafts consistently recognize that access control does not prevent recipients from copying content or require Loombus to ignore safety, security, legal, billing, or support needs.

The public system should use the following distinction:

- `Access-controlled`: Loombus limits access according to product rules.
- `Confidential`: a specific organizational or legal duty may apply.
- `Secret or guaranteed undisclosed`: Loombus should not promise this.

### 5.7 Teen protection is a target system, not a current complete contract

The Teen Safety draft proposes strong defaults. Those defaults cannot be described as current until #666 is deployed and verified.

Current public wording, before that work is complete, must distinguish:

- baseline controls available to all members;
- current teen-specific protections that are verified;
- planned teen defaults not yet active;
- report and blocking tools;
- the fact that Loombus does not verify every member's age.

### 5.8 AI transparency needs provider evidence, not general language

The AI drafts correctly avoid claiming accuracy or neutrality. The remaining risk is data-flow specificity.

Before public release, #669 must answer, feature by feature:

- which provider and model are used;
- which content categories are sent;
- whether restricted, Room, message, draft, attachment, or saved content is included;
- whether prompts or outputs are retained;
- whether provider training is disabled by contract and configuration;
- whether a person can contest a high-impact automated decision;
- whether the system acts automatically or only creates a review signal.

### 5.9 Commerce rules need one source of truth

The Illegal and Regulated Goods, Marketplace, Jobs, Services, Fraud, and AI-media drafts overlap intentionally. They must not maintain separate incompatible lists.

#670 should become the authoritative taxonomy. Public documents should reference it and add only module-specific restrictions or explanations.

### 5.10 Retention language must remain qualitative until the register exists

The drafts correctly avoid unsupported timelines. Until #668 is complete, public documents may explain categories and exceptions but should not state exact deletion or retention periods unless verified for the full data flow, including backups and vendors.

## 6. Required edits before any public conversion

The internal drafts may remain as written while blockers are open. When a document enters public conversion, apply these controls:

1. Remove the internal drafting notice.
2. Replace `should`, `target`, `proposed`, and `publication blocker` language with verified current behavior or an explicit limitation.
3. Replace implementation notes with member-facing explanations.
4. Confirm every named report, setting, page, and appeal route exists.
5. Confirm every enforcement action listed is supported for that surface.
6. Confirm every privacy statement matches RLS, Storage, server checks, caches, Search, notifications, AI, and administrator access.
7. Use the canonical definitions and reason families.
8. Add effective date, version, owner, review date, and superseded-version metadata.
9. Add related policy and Help links only after the linked content exists.
10. Add emergency language that directs immediate danger to local emergency services without promising Loombus dispatch or continuous monitoring.
11. Avoid guaranteeing identity, credentials, ownership, safety, authenticity, professional quality, transaction completion, refunds, chargebacks, or legal outcomes.
12. Obtain all required approvals and record them.

## 7. Publication waves

### Wave 0: Internal infrastructure

No public policy conversion.

Required work:

- canonical definitions and decision model;
- issue ownership;
- production verification templates;
- policy content model;
- legal-review plan;
- retention and AI inventories.

### Wave 1: Core conduct standards

Potential candidates after their blockers close:

- Community Standards Overview;
- Harassment and Bullying;
- Hate and Dehumanizing Conduct;
- Doxxing and Personal Information;
- Fraud, Spam, and Coordinated Manipulation;
- AI-Generated and Manipulated Media;
- Reporting Guide;
- Room Owner and Moderator Code.

Wave 1 is not authorized yet. It depends at minimum on #665, #667, relevant portions of #668, and legal review.

### Wave 2: Severe-harm and youth standards

- Threats, Violence, and Dangerous Organizations;
- Child Safety and Sexual Exploitation;
- Non-consensual Intimate Imagery;
- Suicide and Self-Harm;
- Teen Safety Overview.

Wave 2 depends on #666, #667, #674, specialist review, and verified reporting and evidence procedures.

### Wave 3: AI, Search, and data transparency

- AI and Automated Systems Notice;
- Public Content and Search Indexing Policy;
- future Privacy Policy and retention supplements.

Wave 3 depends on #668, #669, Search production verification, vendor review, and privacy counsel.

### Wave 4: Commerce integrity

- Illegal and Regulated Goods;
- Marketplace Prohibited Items;
- Jobs Integrity Standard;
- Services and Professional Claims Standard.

Wave 4 depends on #670, module enforcement mapping, member notices, appeals, and commerce, employment, advertising, and professional-practice legal review.

### Wave 5: Legal and contractual corpus

Terms, Privacy, subscription terms, Room terms, organization terms, refund terms, intellectual-property policies, law-enforcement guidelines, and regional notices should follow after the current behavioral system has stable definitions and verified product dependencies.

## 8. First-wave authorization criteria

The first public wave may begin only when:

- the canonical terminology and reason-code model is approved;
- all Wave 1 report surfaces are verified;
- member notices do not expose reporter or victim identity;
- enforcement actions listed in the drafts are mapped to actual capabilities;
- appeal language matches the implemented system;
- retention language is approved for reports, evidence, viewer records, and enforcement data;
- Room role and moderation behavior is production-verified;
- legal, safety, privacy, product, engineering, support, and accessibility reviewers are named;
- the versioned content system can prevent internal drafts from publishing accidentally.

## 9. Ownership model

| Area | Accountable owner |
|---|---|
| Community Standards | Trust and Safety |
| Severe harm | Trust and Safety with specialist and legal support |
| Teen Safety | Child-safety, Privacy, Product, and Legal |
| Enforcement and appeals | Trust and Safety, Product, and Engineering |
| Reporting | Trust and Safety and Support |
| Rooms governance | Rooms Product and Trust and Safety |
| AI transparency | AI Product, Privacy, Security, and Trust and Safety |
| Search and indexing | Search Product and Privacy |
| Marketplace | Marketplace Product, Fraud, and Trust and Safety |
| Jobs | Jobs Product, Trust and Safety, and Employment Legal |
| Services | Services Product, Trust and Safety, and Professional/Advertising Legal |
| Retention and deletion | Privacy, Security, Engineering, and Legal |
| Legal requests | Legal, Privacy, Security, and designated operations personnel |
| Accessibility | Accessibility owner for every public document and route |
| Final public approval | Executive owner after all required gates pass |

## 10. Definition of publication-ready

A document is publication-ready only when:

- every statement describes verified present behavior or an explicit current limitation;
- every member action in the document has a working route;
- every enforcement action is technically and operationally available;
- every data statement maps to the retention and vendor registers;
- every legal obligation has qualified review;
- examples are original, representative, and not overbroad;
- the document uses canonical terms and reason families;
- accessibility and mobile review pass;
- effective date, version, owner, review date, and archive metadata are complete;
- unresolved conditions are either closed or disclosed without misleading the member;
- an evidence packet exists showing how the material claims were verified.

## 11. Immediate next work

The policy program should now proceed in this order:

1. approve the canonical taxonomy, severity model, report reasons, enforcement reasons, notices, and appeal states;
2. assign owners to issues #665 through #674;
3. build the production-verification evidence templates;
4. begin P0 engineering and operations work;
5. prepare the second internal drafting package for Privacy, Terms, subscriptions, retention, intellectual property, and regional notices without publishing it;
6. start public conversion only after the first-wave authorization criteria are met.
