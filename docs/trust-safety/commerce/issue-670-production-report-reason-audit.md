# Issue #670: Production Report and Reason Contract Audit

## Status

**Status:** Internal production-contract audit  
**Tracks:** Issue #670  
**Public ready:** No  
**Production taxonomy migration authorized by this document:** No  
**Qualified legal review:** Still required for regulated-category legal standards and public legal claims

This document audits the current Loombus moderation and operational reason surfaces against the canonical commerce and professional-integrity taxonomy established in `issue-670-canonical-commerce-and-professional-integrity-taxonomy.md`.

The purpose is to identify what production already records, what remains free text or module-specific, and where a structured canonical classification can be added without destroying original member reports, conflating allegations with findings, or creating a second enforcement system.

## 1. Audit baseline

The reviewed implementation baseline includes:

- the canonical safety taxonomy and decision model;
- the canonical Issue #670 `COM-01` through `COM-15` taxonomy;
- Platform Operations Phases 1 through final coverage;
- the existing universal enforcement and appeals foundation;
- the restricted Trust and Safety case system;
- the Issue #668 retention and disposition foundation;
- the Issue #674 Legal Operations foundation and owner-position package.

This audit does not treat the existence of an administrator text field, a report reason, a cancellation reason, or an operational status as equivalent to a canonical policy classification.

## 2. Executive finding

The current Platform Operations system already provides the correct operational shell. A second moderation center is not needed.

The principal gap is **reason normalization**.

Several modules currently preserve a member or module-native `reason` plus free-form `details`, while administrator actions are generally expressed as lifecycle decisions such as `approve`, `reject`, `suspend`, `remove`, `resolve`, or `dismiss`. Those values describe an action or report workflow state. They do not provide the stable cross-module policy category required by Issue #670.

The safest architecture is additive:

1. preserve original report reason and details;
2. preserve existing module lifecycle decisions;
3. add a separate structured canonical classification;
4. keep enforcement action separate from classification;
5. keep Trust and Safety triage severity separate from policy severity;
6. never infer a legal conclusion merely from a member's report wording.

## 3. Critical consistency finding: severity namespace collision

Loombus currently has two materially different severity models.

### Canonical policy severity

The publication-readiness safety taxonomy uses:

- `S0` = no violation or informational concern;
- `S1` = low-severity or correctable concern;
- `S2` = material violation;
- `S3` = high-risk violation;
- `S4` = severe violation.

Severity increases numerically.

### Trust and Safety operational triage

Issue #667 uses:

- `S1` = Critical;
- `S2` = High;
- `S3` = Elevated;
- `S4` = Standard.

Urgency decreases numerically.

### Required correction

No new shared commerce schema may store a naked value such as `S1`, `S2`, `S3`, or `S4` without an explicit namespace and model.

A future structured contract should use separate fields or explicitly namespaced values, for example:

- `policy_severity_code = POLICY.S0 | POLICY.S1 | ... | POLICY.S4`
- `triage_severity_code = TS.S1_CRITICAL | TS.S2_HIGH | TS.S3_ELEVATED | TS.S4_STANDARD`

The names are implementation proposals, not a migration authorization. The important rule is that the two models must never share an ambiguous bare code.

## 4. Platform-wide separation of concepts

The production contract must keep the following concepts distinct:

| Concept | Meaning | Must not be treated as |
|---|---|---|
| Reporter reason | What a member says is wrong | Proven policy violation |
| Reporter details | Member-supplied narrative/context | Canonical reason code |
| Canonical commerce category | `COM-01` through `COM-15` classification | Automatic enforcement action |
| Canonical safety reason | `GOODS.*`, `SERVICE.*`, `JOBS.*`, etc. | Automatic legal conclusion |
| Policy severity | Harm/policy seriousness under canonical safety model | Trust and Safety queue priority |
| T&S triage severity | Operational urgency under Issue #667 | Policy severity |
| Report resolution | `resolve`, `dismiss`, etc. | Content/account action |
| Module moderation decision | `approve`, `reject`, `suspend`, `remove`, etc. | Canonical reason |
| Enforcement decision | Canonical account/content/module action record | Reporter allegation |
| Legal preservation | Hold/preservation state | Moderation or guilt finding |

## 5. Marketplace

### Verified current behavior

The Platform Operations administrator workflow consumes the existing Marketplace moderation payload and does not create a parallel moderation system.

Current listing decisions include:

- `approve`
- `reject`
- `suspend`
- `remove`

Current report-review decisions include:

- `resolve`
- `dismiss`

Administrator notes remain separate free-form text.

The reviewed Platform Operations orchestration passes a `MarketplaceReport` by ID for review, but does not submit a `COM-##` category, canonical safety reason, or namespaced policy severity.

### Gap

Marketplace has no verified cross-module canonical Issue #670 classification in the reviewed administrator action contract.

### Required migration behavior

- retain the original Marketplace report and any existing reporter reason/details unchanged;
- attach canonical classification separately;
- do not turn `remove`, `suspend`, `resolve`, or `dismiss` into policy reason codes;
- support more than one safety reason while maintaining exactly one primary `COM-##` category when a commerce classification is confirmed.

## 6. Businesses

### Verified current behavior

Platform Operations loads the existing Business Directory moderation payload and sends actions back through the existing `/api/businesses` contract.

The administrator shell does not pass a canonical `COM-##` category or canonical safety reason as part of its shared orchestration.

Business publication, ownership-claim review, report review, and business lifecycle state are separate operational concerns.

### Gap

The exact persistence schema for every Business report reason must be treated as module-specific until the migration phase inspects the current table/API fields. The current shared administrator shell is not itself a canonical reason ledger.

### Required migration behavior

- preserve ownership-claim reasons separately from policy violation classifications;
- distinguish business identity/verification concerns from prohibited commercial conduct;
- map confirmed false business/professional claims to the canonical taxonomy without implying that all unverified businesses are fraudulent.

## 7. Jobs

### Verified current behavior

Platform Operations loads existing Jobs moderation and report queues through `/api/jobs`.

The administrator shell sends module-native moderation payloads and does not submit a canonical Issue #670 classification field.

### Gap

The live Jobs contract requires an additive canonical mapping for categories such as:

- employment scam;
- money-mule/reshipping activity;
- false employer authority;
- misleading compensation;
- unsafe or prohibited opportunity;
- professional or credential deception;
- discrimination concerns where supported by the applicable reviewed standard.

### Required migration behavior

A report alleging discrimination, fraud, or unsafe work remains an allegation until reviewed. The canonical classification must record the reviewed conclusion, not overwrite the reporter's words.

## 8. Events

### Verified current behavior

The current Event moderation panel displays:

- `report.reason`
- `report.details`
- report creation time

Report review uses:

- `resolve`
- `dismiss`

Record moderation uses:

- `approve`
- `reject`
- `remove`

The current removal helper may place the existing report reason into an administrator note for context.

### Gap

`report.reason` is a module-native reason string, not a verified canonical `COM-##` or safety reason code.

### Required migration behavior

- retain `report.reason` and `report.details` as source evidence;
- add structured classification separately;
- never parse a reporter's phrase into a legal conclusion automatically;
- distinguish event-content concerns from commercial ticketing, recruiting, regulated-product, or professional-claim concerns.

## 9. Requests

### Verified current behavior

The current Request moderation panel displays:

- `report.reason`
- `report.details`
- report creation time

Report review uses `resolve` or `dismiss`.

Request moderation can use `approve`, `reject`, `suspend`, or `remove` depending on the action path.

When a report leads to suspension/removal, the current UI may use the original `report.reason` as contextual administrator-note text.

### Gap

There is no verified canonical classification in that reviewed path.

### Required migration behavior

A Request may ask for a legitimate service, a prohibited service, a dangerous item, a deceptive transaction, or conduct unrelated to commerce integrity. Canonical classification must therefore be additive and context-sensitive.

## 10. Services

### Verified current behavior

The current Service moderation panel displays:

- `report.reason`
- `report.details`
- report creation time

Report review uses `resolve` or `dismiss`.

Service moderation uses `approve`, `reject`, or `remove` in the reviewed administrator panel.

The report reason may be copied into a moderator note when a reported Service is removed.

### Gap

The current reason remains module-native free text in the reviewed UI contract.

### Required migration behavior

Structured classification should distinguish, among other things:

- prohibited service activity;
- false credential or license claim;
- out-of-scope professional practice;
- deceptive medical/legal/financial claim;
- unsafe care service;
- deceptive pricing or fee;
- false portfolio/testimonial/result;
- sensitive-data or intake abuse.

Those classifications must not imply a legal finding unless the applicable legal standard has been reviewed.

## 11. Rooms

### Verified current behavior

Platform Operations provides a global Room operational registry and report snapshots without opening private Room content.

The existing Room administrator surface is intentionally constrained so Platform Operations does not become a general backdoor into private Room material.

### Gap

Room report and Room-governance reasons may overlap with commerce categories but are not interchangeable with them.

### Required migration behavior

- keep Room-governance classification under the existing platform taxonomy;
- add a `COM-##` classification only when the reviewed conduct is actually commercial/professional activity;
- preserve the privacy boundary around private Room content;
- severe-harm cases continue to route through the restricted Trust and Safety system rather than being flattened into a commerce queue.

## 12. Appointments

### Verified current behavior

The Appointments administrator surface is primarily lifecycle/operational oversight.

Administrator cancellation requires a reason and records the intervention.

### Important distinction

An appointment cancellation reason is not automatically a policy reason.

Examples of non-policy cancellation context can include operational error, scheduling impossibility, provider unavailability, duplicate booking, or another legitimate lifecycle reason.

### Required migration behavior

Do not force all Appointment cancellation reasons into Issue #670.

A canonical commerce classification is appropriate only when a reviewed Appointment is tied to prohibited or deceptive service conduct, intake abuse, exploitation, fraud, or another covered taxonomy category.

## 13. Local

### Verified current behavior

Local administrator operations are diagnostic and aggregate source records from existing modules such as Businesses, Jobs, Marketplace, Events, Requests, and Services.

Local does not need a second independent commerce-reason system for those records.

### Required migration behavior

Local should inherit or display the canonical classification of the underlying source record when authorized. A Local diagnostic state such as missing location coverage or stale indexing is not a commerce policy violation.

## 14. Matches

### Current boundary

Intelligent Matching has operational feedback and health signals that are separate from the Issue #670 commerce taxonomy.

Feedback such as relevance or quality concerns must not automatically become a commerce violation classification.

If a matched source record is later confirmed to violate a commerce rule, the classification should attach to the source record and be reflected in matching eligibility through the appropriate source/enforcement controls.

## 15. Private messages

### Current audit state

Private messages can contain commerce-related arrangements, but message safety/moderation is a platform-wide Trust and Safety concern rather than a reason to create a second commerce-only message-report system.

The exact current message-report persistence and administrator reason fields require a dedicated schema/API inspection before a production migration touches them.

### Required migration behavior

- preserve the original message report and conversation authorization boundary;
- classify commerce-related misconduct only where the message is relevant to a covered commercial/professional concern;
- do not expose message content merely because a linked Marketplace, Job, Service, Request, or Appointment receives a classification;
- use the restricted severe-harm workflow where applicable.

## 16. Current readiness matrix

| Surface | Existing operational/report path | Canonical `COM-##` field verified | Migration state |
|---|---|---:|---|
| Marketplace | Yes | No | additive mapping required |
| Businesses | Yes | No | exact field audit + additive mapping required |
| Jobs | Yes | No | exact field audit + additive mapping required |
| Events | Yes, `reason` + `details` | No | additive mapping required |
| Requests | Yes, `reason` + `details` | No | additive mapping required |
| Services | Yes, `reason` + `details` | No | additive mapping required |
| Rooms | Yes, restricted operational/report snapshot | No | conditional mapping only |
| Appointments | Yes, operational cancellation reason | No | do not conflate cancellation with policy reason |
| Local | Diagnostic/source aggregation | No | inherit source classification |
| Matches | Operational feedback | No | remain separate from commerce taxonomy |
| Private messages | Platform safety/report path exists | No | exact schema/API audit required before migration |

## 17. Legacy-data rule

Existing reports must not be bulk-converted into confirmed policy findings merely by parsing historical free-text `reason` or `details` fields.

Permitted legacy treatment should be limited to one of these approaches:

1. leave historical records `unclassified` under the new taxonomy;
2. map an exact historical enumerated option only where the mapping is deterministic and reviewed;
3. manually classify a historical record when there is an operational need and adequate evidence.

AI, keyword matching, or fuzzy text matching may assist discovery for review but must not silently create a confirmed classification or legal conclusion.

## 18. Original-report preservation rule

A future migration must never replace or normalize away the member's original report wording.

The source record should remain available to authorized reviewers subject to existing privacy, retention, and access controls. Structured classification is an additional reviewer conclusion, not a rewrite of the original allegation.

## 19. Enforcement separation rule

A confirmed `COM-##` category does not itself authorize a specific action.

The reviewer still separately determines, under the approved enforcement contract:

- report resolution;
- content/listing/record action;
- account action;
- Room action;
- commercial eligibility restriction;
- member notice;
- appeal eligibility;
- Trust and Safety escalation;
- preservation/legal handling where applicable.

## 20. AI boundary

AI or automated systems may assist with:

- suggesting candidate categories;
- grouping similar reports;
- identifying missing fields;
- highlighting possible cross-module duplicates;
- drafting an internal summary.

AI or automation must not independently:

- confirm the final policy category;
- determine a professional-license violation;
- determine illegality;
- determine discrimination as a final legal conclusion;
- set final severity;
- authorize enforcement;
- authorize external reporting or disclosure;
- overwrite a human review record.

## 21. Migration prerequisites

Before a production schema migration is drafted, the next technical phase must verify:

1. exact report-table and API field names for Marketplace, Businesses, Jobs, Rooms, and private messages;
2. whether current reports use free text, enums, or both;
3. existing foreign keys and deletion behavior;
4. how universal enforcement decisions reference source records;
5. whether one shared classification ledger can reference every covered source without weakening RLS;
6. append-only/supersession requirements for classification history;
7. the explicit namespaced severity contract;
8. admin authorization and audit requirements;
9. retention/hold behavior under Issues #668 and #674;
10. compatibility with existing notices and appeals.

## 22. Audit conclusion

Issue #670 does not require a new moderation center or a destructive rewrite of existing reports.

The production gap is a **versioned, additive, auditable classification layer** that maps existing module reports and reviewed records to the canonical commerce taxonomy while preserving:

- the original member allegation;
- module lifecycle state;
- enforcement independence;
- Trust and Safety triage independence;
- privacy boundaries;
- appeal history;
- retention and legal holds.

The next implementation phase should build that shared classification foundation only after the exact remaining source schemas are verified.