# Issue #670: Manual Commerce Integrity Reviewer Workspace

## Status

**Status:** Internal Phase D manual-review foundation  
**Tracks:** Issue #670  
**Baseline:** merged and production-verified PR #872 / `27055aaae66e03a13b02de9b9e749aff38e1bb10`  
**Public ready:** No  
**Automated classification enabled:** No  
**External reporting or disclosure enabled:** No

This phase connects the production-verified Issue #670 classification ledger to a restricted human reviewer workflow without coupling classification to report resolution, source moderation, account enforcement, member notice, or external action.

## 1. Added workspace

Internal route:

`/admin/platform/commerce-integrity`

API:

`/api/admin/platform/commerce-integrity`

The workspace is intentionally separate from the existing approve, reject, suspend, remove, resolve, dismiss, and Appointment-cancellation actions in Platform Operations.

A reviewer can therefore record a canonical policy conclusion without accidentally treating a lifecycle action or member allegation as the classification itself.

## 2. Authorization

Both GET and POST use the existing authenticated account-access verification path and require:

`profiles.is_admin = true`

The browser does not receive direct write privileges on the classification tables or RPC.

The server uses the service-role client only after administrator verification.

The existing Phase C database function independently rechecks that the supplied actor is an administrator before it creates a row.

This is defense in depth. Browser access alone is not sufficient to create a classification.

## 3. Sources enabled in Phase D

The application route accepts only the seven Phase C write-enabled source modules:

- Marketplace -> `marketplace_listing`
- Businesses -> `business`
- Services -> `provider_service`
- Requests -> `service_request`
- Jobs -> `job_posting`
- Events -> `public_event`
- Appointments -> `appointment_request`

The server derives the canonical source-record type from the selected module. The browser cannot substitute an arbitrary record type.

Optional source report types are also fixed by the server:

- Marketplace -> `marketplace_report`
- Businesses -> `business_report`
- Services -> `service_report`
- Requests -> `request_report`
- Jobs -> `job_report`
- Events -> `event_report`

Appointments accept no report identifier in this phase because routine Appointment cancellation and scheduling reasons remain operational context rather than policy allegations.

## 4. Sources still blocked

Phase D exposes no create path for:

- Rooms
- private messages
- private conversations
- Local
- Matches
- Search

Rooms and private messages remain restricted sources under Phase C. Local remains inherited-only. Matches feedback remains diagnostic and Search is outside the commerce-classification source contract.

The API contains no accepted value that maps to those write-disabled source modules.

## 5. Human-review-only provenance

The API always supplies:

`classification_source = human_review`

The browser cannot request:

- `exact_legacy_mapping`
- AI/model classification
- keyword classification
- embedding classification
- bulk historical conversion
- automatic classification

The workspace requires an explicit reviewer acknowledgement before its submit control is enabled.

The acknowledgement states that the reviewer performed a manual review and that the classification is a policy-review record rather than a legal conclusion or action authorization.

## 6. Canonical taxonomy use

The browser imports the application registry merged in PR #871:

`src/lib/commerce-integrity-taxonomy.ts`

The form limits the reviewer to categories applicable to the selected module and displays the compatible canonical safety reasons for the selected `COM-##` category.

The database remains authoritative and repeats category/module/reason validation before insertion.

The taxonomy version submitted by the server is fixed to:

`commerce_integrity.v1`

The browser cannot choose an arbitrary taxonomy version.

## 7. Severity separation

The manual reviewer UI offers only canonical policy severity:

- `POLICY.S0`
- `POLICY.S1`
- `POLICY.S2`
- `POLICY.S3`
- `POLICY.S4`
- `POLICY.S5`

It does not expose Issue #667 Trust and Safety triage severity as an editable field.

If a reviewer chooses a **confirmed** `POLICY.S4` or `POLICY.S5` classification, the UI requires an existing Trust and Safety case UUID and the database independently verifies the case exists.

The workflow never creates a Trust and Safety case automatically.

## 8. Report and source preservation

A classification can reference an optional source report for the six report-bearing public modules.

The server does not copy into the classification ledger:

- member report reason text
- report details
- private content
- attachment bytes
- reporter identity
- victim or witness detail
- payment credentials
- authentication secrets
- legal-request content
- unrestricted investigation notes

The existing source workflow remains the place where an authorized reviewer sees the evidence appropriate to that module.

The Phase C RPC independently verifies that the supplied record exists and that an optional report belongs to that exact source record before insertion.

## 9. History and supersession

GET loads append-only classification history for one exact source record.

The workspace identifies the current head by removing rows referenced as `supersedes_classification_id` from later rows.

If more than one head is detected, GET fails closed with an engineering-review state instead of guessing which classification is current.

When a current head exists, the browser supplies its exact UUID as `supersedesClassificationId` on the next manual classification.

Even if the reviewer does not load history first, the Phase C RPC independently rejects a new parallel head. This prevents a browser omission from weakening the single-current-head database invariant.

Phase D supports new `proposed` and `confirmed` reviewer rows. It does not expose a dedicated destructive delete or history-edit operation.

## 10. No operational side effects

Creating a classification does not:

- resolve or dismiss a source report
- approve, reject, suspend, remove, cancel, publish, or restore a source record
- create an enforcement decision
- change account standing
- create a Trust and Safety case
- send a member notice
- create a Legal Operations request or hold
- generate an export
- approve a disclosure
- approve an emergency disclosure
- contact law enforcement
- contact NCMEC
- contact another external party
- transmit data externally

The Issue #667 and #674 counsel-gated external-action boundaries remain unchanged.

## 11. No database migration

Phase D adds no Supabase migration.

It consumes only the Phase C schema and RPC already applied and production-verified after PR #872.

No additional `supabase db push` is required for this phase.

## 12. Controlled validation plan

Do not create a classification solely to prove the UI can write.

Pre-merge and preview validation should cover:

1. signed-out access redirects to login;
2. a non-administrator cannot access classification history or create a classification;
3. the page renders the seven allowed modules only;
4. Rooms, messages, Local, Matches, and Search are absent from the write selector;
5. category choices change according to module applicability;
6. primary and secondary safety reasons remain constrained to the selected category;
7. only `proposed` and `confirmed` are exposed;
8. only `POLICY.S0` through `POLICY.S5` are exposed for policy severity;
9. confirmed S4/S5 requires a T&S case UUID before submit is enabled;
10. Appointments do not expose a source-report field;
11. history loading is exact to module + source UUID;
12. no existing report/moderation action is called by the classification workspace;
13. no browser direct Supabase classification-table mutation is present;
14. no external-action API is called;
15. Light, Dark, System, desktop, tablet, and mobile remain usable.

Production write testing should wait for a legitimate internal review need or a separately approved fictional source fixture. Do not classify a real production record merely to test the mechanism.

## 13. Remaining Issue #670 work after Phase D

Phase D does not complete Issue #670.

Remaining internal work includes:

- deciding whether and how source cards should deep-link into the standalone reviewer workspace without coupling moderation and classification actions;
- defining restricted Room classification review if operationally necessary;
- defining restricted private-message classification review if operationally necessary;
- defining Local inheritance/display behavior;
- reconciling classification with member notice and enforcement display without creating automatic side effects;
- converting the internal Marketplace, Jobs, Services, fraud, and regulated-goods drafts to final counsel-review-ready public policy text;
- consolidating qualified commerce, employment, advertising, professional-practice, and regulatory legal questions for counsel review.

Qualified counsel review remains required before jurisdiction-specific legal conclusions or public regulated-category representations are treated as final.
