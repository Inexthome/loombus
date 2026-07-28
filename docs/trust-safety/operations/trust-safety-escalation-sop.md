# Trust and Safety Escalation Standard Operating Procedure

Status: internal operating draft
Prepared: July 28, 2026
Owner: Internal Trust and Safety Lead
Tracks: Issue #667
Public ready: no
Legal review: required

## 1. Purpose

This internal procedure defines how Loombus receives, classifies, contains, preserves, reviews, documents, escalates, and closes safety reports that may involve severe harm.

It is not a public policy, does not create a guaranteed response time, and does not represent Loombus as an emergency service. Public-facing documents must refer only to `Loombus Trust and Safety` or the `Trust and Safety Lead`. They must not identify individual internal owners.

## 2. Current operating limitations

- Primary ownership is assigned to the internal Trust and Safety Lead.
- The backup Trust and Safety role is vacant.
- Business-hours coverage currently depends on the primary owner.
- After-hours monitoring is not continuous.
- Loombus does not provide emergency dispatch.
- Loombus does not guarantee a response time.
- Qualified legal review is incomplete.
- Platform-wide retention and deletion periods remain dependent on Issue #668.
- Legal-request, preservation-request, and emergency-disclosure operations remain dependent on Issue #674.

These limitations must remain visible in internal training and truthful in any public help language.

## 3. Intake and specialist routing

| Purpose | Internal or public route |
|---|---|
| Urgent safety, abuse, threats, account compromise, and severe-harm reports | `security@loombus.com` |
| Privacy complaints, data access, correction, and deletion concerns | `privacy@loombus.com` |
| Formal legal requests and law-enforcement correspondence | `legal@loombus.com` |
| Regulatory, policy-compliance, and internal governance matters | `compliance@loombus.com` |
| Routine support and standard moderation questions | `support@loombus.com` |

A report received through the wrong route should be transferred internally using the minimum information required. The original receipt time and transfer must be recorded.

## 4. Severity model

### S1: Critical

Examples include:

- a credible, specific, and imminent threat to life or physical safety;
- a child who may be in immediate danger;
- apparent child sexual exploitation, online enticement, child trafficking, or sextortion involving a minor;
- active stalking or doxxing with an immediate real-world threat;
- an ongoing compromise of a high-risk account.

Required handling when observed during staffed operations:

1. prioritize the report immediately;
2. restrict access to content or accounts when technically safe and necessary to prevent further harm;
3. preserve minimum-necessary platform evidence and relevant audit history;
4. limit evidence access to authorized personnel;
5. direct a person needing immediate police, fire, or medical assistance to local emergency services;
6. route child-safety, emergency-disclosure, and legally sensitive questions through the legally reviewed process once approved;
7. avoid amateur investigation and unnecessary repeated access to traumatic material.

### S2: High

Examples include:

- serious but not clearly imminent threats;
- adult sextortion or non-consensual intimate imagery;
- persistent stalking, dangerous doxxing, or trafficking indicators;
- dangerous-organization recruitment;
- coordinated fraud or account compromise with significant harm.

Required handling:

1. prioritize above the routine queue;
2. preserve necessary evidence;
3. apply temporary restrictions when necessary and authorized to prevent further harm;
4. route to the Trust and Safety Lead for a documented decision;
5. escalate legal, privacy, security, or executive questions to the appropriate qualified specialist when available.

### S3: Elevated

Examples include:

- targeted harassment;
- impersonation;
- non-imminent personal-information exposure;
- repeated fraud or manipulation;
- serious Room moderation failures;
- repeated policy violations.

Required handling:

1. review during staffed operations;
2. remove or restrict violating material when supported by evidence and product authority;
3. record the reason, action, affected resource, and reviewer role;
4. raise the case to S2 when credible real-world harm becomes apparent.

### S4: Standard

Examples include:

- spam;
- ordinary abusive language;
- low-risk misinformation reports;
- routine moderation disputes;
- general support or policy questions.

Required handling:

1. process through the ordinary moderation or support queue;
2. preserve only evidence required by the approved retention schedule;
3. raise severity when new information increases risk.

## 5. Decision authority

- S1 through S3 require a documented decision by the internal Trust and Safety Lead unless an approved automated or emergency containment control applies.
- S4 may be handled through authorized routine moderation controls.
- Room owners and moderators may resolve ordinary Room-rule matters but must escalate severe-harm concerns to Loombus.
- Room owners and moderators may not independently investigate or access protected severe-harm evidence.
- A second qualified reviewer should be required for consequential S1 and S2 decisions once the backup role is filled and trained.

## 6. Case workflow

### Step 1: Receive and identify

- assign a unique case ID in the format `TS-YYYY-NNNN`;
- record receipt time, intake route, report target, category, initial severity, and status;
- use platform identifiers rather than unnecessary personal information;
- do not place case evidence, private messages, identities, or investigative notes in public GitHub issues.

### Step 2: Triage

Separate:

- what the reporter alleged;
- what Loombus directly observed;
- what remains unverified;
- what inference is being considered;
- whether the report involves a minor, immediate danger, intimate material, doxxing, trafficking, dangerous organizations, fraud, account compromise, or self-harm.

Raise severity whenever credible new information increases the risk.

### Step 3: Contain

When technically supported and proportionate, containment may include:

- disabling or removing content or attachments;
- temporarily limiting uploads, messages, discovery, recommendations, Room access, or commercial records;
- restricting or suspending an account;
- restricting or closing a Room or associated record;
- preventing further access to harmful material while review continues.

Containment is not a substitute for a documented final decision.

### Step 4: Preserve

Before removal or restriction, preserve the minimum platform-native evidence needed for review and documentation, which may include:

- database record identifiers;
- original timestamps;
- account, content, message, Room, listing, or transaction IDs;
- internal paths or relevant URLs;
- report text;
- moderation and account-standing history;
- audit and access logs;
- existing file hashes and storage references;
- actions already taken.

Do not create unnecessary copies. Do not download or redistribute suspected illegal sexual material. Do not store evidence in personal email, personal devices, ordinary chat, public documents, or public GitHub issues.

### Step 5: Review and decide

The decision record must state:

- severity and category;
- reported risk;
- evidence reviewed;
- observed facts;
- unresolved facts;
- reviewer inference, if any;
- immediate restrictions;
- final or interim decision;
- rationale and proportionality;
- external escalation status;
- member-notice decision;
- preservation status;
- reviewer role and timestamp;
- required follow-up.

### Step 6: External escalation

No external-reporting, emergency-disclosure, legal-hold, delayed-notice, or law-enforcement promise is approved by this SOP alone.

Until qualified legal review and Issue #674 are complete:

- preserve relevant identifiers and system records using the minimum-necessary standard;
- route formal legal or law-enforcement correspondence to `legal@loombus.com`;
- route privacy questions to `privacy@loombus.com`;
- document the referral without placing sensitive evidence in GitHub;
- do not represent an unreviewed legal assumption as a mandatory disclosure rule.

### Step 7: Notify

- protect reporter, victim, and witness information on a need-to-know basis;
- do not disclose reporter identity to the reported person unless disclosure is necessary, lawful, and approved;
- give a reported member enough information to understand an enforcement reason when safety and law permit, without providing raw reports, private evidence, or confidential identities;
- delay or limit notice when notice could increase danger, compromise evidence, facilitate retaliation, or conflict with lawful instructions;
- do not promise a particular outcome, appeal, response time, refund, or legal action unless the applicable system actually provides it.

### Step 8: Close or continue preservation

A case may close only after:

- immediate risk has been addressed;
- required restrictions are applied;
- evidence references and access history are complete;
- external referrals and notice decisions are documented;
- follow-up tasks have owners;
- no preservation request, legal hold, safety exception, fraud exception, billing exception, or dispute exception requires the record to remain active.

No fixed case-retention period is approved until Issue #668 establishes the canonical retention register.

## 7. Category playbooks

### Credible threats and imminent danger

- assess target specificity, means, timing, location, intent, context, and relevant history;
- prioritize specific or imminent indicators;
- preserve the relevant account, content, and audit identifiers;
- do not promise monitoring, intervention, dispatch, or a response deadline;
- direct immediate real-world emergencies to local emergency services.

### Child safety and sexual exploitation

- treat apparent sexual exploitation of a minor as S1;
- restrict access when technically safe and authorized;
- minimize viewing and copying;
- preserve identifiers, timestamps, hashes, storage references, account relationships, and relevant audit history;
- do not ask a reporter or affected minor to repost or redistribute harmful material;
- limit handling to trained, authorized personnel;
- use only a qualified, legally reviewed external-reporting procedure;
- do not state that a specific external report is legally required until counsel has approved the applicable process.

### Non-consensual intimate imagery and sextortion

- prioritize threats, coercion, extortion, a minor, or immediate physical danger;
- avoid requiring the affected person to resend intimate material unnecessarily;
- restrict access during urgent review where authorized;
- preserve existing platform references without creating unnecessary copies;
- avoid notifying the reported person before containment when notice could increase retaliation risk;
- route identity-verification, representative authorization, and legal questions through approved procedures.

### Stalking, doxxing, trafficking, and dangerous organizations

- distinguish ordinary disagreement from repeated targeting, location exposure, coercive control, recruitment, operational assistance, or credible real-world danger;
- preserve the narrow evidence needed to establish pattern and context;
- remove unnecessary exposure of addresses, schedules, schools, workplaces, contact information, or victim identities where authorized;
- route material-support, trafficking, designation, and disclosure questions for qualified legal review.

### Fraud and account security

- preserve account, login, listing, message, payment-reference, and audit identifiers available to Loombus;
- do not request passwords, full payment-card numbers, or unnecessary government identifiers;
- contain active account compromise where technically supported;
- route technical incident questions to `security@loombus.com` and formal legal requests to `legal@loombus.com`.

### Suicide and self-harm

- distinguish help-seeking from coercion, encouragement, instructions, organized harm, or targeted abuse;
- do not punish a person solely for expressing distress or seeking help;
- raise cases with specific intent, plan, means, time, place, or farewell indicators;
- do not claim clinical assessment, crisis-service status, continuous monitoring, or emergency dispatch;
- crisis-resource language, regional presentation, emergency disclosure, and teen-specific treatment require medical, privacy, and legal review before publication.

## 8. Confidentiality and access control

- reporter identities are not disclosed to reported members, Room owners, moderators, or unauthorized staff;
- victim and witness information is shared only on a documented need-to-know basis;
- Loombus may describe confidential handling but must not promise absolute anonymity;
- reported members may receive the policy reason and affected resource without receiving confidential reporter details;
- every access to sensitive evidence must be auditable;
- downloads, screenshots, forwarding, and local copies are prohibited unless specifically necessary, authorized, and logged;
- authorized access is limited to the Trust and Safety Lead, an appointed and trained backup, qualified legal counsel when required, and an authorized security specialist when technically necessary;
- public materials identify only `Loombus Trust and Safety` and approved role titles.

## 9. Reviewer wellness and traumatic-content safeguards

- review only the minimum content necessary to classify and decide the case;
- prefer metadata, hashes, text descriptions, and system records over repeated visual review;
- do not require unnecessary replay, enlargement, downloading, or duplication;
- stop reviewing traumatic material when sufficient evidence exists;
- do not assign suspected child sexual exploitation material to Room moderators, volunteers, or untrained personnel;
- permit a reviewer to pause or defer non-imminent work when exposure, illness, fatigue, dizziness, or distress could impair judgment;
- avoid traumatic-content review while driving, medically unwell, or in an environment that cannot protect confidentiality;
- separate reviewers from direct public confrontation with reported members;
- do not include graphic details in routine notifications, GitHub issues, or public documents;
- do not use productivity quotas that encourage rapid or repeated traumatic exposure;
- document operational reassignment or a needed break without recording unnecessary private medical information.

## 10. Handling log requirements

Every evidence interaction records:

- case ID;
- evidence reference;
- action performed;
- reviewer role;
- timestamp;
- purpose;
- previous and new location when an authorized transfer occurs.

Original references must not be silently replaced. Corrections require a new entry.

## 11. Publication and completion gates

This SOP remains internal and Issue #667 remains open until all of the following are complete:

1. a qualified backup Trust and Safety owner is appointed and trained;
2. child-safety, emergency, intimate-image, self-harm, preservation, disclosure, and notice procedures receive qualified legal review;
3. the legal-request and emergency-disclosure workflow under Issue #674 is approved;
4. the retention register under Issue #668 defines report, evidence, audit, backup, and vendor-copy treatment;
5. role-limited and auditable evidence storage is implemented and verified;
6. the case record and decision log are exercised through controlled synthetic scenarios;
7. support and Room moderation receive escalation training;
8. public documents are reviewed to ensure they do not expose individual owners or promise continuous monitoring, emergency dispatch, guaranteed response times, or unverified legal obligations.
