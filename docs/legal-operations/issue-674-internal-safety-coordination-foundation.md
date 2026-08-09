# Issue #674 — Internal Safety Coordination Foundation

## Status

Foundation-only implementation for restricted internal coordination between Legal Operations and the existing Trust and Safety case system.

This phase does **not** define a substantive child-safety, imminent-danger, emergency-disclosure, law-enforcement, or external-reporting standard. It does not contact an outside party, create an external report, approve an emergency disclosure, collect responsive source data, generate an export, disclose data, transmit data, send a member notice, or mutate Trust and Safety case state.

Qualified counsel review remains required before any substantive emergency standard, mandatory external-reporting procedure, law-enforcement coordination procedure, disclosure approval/execution, final member-notice action, or public guideline.

## Audit finding

The existing restricted Trust and Safety case system already provides:

- structured cases with severity, category, status, assignment, and minimum case metadata;
- high-risk categories including `child_safety`, `sexual_exploitation`, `sextortion`, `credible_threat`, `self_harm`, `trafficking`, and `dangerous_organization`;
- `awaiting_legal` and `awaiting_specialist` case states;
- append-only case events including `specialist_routing`;
- evidence references rather than a new raw-evidence store;
- access auditing and service-role-backed case access.

However, there is no structured Legal Operations coordination record linking a Trust and Safety case to the Legal Operations side. The existing `external_escalation_status` field on `trust_safety_cases` is free-text case metadata and is writable through the general Trust and Safety admin workflow. It is therefore not an appropriate legal external-reporting or emergency-disclosure control.

The child-safety and threats internal drafts also explicitly identify emergency, preservation, external-reporting, law-enforcement ownership, and qualified legal review as publication blockers. This foundation addresses only the internal handoff-record gap and leaves those substantive blockers in place.

## Narrow scope

This phase adds:

- `legal_operations_authorizations.can_coordinate_safety boolean not null default false`;
- `public.legal_safety_coordination` as a restricted service-only metadata table;
- a database-authoritative authorization and revision trigger;
- a restricted `/admin/legal-operations/safety-coordination` workspace;
- a read-only production readiness verifier.

No existing Trust and Safety table, route, case, event, evidence reference, or case state is modified by this phase.

## Internal coordination record

`legal_safety_coordination` stores only:

- a reference to one existing `trust_safety_cases` row;
- an optional reference to one existing `legal_requests` row;
- an administrative coordination type;
- a draft-only coordination status;
- a minimum internal handoff-reason summary;
- a minimum-necessary reason;
- the assigned Legal Operations reviewer;
- revision and actor/timestamp metadata.

The Trust and Safety case reference is immutable after creation. The table does not copy Trust and Safety case summaries, evidence, member messages, attachments, Storage objects, victim details, or raw content.

## Coordination labels are not substantive standards

Allowed coordination types are:

- `child_safety`
- `imminent_danger`
- `high_risk_safety`

These are **administrative internal-routing labels only**. They do not establish a legal threshold, reporting obligation, emergency criterion, disclosure basis, or external-contact authority.

Allowed statuses are only:

- `draft`
- `legal_review_requested`
- `legal_review_acknowledged`
- `requires_counsel`

There is no `approved`, `authorized`, `reported`, `contacted`, `disclosed`, `transmitted`, `sent`, `final`, or equivalent state.

## Database-authoritative separation

A SECURITY DEFINER trigger function `legal_enforce_safety_coordination_authorization()` protects inserts and updates.

Every coordination change requires:

1. an identified actor;
2. active `can_review_requests=true`;
3. active `can_coordinate_safety=true`;
4. exact revision control on updates.

An `imminent_danger` coordination record additionally requires active `can_review_emergency=true`.

That additional requirement grants no emergency approval authority. `can_approve_emergency` remains a separate capability and must remain disabled.

Browser roles have no direct table privileges and no execute privilege on the authorization trigger function. Service role receives only SELECT, INSERT, and UPDATE on the coordination table. DELETE is intentionally absent.

## Restricted workspace

The workspace queries only minimum Trust and Safety case metadata:

- case ID
- case number
- severity
- primary category
- case status
- updated time

It does not load Trust and Safety case summaries, reported-risk text, observed facts, unresolved facts, reviewer inference, containment notes, decisions, evidence references, member content, messages, attachments, or Storage objects.

The workspace does not mutate `trust_safety_cases` or `legal_requests`.

The only supported mutation operations are:

- `create_coordination_draft`
- `update_coordination_draft`

No external-report, external-contact, emergency-approval, export, disclosure, transmission, or notice-send operation exists on this route.

## Audit behavior

Successful workspace access records `legal_safety_coordination_workspace_view_attempt` with:

- surface `/admin/legal-operations/safety-coordination`
- foundation version `20260809084500`
- mode `internal_coordination_only`
- substantive standard approved = false
- Trust and Safety case mutation enabled = false
- Legal Request mutation enabled = false
- external reporting enabled = false
- external contact enabled = false
- emergency approval enabled = false
- disclosure enabled = false
- export enabled = false
- external transmission enabled = false

Create/update attempt audit metadata records only field names, coordination labels/status, IDs/revisions, and disabled-control flags. The two free-text coordination summaries are not copied into the global audit log.

## Production readiness

Run `scripts/verification/legal-safety-coordination-foundation-readiness.sql` after the migration is applied. Every row must return `PASS` before controlled UI validation.

The verifier checks, among other things:

- dedicated capability presence/default-off state;
- no automatic capability enablement;
- coordination table presence and RLS;
- no browser table privileges;
- no service-role DELETE;
- service-role SELECT/INSERT/UPDATE only;
- draft-only status constraint;
- administrative coordination-type constraint;
- SECURITY DEFINER authorization boundary;
- `can_review_requests` + `can_coordinate_safety` enforcement;
- additional `can_review_emergency` requirement for `imminent_danger`;
- exact revision control;
- immutable Trust and Safety case reference;
- enabled authorization/update triggers;
- no browser execute privilege on the authorization trigger function;
- no automatically created coordination rows;
- no external-action RPCs;
- `can_export=0`;
- `can_disclose=0`;
- `can_approve_emergency=0`.

## Controlled production order

1. Merge and deploy application changes only after CI and preview validation.
2. Run `supabase db push --linked --dry-run` and require the only pending migration to be `20260809084500_add_internal_safety_coordination_foundation.sql`.
3. Apply only that migration.
4. Run the readiness verifier and require every row to return `PASS`.
5. While `can_coordinate_safety=false`, verify `/admin/legal-operations/safety-coordination` denies access.
6. If controlled UI review is desired, enable only `can_coordinate_safety` for the single established fictional-workflow Legal Reviewer using a fail-closed one-row update.
7. Reconfirm `can_export=0`, `can_disclose=0`, and `can_approve_emergency=0` before opening the workspace.
8. Validate that only minimum Trust and Safety case metadata is visible.
9. If no eligible fictional Trust and Safety case already exists, do **not** create a real or artificial high-risk case merely to exercise the editor. An empty metadata-only workspace is an acceptable positive-access test.
10. Verify the workspace-view audit record read-only.

## Explicitly deferred

The following remain outside this phase:

- substantive child-safety reporting criteria or legal obligations;
- substantive imminent-danger or emergency-disclosure criteria;
- assignment of external child-safety, NCMEC, law-enforcement, or emergency-contact owners;
- NCMEC or any other external reporting integration;
- law-enforcement or emergency-service contact;
- requester or recipient external contact;
- automatic Trust and Safety case mutation or routing;
- automatic Legal Request creation or mutation;
- `can_approve_emergency` enablement;
- source-data collection;
- export generation;
- disclosure approval or execution;
- external transmission;
- member-notice sending;
- fixed emergency response-time promises;
- public law-enforcement, child-safety, or emergency-disclosure guidelines;
- any destructive account or Room deletion enablement.

`ACCOUNT_DELETION_DESTRUCTIVE_HANDLERS_ENABLED` and `ROOM_PERMANENT_DELETION_ENABLED` must remain disabled.
