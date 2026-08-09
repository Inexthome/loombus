# Issue #670: Restricted Classification Ledger Foundation

## Status

**Status:** Internal Phase C technical foundation  
**Tracks:** Issue #670  
**Baseline:** merged PR #871 / `ddad2c0798d051a0ed044f10d7a9f9c35bc6ace0`  
**Public ready:** No  
**Classification UI/API enabled by this phase:** No  
**Automated classification enabled:** No  
**External reporting or disclosure enabled:** No

This phase creates the restricted database foundation for the versioned commerce and professional-integrity taxonomy established by Issue #670.

It does not classify a production record, change a member report, make a moderation decision, create an enforcement action, create a Trust and Safety case, publish policy, send a notice, or contact an outside party.

## 1. Why a separate ledger is required

The exact source audit in PR #871 confirmed that Loombus does not have one universal commerce report table.

Marketplace, Businesses, Jobs, Events, Requests, and Services each use different report tables. Room reports use a different state/resolution contract. Private-message reports are represented in the general `reports` table with restricted JSON metadata and a bounded evidence endpoint. Appointment cancellation reasons are operational context rather than policy findings. Local is an aggregation layer rather than an independent policy-record system.

The classification system therefore cannot safely be implemented by adding one foreign key to a universal report table or by rewriting module-native report reasons.

The Phase C design is additive and preserves those distinctions.

## 2. Database objects

Migration:

`supabase/migrations/20260809231000_create_commerce_integrity_classification_foundation.sql`

The migration creates five restricted tables:

1. `commerce_integrity_taxonomy_versions`
2. `commerce_integrity_source_module_registry`
3. `commerce_integrity_taxonomy_categories`
4. `commerce_integrity_classifications`
5. `commerce_integrity_classification_events`

It also creates service-only validation and classification functions plus append-only mutation guards.

## 3. Versioned taxonomy mirror

The database stores a migration-managed mirror of the application contract from:

- `src/lib/commerce-integrity-taxonomy.ts`
- `docs/trust-safety/commerce/issue-670-canonical-commerce-and-professional-integrity-taxonomy.md`

The initial version is:

`commerce_integrity.v1`

It contains exactly `COM-01` through `COM-15`, the canonical titles, concise internal labels, primary/secondary module applicability, and compatible canonical safety-reason codes.

This database mirror is used only to reject invalid classifications at the database boundary. It does not make the internal taxonomy public and does not approve jurisdiction-specific legal conclusions.

## 4. Source-module write boundary

Phase C records the source handling mode separately from category applicability.

### Write-enabled foundation sources

- Marketplace
- Businesses
- Services
- Requests
- Jobs
- Events
- Appointments

Appointments remain conditional. A routine scheduling or cancellation reason is still not a policy classification.

### Write-disabled restricted/inherited sources

- Rooms: `restricted`
- private messages/conversations: `restricted`
- Local: `inherited_only`

The database registry explicitly keeps `classification_write_enabled=false` for all three.

This is deliberate. Phase C must not create a new path that broadens access to private Room or message evidence. Local must continue to inherit the classification of the underlying source record rather than receive an independent policy finding.

A later reviewed migration and restricted server workflow are required before Room or private-message classification writes can be enabled.

## 5. Non-cascading source and report references

The classification row stores:

- source module
- source record type
- source record UUID
- optional source report type
- optional source report UUID

Those identifiers are validated against current production source/report tables when a classification is created.

They are intentionally **not foreign-keyed** to the source or report table.

This resolves a load-bearing deletion issue found in PR #871. The existing Marketplace, Business, Job, Event, Request, and Service report tables can cascade when their source record is physically deleted. A canonical classification must not silently disappear just because that source/report later follows its own approved lifecycle.

The inverse problem is also avoided: adding a restrictive foreign key from classification history to a source record could accidentally become a new blocker on an otherwise approved source disposition.

The ledger therefore records a historical reference without taking ownership of the source lifecycle.

## 6. Original allegations and evidence remain outside the ledger

The classification ledger does not contain fields for:

- raw report reason text
- raw report details
- private-message body
- private Room content
- attachment bytes
- victim or witness detail
- authentication secrets
- full financial credentials
- legal-request contents
- unrestricted investigation notes

Authorized reviewers continue to use the existing source-specific workflow to see evidence they are allowed to access.

The ledger stores the reviewer conclusion and minimum structured linkage only.

## 7. Append-only supersession model

`commerce_integrity_classifications` cannot be updated or deleted through the service role.

Material changes are recorded by inserting a new row that references:

`supersedes_classification_id`

A unique successor index prevents one classification from branching into multiple competing successors.

The guarded create function serializes writes for a source record with a transaction-scoped advisory lock and requires a supersession request to target the single current head.

This gives every classified source one linear history rather than allowing silent in-place edits or concurrent parallel heads.

### Supported row states

- `proposed`
- `confirmed`
- `void`

A `void` row must supersede the current classification. It does not erase history.

## 8. Classification provenance

The initial database contract accepts only:

- `human_review`
- `exact_legacy_mapping`

There is no AI or model-generated provenance option in Phase C.

`exact_legacy_mapping` may create only a confirmed classification and does not constitute authorization to bulk-convert historical free text.

No bulk mapping job, keyword classifier, embedding classifier, or LLM classifier is included.

## 9. Source and report validation

The service-only source validator confirms the declared record exists in the expected table at classification time.

The service-only report validator confirms the optional report belongs to the declared source record.

Covered report mappings are:

- Marketplace -> `marketplace_reports`
- Businesses -> `business_reports`
- Services -> `provider_service_reports`
- Requests -> `service_request_reports`
- Jobs -> `job_reports`
- Events -> `public_event_reports`
- Rooms -> `room_moderation_reports` when a later restricted write workflow exists
- Messages -> general `reports` metadata when a later restricted write workflow exists

For private-message reports, the helper parses only the existing report metadata required to match the message/conversation identifier. It does not load or copy message bodies.

## 10. Category, reason, and context validation

A classification fails closed when:

- taxonomy version is unknown or inactive
- source module is unknown
- source write mode is disabled
- source record type does not match the module
- category is unknown
- category is not applicable to the module
- primary safety reason is not compatible with the category
- a secondary reason is incompatible, blank, duplicated, or repeats the primary reason
- a context modifier is not in the canonical context vocabulary
- report type/id is malformed or does not belong to the source
- source record does not exist at classification time

This keeps `COM-##` categories, canonical safety reasons, and module applicability synchronized without replacing original member allegations.

## 11. Severity namespace separation

Phase C uses the corrected canonical policy namespace:

- `POLICY.S0`
- `POLICY.S1`
- `POLICY.S2`
- `POLICY.S3`
- `POLICY.S4`
- `POLICY.S5`

Issue #667 Trust and Safety operational triage remains separately namespaced:

- `TS.S1_CRITICAL`
- `TS.S2_HIGH`
- `TS.S3_ELEVATED`
- `TS.S4_STANDARD`

Bare `S0` through `S5` values do not satisfy the database contract.

A T&S triage severity requires an existing Trust and Safety case link.

A **confirmed** `POLICY.S4` or `POLICY.S5` classification also requires an existing Trust and Safety case link. Phase C does not create that case automatically.

## 12. Enforcement and Trust and Safety linkage

The ledger contains optional reference IDs for:

- `enforcement_decision_id`
- `trust_safety_case_id`

The guarded function verifies that a referenced record exists before insertion.

These are related-record links only.

Creating a classification does not:

- create an enforcement decision
- change account standing
- remove or suspend a listing
- resolve a report
- create a T&S case
- change T&S severity
- restore content
- send a member notice

The existing universal enforcement/appeal system remains authoritative for enforcement decisions and appeals.

## 13. Classification events

`commerce_integrity_classification_events` is append-only.

The foundation records:

- `classification_created`
- `classification_superseded`
- `classification_voided`

The event record stores identifiers and structural metadata only. It does not duplicate raw evidence.

## 14. Browser and service-role access

All five Phase C tables have RLS enabled.

No browser policy is created.

`PUBLIC`, `anon`, and `authenticated` receive no direct table privileges.

The service role receives `SELECT` only on the tables.

The service role receives no direct `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, or `TRIGGER` privilege on classification history.

Classification insertion is available only through:

`create_commerce_integrity_classification(...)`

That function is service-role executable and independently requires the supplied actor to currently be a platform administrator.

There is no browser route in Phase C, so deployment plus migration alone does not make the function reachable from a member or administrator UI.

Phase D must add its own server-side authorization, source-specific evidence boundary, and global audit logging before a user-facing classification workflow exists.

## 15. Preservation compatibility

Phase C adds a service-only exact hold lookup:

`commerce_integrity_classification_hold_applies(uuid)`

The exact hold-target convention is:

- `target_type = other`
- `resource_key = commerce_integrity_classifications`
- `target_ref = <classification UUID>`

The helper accepts only an active exact classification target.

This phase does not create a preservation hold and does not change any Legal Operations authorization or hold workflow.

No classification deletion/disposition RPC exists, so the hold helper is not currently used to authorize or block a destructive classification action. It establishes the exact preservation contract that a future disposition phase must call before any destructive behavior can be considered.

## 16. Retention and disposition boundary

Phase C intentionally creates no classification delete, purge, anonymize, or archive path.

Classification history therefore remains non-destructive until a later retention/disposition phase is separately reviewed.

Before any such disposition is implemented, the following must be completed:

1. reconcile the classification record class with the canonical Issue #668 `account_deletion_resource_registry`;
2. decide whether classification history is member-account-scoped, governance history, or a mixed record class;
3. define the approved disposition behavior without inventing an unsupported fixed retention duration;
4. enforce active Issue #674 holds at every destructive boundary;
5. preserve required enforcement/appeal/T&S audit history;
6. test source-deleted, report-deleted, held, superseded, and void histories with fictional data;
7. verify backup/replica/provider effects before claiming complete disposition.

This foundation does not establish a public retention commitment.

## 17. No external side effects

No Phase C database function:

- exports data
- discloses data
- transmits data externally
- contacts law enforcement
- contacts NCMEC or another outside organization
- sends member notice
- publishes policy
- approves an emergency disclosure
- modifies a legal request
- changes a preservation hold

Issue #667 and #674 counsel-gated powers remain outside this workflow.

## 18. Readiness verifier

Run:

`scripts/verification/commerce-integrity-classification-foundation-readiness.sql`

The verifier checks, among other things:

- five required tables
- RLS
- zero browser table privileges
- zero service-role direct writes to classification history
- service-role read access
- one active `commerce_integrity.v1`
- ten source modules
- fifteen `COM-##` categories
- exact enabled/disabled source boundary
- no unknown category-module references
- zero classification rows after foundation deployment
- zero classification event rows after foundation deployment
- append-only triggers
- one-successor invariant
- guarded service-only classification function
- administrator/source/report validation
- advisory-lock head serialization
- corrected policy and T&S severity namespaces
- severe confirmed classification T&S-case requirement
- exact classification hold helper
- zero classification destructive RPCs
- zero classification external-action RPCs

Every row must return `PASS` before Phase C is considered production-ready.

## 19. Controlled verification boundary

The foundation migration itself seeds only static taxonomy/source metadata and must produce:

- zero classifications
- zero classification events
- zero enforcement decisions
- zero Trust and Safety cases
- zero Legal Operations requests or holds

If a later controlled function test is needed, use fictional source records only and a specifically authorized test administrator. Do not use a real member allegation, private message, private Room content, regulated transaction, or harmful material.

Any synthetic classification created for testing must be clearly identified in its fictional source data and cleaned up only through a separately approved test procedure. Because classification history is deliberately append-only, production testing should preferably stop at structural/readiness verification until Phase D provides a dedicated controlled test workflow.

## 20. Deployment order

1. Merge and deploy the application branch. There is no user-facing application behavior change in this PR.
2. Confirm the Supabase migration dry run contains only `20260809231000_create_commerce_integrity_classification_foundation.sql` from this phase.
3. Apply that migration.
4. Run `scripts/verification/commerce-integrity-classification-foundation-readiness.sql`.
5. Require every readiness row to return `PASS`.
6. Confirm `commerce_integrity_classifications` contains zero rows.
7. Confirm `commerce_integrity_classification_events` contains zero rows.
8. Do not call the classification create function with real records during foundation verification.

No environment feature flag, public policy switch, AI provider change, or Legal Operations capability needs to be enabled for this phase.

## 21. Next phase

After Phase C is merged, migrated, and verified, Phase D may add a restricted manual reviewer API and Platform Operations UI for the write-enabled public commerce sources.

That later phase must:

- import and use the existing `src/lib/commerce-integrity-taxonomy.ts` registry;
- preserve original report reason/details visibly and separately;
- display classification separately from report resolution and module action;
- require explicit human confirmation;
- prevent automatic enforcement;
- record global audit events;
- preserve source-specific authorization;
- keep Rooms, private messages, and Local disabled until their separate restricted integration is reviewed;
- avoid creating any external reporting or disclosure side effect.

Issue #670 remains open after this foundation. Public policy conversion and qualified commerce, employment, advertising, professional-practice, and regulatory legal review remain later acceptance gates.
