# Issue #674: Legal Data Source Registry

## Purpose

This phase creates an internal map of systems where potentially responsive data may exist so Legal Operations can reason about scope without beginning collection or export.

The registry is metadata only. It does not contain request-specific subject identifiers, member content, responsive payloads, files, attachments, credentials, export packages, or disclosure artifacts.

## Relationship to Issue #668

Issue #668 already established a detailed account-deletion resource registry. That registry is valuable evidence for system-of-record and copy-lifecycle mapping, but its purpose is deletion disposition and orchestration.

Issue #674 therefore uses a separate `public.legal_data_source_registry` rather than turning the deletion registry into a legal-request workflow.

The legal registry records the relevant Issue #668 resource keys for reconciliation, while preserving strict separation from deletion handlers, worker dispatch, disposition state, and destructive feature flags.

## Registry fields

Each source row records:

- stable source key and source group;
- human-readable display name;
- source kind;
- system of record;
- data classes that may exist there;
- source locations or source families;
- a metadata-only locator contract;
- related Issue #668 account-deletion resource keys;
- external processors when applicable;
- inventory status: `verified`, `partial`, or `unresolved`;
- explicit unresolved inventory items;
- repository evidence sources;
- internal notes and ordering metadata.

`partial` and `unresolved` rows are required to record their gaps. The registry must not turn absence of repository evidence into a claim that a production copy does not exist.

## Initial coverage

The initial registry maps fourteen source families:

1. account, authentication, profile, age-safety, and account lifecycle;
2. published Discussions, Replies, and source-linked derivatives;
3. private conversations, participants, messages, and attachment metadata;
4. Rooms, organizations, membership, shared Room data, and Room operations;
5. Storage objects, metadata, derivatives, and platform-controlled copies;
6. Marketplace, Businesses, Services, Requests, Jobs, Events, Appointments, and Local;
7. billing, payments, subscriptions, entitlements, refunds, and disputes;
8. Trust and Safety, enforcement, appeals, evidence, and support escalations;
9. Legal Operations requests, holds, disclosure-control metadata, and audit records;
10. Everything Search derived documents, local recent-search state, telemetry, and caches;
11. AI usage/provenance, source-linked outputs, analyses, ratings, logs, and provider copies;
12. notifications, email/push delivery, tokens, suppressions, queues, and delivery evidence;
13. infrastructure, security, fraud, privileged-access, incident, and operational logs;
14. backups, replicas, caches, archives, exports, recipient copies, and vendor/subprocessor copies.

## Important inventory truths

The registry deliberately preserves unresolved areas rather than overstating coverage.

Examples include:

- no canonical first-party Everything Search query-log or click-log table was established by the reviewed Search implementation;
- production logging, analytics, observability, security telemetry, and vendor dashboards require separate provider inventory;
- AI persistence is feature-specific rather than one platform-wide prompt/output table;
- active external LLM processing is OpenAI, while historical Anthropic provenance/provider copies can still exist and must remain truthfully attributed;
- the current OpenAI evidence does not establish Zero Data Retention or Modified Abuse Monitoring;
- billing provider retention, tax/accounting schedules, disputes, webhook logs, and provider deletion/redaction controls remain provider-specific;
- backups, replicas, caches, exports, recipient copies, and vendor/subprocessor copies are not implied by canonical database coverage.

## Access boundary

`public.legal_data_source_registry` is RLS-enabled and intentionally has no direct table privileges for `anon` or `authenticated`.

The service role receives SELECT only. It receives no INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, or TRIGGER privilege.

Registry changes are migration-maintained, not operator-editable.

The internal workspace and API require:

- an authenticated user;
- platform administrator status;
- an active Legal Operations authorization;
- `can_review_requests=true`.

Access is audited through the existing Legal Operations global audit mechanism.

## Read-only workspace

The internal route is:

`/admin/legal-operations/data-map`

The workspace can display and locally filter registry metadata. It cannot:

- query a mapped source system for member records;
- accept a member ID or request-specific target;
- collect responsive content;
- retrieve Storage objects;
- call Stripe, OpenAI, email/push, logging, support, or other provider APIs;
- generate an export or manifest payload;
- create or modify a legal request;
- approve a disclosure or emergency disclosure;
- send a member notice;
- transmit data externally.

A source appearing in the map means only that authorized reviewers should consider it during scope analysis. It does not mean a source is responsive, legally disclosable, technically collectible, or within the minimum necessary scope of a specific request.

## Production readiness

After deployment, run:

`scripts/verification/legal-data-source-registry-readiness.sql`

Every row must return `PASS` before controlled workspace validation.

The verifier checks:

- registry table and required columns;
- RLS;
- absence of direct browser privileges;
- service-role SELECT-only access;
- all fourteen required source families;
- minimum metadata completeness;
- explicit gaps for partial/unresolved rows;
- explicit Search query/click telemetry gaps;
- active OpenAI plus historical Anthropic lineage in the AI row;
- absence of request-specific UUID values in seeded registry metadata;
- export, disclosure, and emergency-approval authority remaining disabled.

## Controlled validation

1. Keep `ACCOUNT_DELETION_DESTRUCTIVE_HANDLERS_ENABLED` disabled.
2. Keep `ROOM_PERMANENT_DELETION_ENABLED` disabled.
3. Keep `can_export=false`, `can_disclose=false`, and `can_approve_emergency=false`.
4. Apply `20260809053000_create_legal_data_source_registry.sql`.
5. Run the readiness verifier and require every row to PASS.
6. Open `/admin/legal-operations/data-map` using the existing authorized fictional-workflow reviewer.
7. Confirm all fourteen source families are visible without request-specific member identifiers or responsive content.
8. Confirm the Search row explicitly reports unresolved query/click telemetry inventory.
9. Confirm the AI row identifies OpenAI as active and Anthropic only as historical lineage.
10. Confirm infrastructure/backups/vendor rows remain unresolved rather than claiming complete provider coverage.
11. Confirm a `legal_data_source_registry_view_attempt` global audit entry is written.

No fictional source payload is needed for this phase because the registry is static system metadata rather than request-specific data.

## Downstream boundary

This phase does not authorize source collection or export. A later collection/export phase must separately define:

- dedicated export authority;
- request-specific source selection;
- exact subject/record locator rules;
- protected-party and unrelated-member minimization;
- collection audit and chain of custody;
- package integrity and hashing;
- qualified-counsel approval;
- disclosure approval and recipient verification.

Until those controls exist and are approved, the Legal Data Source Registry remains an internal review map only.
