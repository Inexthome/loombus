# Issue #674: Chain of Custody and Export Integrity Foundation

## Purpose

This phase establishes the control structure required to prove export integrity and custody history later without creating or transmitting an export now.

It is intentionally narrower than export operations. The phase creates no package rows, artifact rows, verification rows, or custody events and adds no export-generation or custody-write RPC.

## Separation of authority

A new authorization field, `can_review_export_integrity`, is added with a default of `false`.

This capability permits restricted review of integrity metadata only. It is separate from:

- `can_export`
- `can_disclose`
- `can_approve_emergency`
- source-data collection
- disclosure approval
- external transfer or transmission

The shared Legal Operations authorization query is deliberately unchanged in this phase. The new workspace checks `can_review_export_integrity` locally so deployment of the application does not make existing Legal Operations routes depend on the new database column before the migration is applied.

## Data model

### `legal_export_packages`

Future control row for one export package associated with a legal request and disclosure record.

Lifecycle states are:

- `planned`
- `generated`
- `verified`
- `sealed`
- `voided`

Generated and later states require accountable actor and timestamp metadata. Verified and sealed states require both manifest and package SHA-256 digests. Sealed and voided states have additional accountable-actor constraints.

A database trigger rejects any package whose `disclosure_id` does not belong to the same `request_id`. This prevents cross-request package linkage even if a future writer supplies two individually valid foreign keys.

The table stores control metadata only. It does not store export payload bytes.

### `legal_export_artifacts`

Future append-only metadata for files belonging to a package.

Fields include:

- package relationship
- optional disclosure-manifest item relationship
- artifact role
- file name
- media type
- byte size
- SHA-256 digest
- accountable creator and time

The table has no payload/blob/content column.

### `legal_export_verifications`

Future append-only verification evidence.

Supported verification classes include:

- manifest hash
- package hash
- artifact hashes
- manifest item coverage
- artifact count
- byte count
- field scope
- custody continuity

Verification records can contain digests, counts, pass/fail result, and a bounded note. They are not responsive-content storage.

### `legal_chain_of_custody_events`

Future append-only custody history for a package.

The schema distinguishes package registration, artifact registration, verification, sealing, internal handoff, external transfer, external receipt, access, voiding, and destruction.

External transfer or receipt events require a counterparty reference, but this phase adds no RPC or application operation capable of creating those events.

## Database access boundary

All four tables are RLS-enabled.

No browser RLS policy is created. `PUBLIC`, `anon`, and `authenticated` receive no direct privileges.

The service role receives `SELECT` only. It receives no direct `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, or `TRIGGER` privilege.

Artifact, verification, and custody-event rows also use the existing Legal Operations append-only mutation guard so future approved insert paths cannot rewrite evidentiary history in place.

## Restricted workspace

The phase adds:

- `GET /api/admin/legal-operations/export-integrity`
- `/admin/legal-operations/export-integrity`
- `Open Export Integrity` on the Admin shortcut bar

The route first requires ordinary active Legal Operations authorization, then independently verifies `can_review_export_integrity=true`.

A successful view must first write the global audit action:

`legal_export_integrity_workspace_view_attempt`

with:

- surface `/admin/legal-operations/export-integrity`
- foundation version `20260809060000`
- mode `metadata_only`

If audit recording fails, the workspace fails closed.

The route is GET-only. There is no POST, PUT, PATCH, or DELETE operation in this phase.

## Explicitly disabled

This phase does not enable or perform:

- source-system queries for responsive member data
- Storage object retrieval
- export generation
- export-package generation
- manifest finalization
- artifact registration
- integrity-verification recording
- custody-event recording
- external transfer or receipt
- disclosure approval
- emergency-disclosure approval
- member notice sending
- external transmission
- `can_export`
- `can_disclose`
- `can_approve_emergency`
- `ACCOUNT_DELETION_DESTRUCTIVE_HANDLERS_ENABLED`
- `ROOM_PERMANENT_DELETION_ENABLED`

## Production rollout order

1. Merge and deploy the application and migration.
2. Confirm the production migration dry run contains only `20260809060000_create_legal_export_integrity_foundation.sql`.
3. Apply the migration.
4. Run `scripts/verification/legal-export-integrity-foundation-readiness.sql` and require every row to PASS.
5. While `can_review_export_integrity=false`, open `/admin/legal-operations/export-integrity` and confirm access is denied.
6. Enable only `can_review_export_integrity` for exactly one already-authorized fictional-workflow reviewer using a fail-closed one-row SQL statement.
7. Confirm `can_export=0`, `can_disclose=0`, and `can_approve_emergency=0` across active authorizations.
8. Open the workspace and confirm it reports zero packages, zero artifacts, zero verifications, and zero custody events.
9. Confirm the global audit log contains `legal_export_integrity_workspace_view_attempt` with `target_id` null and metadata-only mode.

No fictional export payload is required. No real member data should be used.

## Controlled capability enablement pattern

Before running an update, first prove exactly one eligible reviewer exists. The reviewer should already be an active, nonrevoked Legal Operations reviewer used only for the controlled fictional workflow and should still have all downstream authorities disabled.

A production operator may use a transaction that aborts unless exactly one eligible row is found, then sets only `can_review_export_integrity=true`. The exact SQL should be reviewed against current production authorization state immediately before execution rather than copied into this document as a permanent operator shortcut.

## Future gate

A later phase may add narrowly scoped SECURITY DEFINER RPCs for package creation, artifact registration, verification recording, or custody events only after:

- qualified counsel approves the operating procedure and templates
- export authorization criteria are approved
- request-specific source collection is approved
- package storage location and encryption controls are verified
- key-management and access controls are verified
- export-generation logic is independently reviewed
- disclosure and transmission approval remain separately gated

This foundation is not authority to perform any of those actions.
