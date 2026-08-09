# Issue #674: Legal Operations Retention & Disposition Foundation

## Purpose

This phase defines how Legal Operations records are classified for retention and disposition review without establishing unsupported fixed timelines or enabling destructive execution.

It intentionally builds on Issue #668 rather than creating a competing platform-wide retention register.

Issue #668 established `public.account_deletion_resource_registry` as the canonical machine-readable platform resource register. The Legal Operations schedule therefore stores a canonical-register reference and optional related Issue #668 resource keys for interaction awareness.

Legal Operations governance records are not automatically subject to member-account deletion disposition merely because a case references a member.

## Separation of authority

A new authorization field, `can_review_legal_retention`, is added with a default of `false`.

This capability permits restricted review of retention and disposition metadata only. It does not grant:

- purge or deletion authority
- anonymization authority
- archive mutation authority
- source-data collection
- export generation
- disclosure approval
- emergency approval
- member notice sending
- external transmission

The existing shared Legal Operations access query is deliberately unchanged. The new GET route checks `can_review_legal_retention` locally so deployment of the application does not make existing Legal Operations routes depend on the migration column before the production migration is applied.

## Registry

The phase creates `public.legal_retention_schedule_registry`.

The registry is migration-managed and metadata-only. It identifies 12 Legal Operations record classes:

1. legal request case metadata
2. preservation hold controls
3. disclosure control metadata
4. disclosure manifest metadata
5. Legal Operations request event history
6. Legal Operations authorization records
7. global Legal Operations audit history
8. Legal Data Source Registry metadata
9. export package integrity metadata
10. export artifact integrity metadata
11. export verification history
12. chain-of-custody history

Each row records:

- source locations
- lifecycle trigger
- qualitative normal retention rule
- fixed-timing approval status
- active-hold interaction
- disposition method classification
- whether destructive execution is enabled
- counsel-review requirement
- canonical Issue #668 register reference
- optional related Issue #668 resource keys
- accountable owner and review cadence
- unresolved decisions
- repository evidence

## No unsupported fixed timelines

Every seeded row has:

- `timing_status = 'unapproved'`
- `timing_value = null`
- `counsel_review_required = true`

The schema prevents an unapproved timing row from carrying a fixed timing value.

A future approved timing value requires a separately reviewed migration after production behavior and provider evidence support the commitment and qualified counsel approves it.

## Destructive execution is structurally disabled

Every registry row has `disposition_execution_enabled = false`.

The schema includes a check constraint that requires this field to remain false. A future destructive phase cannot silently toggle it through application code. Enabling any disposition execution would require a separately reviewed database migration that changes the constraint and operating model.

No purge, delete, anonymize, archive, or disposition write RPC is added.

The two existing destructive feature flags remain outside this phase and must remain disabled:

- `ACCOUNT_DELETION_DESTRUCTIVE_HANDLERS_ENABLED`
- `ROOM_PERMANENT_DELETION_ENABLED`

## Active preservation holds

The registry explicitly distinguishes three hold interactions:

- `blocks_disposition`
- `retain_history`
- `not_request_scoped`

Request-scoped records such as legal requests, disclosure controls, manifest metadata, and future export-package metadata state that an active preservation hold blocks future disposition.

Evidentiary history such as request events, verification history, and custody history uses `retain_history`. Release or expiry of a hold does not itself authorize deletion of that history.

Governance registries and authorization records can be `not_request_scoped`; their lifecycle is not driven by an individual request or member deletion.

This phase does not change the already deployed hold enforcement on account and Room destructive paths.

## Issue #668 reconciliation

Every row points to:

`public.account_deletion_resource_registry`

Optional `related_account_deletion_resource_keys` are used only where a Legal Operations record class interacts with a canonical platform resource category, for example:

- `rooms`
- `trust_safety_support`
- `backups_and_replicas`

These are cross-references, not deletion instructions. The Issue #668 registry remains authoritative for member-account deletion resource disposition.

The readiness verifier rejects any related key that does not exist in the Issue #668 canonical register.

## Database access boundary

`public.legal_retention_schedule_registry` is RLS-enabled.

No browser RLS policy is created. `PUBLIC`, `anon`, and `authenticated` receive no direct privileges.

The service role receives `SELECT` only. It receives no direct mutation privileges.

All registry changes therefore occur through reviewed migrations in this phase.

## Restricted read-only workspace

The phase adds:

- `GET /api/admin/legal-operations/retention`
- `/admin/legal-operations/retention`
- `Open Legal Retention` on the Admin shortcut bar

The route first requires an active platform-admin Legal Operations authorization and then independently verifies `can_review_legal_retention=true`.

A successful view must first record the global audit action:

`legal_retention_schedule_workspace_view_attempt`

with:

- surface `/admin/legal-operations/retention`
- foundation version `20260809062000`
- mode `metadata_only`
- canonical register `public.account_deletion_resource_registry`

If audit recording fails, the workspace fails closed.

The route is GET-only. No POST, PUT, PATCH, or DELETE operation is added.

The workspace reads only retention schedule metadata. It does not load legal request contents, member records, responsive records, export payloads, or source-system data.

## Readiness verifier

`scripts/verification/legal-retention-schedule-foundation-readiness.sql` checks:

- dedicated capability presence and default-off state
- registry table and required columns
- RLS
- zero browser privileges and policies
- service-role SELECT-only access
- all 12 required record classes
- zero approved fixed timelines
- destructive execution disabled
- qualified counsel required on every row
- canonical Issue #668 register reference on every row
- validity of all optional Issue #668 resource keys
- lifecycle and hold-rule completeness
- absence of retention-disposition write RPCs
- export authority remains disabled
- disclosure authority remains disabled
- emergency approval authority remains disabled

Every row must PASS before controlled production UI validation.

## Production rollout order

1. Merge and deploy the application and migration.
2. Confirm the production migration dry run contains only `20260809062000_create_legal_retention_schedule_foundation.sql`.
3. Apply the migration.
4. Run `scripts/verification/legal-retention-schedule-foundation-readiness.sql` and require every row to PASS.
5. While `can_review_legal_retention=false`, open `/admin/legal-operations/retention` and confirm access is denied.
6. Enable only `can_review_legal_retention` for exactly one already-authorized fictional-workflow Legal Reviewer using a fail-closed one-row SQL statement.
7. Confirm `can_export=0`, `can_disclose=0`, and `can_approve_emergency=0` across active authorizations.
8. Open the workspace and confirm 12 record classes, zero approved fixed timelines, zero disposition execution, and counsel review required for all 12 rows.
9. Confirm the global audit log contains `legal_retention_schedule_workspace_view_attempt` with `target_id` null and metadata-only mode.

No real legal request data is required for production validation.

## Future gate

A later phase may establish approved retention durations or disposition execution only after:

- qualified counsel approves the schedule and record categories
- production and provider evidence supports any fixed timing commitment
- active-hold interactions are verified for every destructive path
- backup, replica, cache, export, vendor, and recipient-copy behavior is reconciled
- privilege, victim, reporter, unrelated-member, billing, fraud, safety, security, and dispute exceptions are reviewed
- destructive behavior is independently tested with fictional data
- public policy language is reconciled only after the operational behavior is verified

This foundation is not authority to delete or purge any Legal Operations record.
