# Issue #674 — Disclosure Preparation Controls

## Purpose

This phase enables only restricted preparation of draft disclosure-control metadata and a least-data disclosure manifest. It does not generate an export, authorize a disclosure, approve an emergency disclosure, send a member notice, or transmit data to an external recipient.

Qualified counsel review remains required before any downstream disclosure procedure or template is treated as approved.

## Main-branch audit before implementation

The implementation begins from `main` after merged PR #852.

Already deployed and intentionally not rebuilt here:

- Legal Operations storage foundation and append-only audit model;
- restricted Legal Operations workspace and dual authorization boundary;
- preservation-hold creation, target, activation, expiry, and release lifecycle;
- exact legal-hold enforcement for account-deletion database paths;
- exact legal-hold enforcement for Room permanent-deletion database paths;
- Room Storage pre-remove hold guard.

The existing foundation already contains `legal_disclosures` and append-only `legal_disclosure_items`, so this phase does not add another disclosure table or copy source records into a new system.

## Authorization boundary

The preparation workspace requires all of the following:

1. authenticated Loombus user;
2. platform administrator status;
3. active `legal_operations_authorizations` row;
4. `can_export=true`.

In this phase, `can_export` authorizes **preparation controls only**. There is no export-generation operation behind the preparation API. The deployed Legal Reviewer currently remains `can_export=false` until a separate controlled authorization step is performed after the migration and readiness checks pass.

This PR does not grant or bootstrap `can_export`, `can_disclose`, `can_approve_emergency`, or `can_manage_access` for any person.

## Enabled operations

The restricted preparation API supports exactly three mutations:

- create disclosure metadata with status forced to `draft`;
- update metadata only while the disclosure remains `draft`;
- append a least-data manifest item to a draft disclosure.

Draft disclosure metadata may record:

- disclosure type;
- legal-basis summary;
- narrowed disclosure scope;
- intended recipient organization and contact reference;
- member-notice decision metadata;
- delayed-notice basis metadata.

These fields are planning and review metadata. Recording them does not establish legal sufficiency, approval, or authorization to disclose.

## Least-data manifest contract

A manifest item records only:

- resource key when available;
- source system;
- record locator/reference when available;
- explicit intended field names;
- minimum-necessary justification;
- actor and creation time.

The preparation RPC enforces all of the following:

- disclosure must belong to the selected legal request;
- disclosure must still be `draft`;
- 1–50 explicit field names are required;
- blank field names and broad wildcards such as `*`, `all`, and `all_fields` are rejected;
- field names are normalized and deduplicated;
- `object_count=0`;
- `file_name=null`;
- `sha256=null`;
- `metadata={}`;
- manifest rows remain append-only;
- an append-only request-history event is written in the same database transaction.

The manifest describes what may later be considered for collection. It is not an export package and contains no responsive source payload.

## Database privilege hardening

The foundation originally granted service-role INSERT/UPDATE on `legal_disclosures` and INSERT on `legal_disclosure_items` for future phases. This phase removes those direct mutation privileges.

The service role retains read access but may prepare disclosure records only through three service-only SECURITY DEFINER RPCs:

- `legal_create_disclosure_draft(...)`;
- `legal_update_disclosure_draft(...)`;
- `legal_add_disclosure_manifest_item(...)`.

`anon` and `authenticated` receive no execute privilege on these RPCs. Direct browser access to the legal tables remains unavailable.

## Explicitly disabled

This phase contains no operation for:

- querying source systems for responsive records;
- copying message bodies, discussion content, Room content, files, attachments, logs, billing records, support records, AI records, or other member data into a disclosure package;
- generating files or archives;
- calculating export object counts;
- calculating a package or manifest SHA-256;
- advancing a disclosure to `awaiting_approval` or `approved`;
- disclosure approval;
- emergency-disclosure approval;
- member notice sending;
- external email, portal, API, file-transfer, or other transmission;
- contacting a requester, agency, court, regulator, rights holder, member, or other external party.

The preparation API explicitly rejects operation names associated with these downstream actions.

## Destructive-feature safety

This phase does not modify either destructive feature flag:

- `ACCOUNT_DELETION_DESTRUCTIVE_HANDLERS_ENABLED` remains disabled;
- `ROOM_PERMANENT_DELETION_ENABLED` remains disabled.

It does not alter the exact legal-hold enforcement deployed by PR #851 or the Room Storage pre-remove hold guard deployed by PR #852.

## Deployment and controlled-test order

1. Merge and deploy the application while existing Legal Operations authorization remains unchanged.
2. Keep `can_export=false` during initial deployment.
3. Apply `supabase/migrations/20260808111500_restrict_legal_disclosure_preparation.sql`.
4. Run `scripts/verification/legal-disclosure-preparation-readiness.sql` and require every row to return `PASS`.
5. Confirm `can_disclose=false` and `can_approve_emergency=false` remain unchanged.
6. Only for controlled testing, authorize preparation for an already-authorized administrator by setting `can_export=true` through the existing controlled Legal Operations authorization process.
7. Use fictional request metadata, fictional recipient metadata, fictional record locators, and fictional field names only.
8. Verify draft creation, draft edit restrictions, wildcard rejection, append-only manifest history, zero object count, null file/hash fields, and fail-closed authorization behavior.
9. Confirm there is still no UI/API action for export generation, approval, emergency approval, member notice sending, or external transmission.
10. Do not progress to actual export collection or disclosure testing until a separately reviewed phase and qualified counsel approval.

## Production testing prohibition for this phase

Do not use:

- real legal requests;
- real member identifiers or member content;
- actual responsive records;
- real requester or agency contact details;
- actual exports or disclosure packages;
- actual member notices;
- any external transmission or contact.

Successful technical testing of this preparation phase is not legal approval of a disclosure workflow.
