# Issue #674: Aggregate Transparency Reporting Foundation

## Purpose

This phase establishes an internal methodology registry for future aggregate Legal Operations transparency reporting.

It does **not** generate aggregate counts, create report snapshots, expose request-specific records, publish a transparency report, send data externally, approve disclosures, approve emergency disclosures, send member notices, or change destructive deletion behavior.

Qualified counsel remains required before Loombus approves a public reporting universe, category taxonomy, outcome taxonomy, reporting period, suppression rule, explanatory language, or publication workflow.

## Existing fields reused

The Legal Operations foundation already created these request-level fields:

- `legal_requests.transparency_reportable`
- `legal_requests.transparency_jurisdiction_group`
- `legal_requests.transparency_outcome`

The Legal Review capability migration already protects those fields through the authoritative `legal_requests_enforce_review_authorization` trigger and `can_review_requests` capability.

This phase does not replace that review boundary.

## Fail-closed classification review

A new request-level field is added:

- `legal_requests.transparency_review_status`

Allowed values:

- `unreviewed`
- `reviewed`
- `requires_counsel`

The default is `unreviewed`.

The existing request-review trigger is extended so changes to `transparency_review_status` require the same `can_review_requests` authority that already protects the other transparency-classification fields.

This is intentionally separate from the new read-only transparency-methodology review capability.

### Reportability default

The database default for new `legal_requests.transparency_reportable` rows changes from `true` to `false`.

This is a fail-closed default for future requests. It does not reclassify existing requests.

A `true` reportability value, including any legacy value, is never sufficient by itself to make a request eligible for a future aggregate or public report. Future eligibility must also satisfy the approved transparency-review workflow and approved aggregate-reporting methodology.

## Dedicated methodology-review capability

Adds:

- `legal_operations_authorizations.can_review_transparency_reporting`

Default: `false`.

This capability permits access only to the internal methodology registry workspace.

It does not grant:

- request mutation
- aggregate execution
- snapshot generation
- public publication
- export generation
- disclosure approval
- emergency approval
- member notice sending
- external transmission
- Legal Operations access management

The shared Legal Operations access query remains unchanged so deployment of the application does not make existing Legal Operations routes depend on the new migration column before production migration.

## Methodology registry

Adds service-only table:

- `public.legal_transparency_reporting_registry`

The table contains methodology metadata only.

It is not request-specific and contains no requester identity, request number, scope text, member identifier, responsive content, disclosure payload, file, export artifact, or external recipient data.

### Access boundary

The registry has:

- RLS enabled
- no browser RLS policies
- no `PUBLIC` privileges
- no `anon` privileges
- no `authenticated` privileges
- service-role `SELECT` only
- no service-role `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, or `TRIGGER` privilege

All registry changes require a reviewed migration.

## Twelve methodology controls

The registry seeds twelve controls.

### Candidate dimensions

1. reporting period candidate
2. request type classification
3. jurisdiction group classification
4. transparency outcome classification
5. reportability classification
6. transparency classification review state

### Counting rules

7. one canonical legal request per request count
8. request counts remain separate from disclosure counts

### Privacy controls

9. unreviewed classifications cannot become external aggregate output
10. request-specific data is excluded from aggregate output
11. small-cell and re-identification suppression is required before publication

### Publication gate

12. public transparency-report release gate

## Structurally disabled behavior

Every enabled registry row is constrained so that:

- `aggregation_execution_enabled = false`
- `publication_enabled = false`
- `request_specific_data_allowed = false`
- `counsel_review_required = true`

Every seeded methodology row starts with:

- `publication_approval_status = 'unapproved'`

The database constraints prevent those disabled states from being changed without a later schema migration.

## No guessed suppression threshold

The registry requires a future small-cell/re-identification suppression control but intentionally does not choose a numeric threshold.

A threshold, category-combination rule, differencing defense, or other disclosure-control methodology must be approved through qualified legal/privacy review before public release.

## Request/disclosure separation

The methodology explicitly distinguishes:

- legal requests
- disclosures
- preservation holds
- request events
- manifest items
- export-integrity records

Future request counts must not be inferred from disclosure rows.

A request can have zero, one, or multiple disclosure-control records, so disclosure volume and request volume are separate metrics.

No disclosure-volume methodology is approved in this phase.

## Missing classification handling

Null or incomplete transparency classifications must remain explicit unresolved states.

A future reporting process must not silently:

- drop unclassified requests to improve completeness
- infer jurisdiction groups from requester identity or other request-specific data
- infer outcomes from request status
- infer disclosure outcomes from disclosure-row presence
- treat `transparency_reportable = true` as reviewed eligibility
- convert `requires_counsel` into inclusion or exclusion without review

## Request-specific data exclusion

Future aggregate output must not include request-specific values such as:

- request numbers
- requester names
- requester contacts
- requester organizations when individually identifying
- request scope text
- narrowed scope text
- authority-review narrative
- confidentiality notes
- member identifiers
- responsive records or content
- disclosure payloads

This foundation does not create an aggregate query, so none of those fields are loaded by the transparency-reporting workspace.

## Restricted workspace

Adds:

- `GET /api/admin/legal-operations/transparency-reporting`
- `/admin/legal-operations/transparency-reporting`
- Admin shortcut `Open Transparency Reporting`

The route requires:

1. active platform administrator access
2. active Legal Operations authorization
3. `can_review_transparency_reporting = true`

The route is GET-only.

It reads only the methodology registry.

It does not query `legal_requests`, `legal_disclosures`, preservation records, member records, source records, or responsive content.

## Audit requirement

A successful workspace load must first record:

- action: `legal_transparency_reporting_workspace_view_attempt`
- target type: `legal_transparency_reporting_registry`
- target id: `null`

Audit metadata:

- surface: `/admin/legal-operations/transparency-reporting`
- foundation version: `20260809064500`
- mode: `methodology_only`
- aggregation execution enabled: `false`
- publication enabled: `false`

If audit recording fails, the route fails closed and does not return the registry.

## Readiness verification

Run:

```bash
pbcopy < scripts/verification/legal-transparency-reporting-foundation-readiness.sql
```

Paste the query into the linked production Supabase SQL Editor.

Every readiness row must return `PASS` before the controlled production workspace test.

The verifier confirms, among other controls:

- dedicated review capability exists and is default-off
- transparency review status exists and defaults to unreviewed
- new request reportability default is false
- existing requests are not silently auto-reviewed
- the authoritative request-review trigger protects all transparency fields
- registry table and required columns exist
- RLS is enabled
- browser privileges and policies are absent
- service role has SELECT only
- all twelve methodology controls exist
- publication methodology remains unapproved
- aggregate execution remains disabled
- publication remains disabled
- request-specific data remains disallowed
- counsel review remains required
- suppression and public-release gates remain closed
- no transparency snapshot/publication tables exist
- no aggregate/publication write RPC exists
- export, disclosure, and emergency approval authorities remain disabled

## Controlled production rollout

After merge and application deployment:

1. Run `supabase db push --linked --dry-run`.
2. Confirm only `20260809064500_create_legal_transparency_reporting_foundation.sql` is pending.
3. Apply the migration.
4. Run the readiness verifier and require all PASS.
5. Before enabling the new capability, open the workspace and confirm fail-closed restricted access.
6. Enable only `can_review_transparency_reporting` for exactly one already-authorized fictional-workflow Legal Reviewer.
7. Reconfirm `can_export = false`, `can_disclose = false`, and `can_approve_emergency = false` for all active authorizations.
8. Reopen the workspace and confirm the twelve methodology controls, zero approved publication controls, zero aggregate execution, and counsel review required for all controls.
9. Verify the latest `legal_transparency_reporting_workspace_view_attempt` audit row.

## Completion boundary

Completion of this phase means Loombus has a restricted, auditable, methodology-only foundation for future aggregate transparency reporting.

It does **not** mean Loombus has:

- an approved public transparency-report methodology
- an approved public request taxonomy
- an approved jurisdiction taxonomy
- an approved outcome taxonomy
- an approved reporting period
- an approved suppression threshold
- aggregate snapshot generation
- a public transparency-report page
- publication authority
- export authority
- disclosure authority
- emergency approval authority

Those remain separate future phases and require qualified counsel where substantive legal methodology or public claims are involved.
