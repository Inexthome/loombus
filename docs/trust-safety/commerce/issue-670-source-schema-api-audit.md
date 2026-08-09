# Issue #670: Exact Source Schema and API Audit

## Status

**Status:** Internal production-contract audit  
**Tracks:** Issue #670  
**Baseline:** merged PR #870 / `b2dbbc29542313a33336a49466ec25dd144974c4`  
**Public ready:** No  
**Database migration authorized by this document:** No  
**Moderation or enforcement behavior changed by this document:** No

This document completes Phase A from the Issue #670 classification migration plan. It verifies the current source identifiers, report tables, free-text fields, workflow states, access boundaries, deletion behavior, private-message evidence path, and universal enforcement linkage that the shared application taxonomy contract must respect.

The audit is intentionally descriptive. It does not classify any real record, change any report, create an enforcement decision, enable automated classification, or authorize a database migration.

## 1. Executive result

The production data model supports the planned additive classification architecture, but a future classification ledger cannot safely be implemented as a simple foreign key to one universal report table.

The reasons are structural:

1. Marketplace, Businesses, Jobs, Events, Requests, and Services each have a distinct report table.
2. Room reports use a different table and a different `state` / resolution contract.
3. Private-message reports are represented inside the general `reports` table and use JSON metadata in `resolution_note` to identify the private message or conversation.
4. Appointments do not have a general policy-report table in the reviewed administrator path. Administrator cancellation reasons are operational audit context.
5. Local is an aggregation layer and should inherit the classification of its source record.
6. Universal `enforcement_decisions.source_report_id` references only the general `reports` table, not the module-specific commerce report tables.
7. Existing commercial report foreign keys generally cascade on source deletion, so a future canonical classification history must not assume the source report will exist forever.

The correct next step is therefore the Phase B application registry only. A database migration remains deferred.

## 2. Severity correction from PR #870

PR #870 correctly identified a collision between canonical policy severity and Issue #667 Trust and Safety triage severity, but its audit text truncated the canonical policy model at `S4`.

The current canonical safety specification and production enforcement contract contain six policy levels:

- `S0` = No violation or informational
- `S1` = Low-severity or correctable
- `S2` = Material violation
- `S3` = High-risk violation
- `S4` = Severe violation
- `S5` = Critical or imminent risk

Issue #667 separately uses:

- `S1` = Critical
- `S2` = High
- `S3` = Elevated
- `S4` = Standard

The Phase B application contract must therefore use explicit namespaced values:

- `POLICY.S0` through `POLICY.S5`
- `TS.S1_CRITICAL`
- `TS.S2_HIGH`
- `TS.S3_ELEVATED`
- `TS.S4_STANDARD`

A future classification schema must reject ambiguous bare severity values.

## 3. Shared production pattern for public commerce reports

Marketplace, Businesses, Jobs, Events, Requests, and Services all preserve the member allegation separately from the source record's moderation note.

The common conceptual pattern is:

- source record ID;
- reporter ID;
- `reason` free text;
- `details` free text;
- open/reviewed state;
- reviewer identity;
- review time;
- administrator `decision_note`;
- creation/update timestamps.

The report's `reason` is not a canonical policy finding. The source record's `moderation_reason` is also free-form administrator text and is not a canonical policy finding.

## 4. Marketplace

### Source record

- table: `marketplace_listings`
- canonical source identifier: `marketplace_listings.id`
- owner: `seller_id`
- optional business attribution: `business_id`
- lifecycle: `draft`, `pending`, `published`, `rejected`, `suspended`, `sold`, `expired`, `removed`
- free-form source moderation field: `moderation_reason`

### Report record

- table: `marketplace_reports`
- report identifier: `marketplace_reports.id`
- source reference: `listing_id -> marketplace_listings.id`
- source deletion: `ON DELETE CASCADE`
- reporter reference: `reporter_id -> auth.users.id`
- reporter deletion: `ON DELETE CASCADE`
- allegation: `reason`, database length 1 to 120
- narrative: `details`, database length 10 to 3000
- status: `open`, `resolved`, `dismissed`
- review fields: `reviewed_by`, `reviewed_at`, `decision_note`

### API behavior

The server trims `reason` to 120 characters and `details` to 3000 characters, requires a reason and at least 10 characters of detail, and rate-limits reports to 10 per reporter per hour.

Administrator listing decisions are `approve`, `reject`, `suspend`, and `remove`. Report review is `resolve` or `dismiss`.

### Access boundary

RLS is enabled and direct access is revoked from `public`, `anon`, and `authenticated`. Application reads/writes pass through the existing server contract.

### Classification implication

A canonical classification should reference the listing and may optionally reference the report, but must not replace `reason`, `details`, or `moderation_reason`.

## 5. Businesses

### Source record

- table: `businesses`
- canonical source identifier: `businesses.id`
- ownership: `owner_id`
- creator: `created_by`
- lifecycle: `draft`, `pending`, `published`, `rejected`, `suspended`
- verification is separate: `unverified`, `pending`, `verified`, `denied`
- free-form source moderation field: `moderation_reason`

### Separate ownership workflow

`business_claims` is a distinct ownership/authority process with `evidence`, `status`, `reviewed_by`, `reviewed_at`, and `decision_note`.

An ownership claim must not be treated as a policy classification merely because it was rejected.

### Report record

- table: `business_reports`
- report identifier: `business_reports.id`
- source reference: `business_id -> businesses.id`
- source deletion: `ON DELETE CASCADE`
- reporter reference: `reporter_id -> auth.users.id`
- reporter deletion: `ON DELETE CASCADE`
- allegation: `reason`, database length 1 to 120
- narrative: `details`, database length 10 to 3000
- status: `open`, `resolved`, `dismissed`
- review fields: `reviewed_by`, `reviewed_at`, `decision_note`

### Access boundary

RLS is enabled on Businesses, Services, claims, and reports, with direct access revoked from `public`, `anon`, and `authenticated`. Server-side authorization remains authoritative.

### Classification implication

Business identity, ownership, verification, and policy classification require separate fields and separate decisions. Unverified is not synonymous with fraudulent.

## 6. Jobs

### Source record

- table: `job_postings`
- canonical source identifier: `job_postings.id`
- employer source: `business_id -> businesses.id`
- lifecycle: `draft`, `pending`, `published`, `rejected`, `suspended`, `closed`, `expired`
- free-form source moderation field: `moderation_reason`

### Report record

- table: `job_reports`
- report identifier: `job_reports.id`
- source reference: `job_id -> job_postings.id`
- source deletion: `ON DELETE CASCADE`
- reporter reference: `reporter_id -> auth.users.id`
- reporter deletion: `ON DELETE CASCADE`
- allegation: `reason`, database length 1 to 120
- narrative: `details`, database length 10 to 3000
- status: `open`, `resolved`, `dismissed`
- review fields: `reviewed_by`, `reviewed_at`, `decision_note`

### API behavior

The server preserves `reason` and `details`, rate-limits report submissions, and records report review separately from posting moderation.

### Access boundary

RLS is enabled and direct access is revoked from `public`, `anon`, and `authenticated`.

### Classification implication

Employment classification may use COM-12 and other applicable categories, but posting lifecycle and application-source validity remain separate product facts.

## 7. Events

### Source record

- table: `public_events`
- canonical source identifier: `public_events.id`
- organizer: `organizer_id`
- optional business attribution: `business_id`
- lifecycle: `pending`, `published`, `rejected`, `cancelled`, `completed`, `removed`
- free-form source moderation field: `moderation_reason`

### Report record

- table: `public_event_reports`
- report identifier: `public_event_reports.id`
- source reference: `event_id -> public_events.id`
- source deletion: `ON DELETE CASCADE`
- reporter reference: `reporter_id -> profiles.id`
- reporter deletion: `ON DELETE CASCADE`
- allegation: `reason`
- narrative: `details`
- status: `open`, `resolved`, `dismissed`
- review fields: `reviewed_by`, `reviewed_at`, `decision_note`
- one-open-report constraint: one open report per event and reporter

### API behavior

The server trims `reason` to 120 and `details` to 3000, requires at least 10 characters of detail, rate-limits to 10 Event reports per hour, and rejects a second open report from the same reporter for the same Event.

Event moderation is `approve`, `reject`, or `remove`; report review is `resolve` or `dismiss`.

### Schema/API distinction

Unlike Marketplace, Businesses, and Jobs, the initial Event table does not add explicit database length checks for report `reason` and `details`; those bounds are enforced by the server path.

### Access boundary

RLS is enabled, direct public/member table access is revoked, and service role is explicitly granted table access.

## 8. Requests

### Source record

- table: `service_requests`
- canonical source identifier: `service_requests.id`
- requester: `requester_id`
- optional business attribution: `business_id`
- lifecycle includes `draft`, `pending`, `open`, `reviewing`, `in_progress`, `resolved`, `closed`, `rejected`, `suspended`, `removed`
- free-form source moderation field: `moderation_reason`

### Report record

- table: `service_request_reports`
- report identifier: `service_request_reports.id`
- source reference: `request_id -> service_requests.id`
- source deletion: `ON DELETE CASCADE`
- reporter reference: `reporter_id -> profiles.id`
- reporter deletion: `ON DELETE CASCADE`
- allegation: `reason`
- narrative: `details`
- status: `open`, `resolved`, `dismissed`
- review fields: `reviewed_by`, `reviewed_at`, `decision_note`
- one-open-report constraint: one open report per Request and reporter

### API behavior

The server trims `reason` to 120 and `details` to 3000, requires at least 10 characters of detail, rate-limits to 10 Request reports per hour, and writes report resolution with an optimistic `status = open` guard.

### Access boundary

RLS is enabled, direct public/member access is revoked, and service role is explicitly granted table access.

### Classification implication

Request fulfillment, response selection, linked conversations, and policy classification remain separate records.

## 9. Services

### Source record

- table: `provider_services`
- canonical source identifier: `provider_services.id`
- provider: `provider_id`
- optional business attribution: `business_id`
- optional appointment linkage: `appointment_service_id`
- lifecycle: `draft`, `pending`, `published`, `paused`, `rejected`, `archived`, `removed`
- free-form source moderation field: `moderation_reason`

### Report record

- table: `provider_service_reports`
- report identifier: `provider_service_reports.id`
- source reference: `service_id -> provider_services.id`
- source deletion: `ON DELETE CASCADE`
- reporter reference: `reporter_id -> profiles.id`
- reporter deletion: `ON DELETE CASCADE`
- allegation: `reason`
- narrative: `details`
- status: `open`, `resolved`, `dismissed`
- review fields: `reviewed_by`, `reviewed_at`, `decision_note`
- one-open-report constraint: one open report per Service and reporter

### API behavior

The server trims `reason` to 120 and `details` to 3000, requires at least 10 characters of detail, rate-limits to 10 Service reports per hour, and guards review writes on `status = open`.

### Access boundary

RLS is enabled, direct public/member access is revoked, and service role is explicitly granted table access.

## 10. Rooms

### Operational source

Platform Operations reads `rooms` as the Room-level source and reads pending reports from `room_moderation_reports`.

### Report shape used by the administrator API

The current administrator route consumes:

- `id`
- `room_id`
- `reporter_id`
- `target_type`
- `target_id`
- `target_label`
- `target_snapshot`
- `reason`
- `details`
- `state`
- `created_at`

Pending Room reports use `state = pending`.

Report review writes:

- `state = resolved | dismissed`
- `resolution_note`
- `resolved_by`
- `resolved_at`
- `updated_at`

The write is guarded by `state = pending`.

### Privacy boundary

The administrator API explicitly does not load private Room discussions, posts, resources, events, member-directory details, invitations, or Room messages. The report snapshot is intentionally bounded.

### Classification implication

A future commerce classification may reference a Room report or Room target only when the reviewed conduct is actually within Issue #670. It must not cause a broader private-Room content fetch.

## 11. Appointments

### Source records

The current administrator route reads:

- `business_appointment_services`
- `business_appointment_requests`

The canonical policy-relevant source, when one exists, is normally the appointment request or the connected provider/business/service record.

### Administrator cancellation

The administrator route permits `cancel_request` only for active supported states. A reason is required by the API, but the request row update writes only:

- `status = cancelled`
- `acted_at`

The administrator-supplied cancellation note is recorded in the existing audit log metadata together with provider, requester, business, and service identifiers.

### Classification implication

The cancellation note is operational audit context. It is not a canonical policy classification and must not be automatically mapped to `COM-##`.

## 12. Private messages and the general reports table

### General report source

The existing `/admin/reports` command center reads the general `reports` table after administrator verification.

Relevant fields include:

- `id`
- `reason`
- `status`
- `reviewed_by`
- `reviewed_at`
- `resolution_note`
- `status_updated_by`
- `status_updated_at`
- `actioned_by`
- `actioned_at`
- `created_at`
- `discussion_id`
- `reply_id`
- `reported_profile_id`

General report states are normalized to `new`, `reviewing`, `dismissed`, and `actioned` in the current administrator UI.

### Message-report identification

Private-message and private-conversation reports do not use a dedicated message report table in the reviewed path. They are identified by JSON metadata stored in `reports.resolution_note`.

Recognized metadata includes:

- `type = private_message | private_conversation`
- `message_id`
- `conversation_id`
- `notes`
- optional moderation note in the administrator client

### Restricted evidence route

`/api/admin/messages/evidence`:

1. verifies the authenticated user;
2. verifies `profiles.is_admin`;
3. switches to the service-role client;
4. reads the report and parses message metadata;
5. loads the private conversation and participants;
6. loads a bounded message evidence window;
7. returns an empty body for messages already deleted by the sender.

The evidence route can expose private message bodies to the authorized administrator workflow. That does not make message bodies appropriate for a shared classification ledger.

### Classification implication

A future classification record may hold a source reference to a private message/conversation report, but must not duplicate the message body or weaken the existing evidence endpoint's authorization boundary.

## 13. Local and Matches

### Local

Local Discovery aggregates source documents from Businesses, business services, Jobs, Marketplace, Events, Requests, and Services. It is not an independent policy-record system.

A Local policy indicator must inherit from the underlying source record. A direct `Local` classification mutation should fail closed.

### Matches

Matches feedback is diagnostic and is outside the Issue #670 category registry. `helpful`, `not relevant`, `incorrect`, or `unsafe` feedback does not become a commerce finding merely by existing.

If a matched source is later classified, the classification attaches to the source record and downstream matching eligibility remains a separate integration concern.

## 14. Universal enforcement linkage

The existing `enforcement_decisions` model already supports target types for:

- message
- room
- marketplace
- business
- service
- request
- job
- event
- appointment

However, its `source_report_id` foreign key references only `public.reports(id)`.

It cannot directly identify `marketplace_reports`, `business_reports`, `job_reports`, `public_event_reports`, `service_request_reports`, `provider_service_reports`, or `room_moderation_reports` through that field.

The enforcement model otherwise stores canonical policy metadata including public reason, primary and secondary reasons, context modifiers, policy version, severity, confidence, action, member explanation, appeal state, restoration state, legal-hold state, and confidentiality.

Commercial target types are currently marked manual for both decision integration and restoration in `src/lib/enforcement-contract.ts`.

### Required compatibility rule

A future Issue #670 classification ledger should link to `enforcement_decisions.id` only as an optional related decision. It should not overload `enforcement_decisions.source_report_id` or assume that enforcement is the canonical source of the commerce classification.

When future enforcement integration occurs, namespaced `POLICY.S#` values must be deliberately translated to the existing enforcement severity field rather than copied from T&S triage values.

## 15. Foreign-key and deletion finding

All six reviewed public commerce report tables attach to their source records with `ON DELETE CASCADE`:

- `marketplace_reports -> marketplace_listings`
- `business_reports -> businesses`
- `job_reports -> job_postings`
- `public_event_reports -> public_events`
- `service_request_reports -> service_requests`
- `provider_service_reports -> provider_services`

Reporter deletion also cascades in those report tables.

This is compatible with the current module designs but creates an audit requirement for a future canonical classification ledger.

### Future database requirement

The classification ledger should not silently disappear merely because a source or report is physically deleted. Phase C must choose an explicit retention/preservation design, such as a non-cascading source reference contract plus scoped source metadata, while respecting Issue #668 retention and Issue #674 preservation rules.

This document does not choose that schema yet.

## 16. RLS and access finding

For the six public commerce modules reviewed here:

- source/report tables have RLS enabled;
- direct `anon` and `authenticated` access is revoked;
- server/service-role paths perform current application access checks.

Room and private-message evidence add stronger contextual restrictions because the underlying material can be private or sensitive.

The future classification ledger should therefore be **server controlled** and must not expose a direct browser mutation merely because one administrator UI needs to display classifications.

## 17. Exact source-key contract for Phase B

The application taxonomy registry should recognize these source modules:

- `marketplace`
- `businesses`
- `services`
- `requests`
- `jobs`
- `events`
- `appointments`
- `rooms`
- `local`
- `messages`

`matches` is intentionally excluded from the Issue #670 classification-source registry.

The registry should also record source handling mode:

- direct: Marketplace, Businesses, Services, Requests, Jobs, Events;
- conditional: Appointments;
- restricted: Rooms and Messages;
- inherited only: Local.

These modes describe structural constraints only. They do not grant authorization.

## 18. Phase B registry requirements

The shared application registry must now provide:

1. one stable taxonomy family and version;
2. `COM-01` through `COM-15` IDs;
3. exact titles and concise internal labels;
4. source-module applicability as `primary`, `secondary`, or `not_applicable`;
5. canonical safety-reason compatibility;
6. policy severity validation using `POLICY.S0` through `POLICY.S5`;
7. T&S triage validation using explicit Issue #667 names;
8. rejection of bare severity codes;
9. rejection of unknown category/version/module/reason combinations;
10. fail-closed direct classification for Local.

The registry must not be imported into any moderation action path in this phase.

## 19. Phase C blockers that remain after the registry

Do not start the database classification ledger until a separate technical PR resolves:

- generic source-reference representation across heterogeneous report tables;
- source deletion and classification-history preservation;
- restricted Room/message evidence linkage;
- classification create/supersede/void authorization roles;
- audit-event contract;
- Issue #668 record class and disposition mapping;
- Issue #674 hold/preservation mapping;
- enforcement linkage and severity translation;
- synthetic RLS/grant validation.

## 20. Completion of Phase A

Phase A is complete at the application-contract level once this audit is merged.

The audit confirms that Issue #670 should remain additive:

- original reporter allegations stay in their source tables;
- module moderation notes stay in their source tables;
- report resolution remains separate;
- appointment cancellation remains operational unless independently classified;
- Local inherits source classification;
- Matches remains diagnostic;
- private-message evidence remains restricted;
- enforcement remains a separate decision system;
- a new canonical classification must be versioned, auditable, and non-destructive.
