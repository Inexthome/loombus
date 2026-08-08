# Issue #674: Legal request, preservation, and disclosure foundation

Status: internal implementation foundation
Prepared: August 8, 2026
Tracks: Issue #674
Public ready: no
Qualified legal review: required

## Purpose

This document defines the first internal technical foundation for legal requests, preservation holds, emergency-disclosure review, disclosure manifests, and legal-operations access control.

It does not publish law-enforcement guidelines, create a response-time promise, authorize a real disclosure, determine whether a request is legally valid, require an external report, or substitute engineering judgment for qualified counsel.

## Existing platform foundations

Issue #674 builds on existing, verified Loombus controls rather than creating an unrelated parallel system:

- `legal@loombus.com` is the designated intake route for formal legal requests and law-enforcement correspondence in the internal Trust and Safety SOP.
- The restricted Trust and Safety case system established the service-only, RLS-enabled, append-only audit pattern used for sensitive operational records.
- `public.account_deletion_resource_registry` and `docs/account-deletion/` provide the canonical data-class map for database records, Storage, Rooms, messages, billing, Search, AI, notifications, security logs, backups, replicas, exports, and vendor copies.
- Account-deletion governance already requires legal-hold and case references in retained-copy exception reports and explicitly states that account deletion is not evidence deletion.

## Verified gap before this phase

Before this foundation, repository and operating evidence did not establish a dedicated system for:

- requester identity and authority verification;
- request type, jurisdiction, scope review, narrowing, deficiency, or rejection decisions;
- preservation-hold creation, extension, expiry, release, and target mapping;
- emergency-disclosure criteria and approval records;
- a dedicated legal-operations authorization boundary separate from ordinary platform-admin status;
- least-data disclosure manifests identifying exact resource classes and fields;
- disclosure recipient, legal basis, approver, transmission time, and integrity evidence;
- member-notice and delayed-notice decisions;
- cross-border or conflicting-law escalation state;
- aggregate transparency-reporting metadata.

The Trust and Safety case system may record preservation or legal-routing context, but it is not a legal-request ledger and does not itself create a preservation hold or disclosure record.

## Phase 1 database model

Migration `20260808080000_create_legal_operations_foundation.sql` creates service-only internal records.

### `legal_operations_authorizations`

Dedicated authorization records for legal operations. A future application route must require both normal authenticated platform administration and an active legal-operations authorization with the specific capability required for the action.

Capabilities are separated for:

- intake;
- preservation;
- export preparation;
- disclosure transmission;
- emergency-disclosure approval;
- access administration.

No browser role receives direct table access.

### `legal_requests`

One record per formal legal, regulatory, preservation, emergency, intellectual-property, or related request.

The record separates:

- request type;
- intake channel and receipt time;
- requester organization and contact reference;
- requester-identity verification state;
- jurisdiction and asserted authority;
- authority-review state;
- original scope and narrowed scope;
- counsel-review state;
- deficiency or rejection reason;
- emergency criteria, if applicable;
- cross-border/conflicting-law state;
- confidentiality and member-notice decisions;
- assignment and lifecycle status.

A legal request record is an operational record, not a determination that the request is valid or must be honored.

### `legal_preservation_holds`

Records a preservation decision linked to a legal request.

A hold records:

- legal or operational basis summary;
- scope summary;
- start time;
- optional expiry and next-review dates;
- approver;
- extension or release state.

An active hold does not silently change public visibility, member access, content status, Room status, billing state, or account standing. It records a preservation requirement that later destructive or expiry workflows must consult.

### `legal_preservation_hold_targets`

Append-only target references for an approved preservation hold. Targets may identify an account, profile, Discussion, reply, private message, Room, Storage object, billing record, support record, Search document, AI record, Trust and Safety case, audit/log record, notification/delivery record, vendor record, or another specifically documented resource.

Targets store references and metadata only. They do not copy the underlying content.

### `legal_request_events`

Append-only audit history for request creation, access, identity review, authority review, scope narrowing, deficiency/rejection, preservation, export/disclosure preparation, emergency review, notice decisions, specialist routing, status changes, and other handling actions.

Events cannot be updated or deleted through the service-role privilege contract.

### `legal_disclosures`

Disclosure control record. It records the disclosure type, legal basis summary, recipient, approval state, member-notice decision, transmission state, and manifest-integrity hash.

Creating a disclosure record does not transmit data.

### `legal_disclosure_items`

Append-only least-data manifest entries describing exactly what a proposed or completed disclosure contains. Each item records the resource class, source system, record reference, field names, row/object count, optional file name, integrity hash, and minimum-necessary justification.

The table stores disclosure metadata and hashes, not the disclosed payload itself.

## Preservation lookup contract

The migration adds `public.legal_hold_applies(...)`, callable only by `service_role`, to answer whether an active, non-expired preservation hold matches a subject or target reference.

This function is an integration primitive. Phase 1 does not wire it into account deletion, Room permanent deletion, ordinary retention expiry, Storage deletion, or provider deletion paths. Those destructive paths remain independently gated and must fail closed when legal-hold integration is added later.

## Access model

All Phase 1 legal-operations tables:

- have Row Level Security enabled;
- grant no table privileges to `public`, `anon`, or `authenticated`;
- are available only through the service role;
- grant no `DELETE` privilege to the service role;
- preserve request events and hold targets as append-only records.

Application access is intentionally deferred until a dedicated server route can enforce both platform-admin authentication and legal-operations capability checks. Ordinary `profiles.is_admin` status alone must not become sufficient for disclosure or preservation actions.

## Data-minimization rules

The legal-operations foundation stores operational metadata and references. It must not be used as an excuse to duplicate sensitive source data.

Do not place in legal-operations notes or manifests unless specifically necessary, approved, and protected:

- passwords, authentication secrets, or private keys;
- full payment-card data;
- unnecessary government identifiers;
- raw illegal sexual material;
- unnecessary intimate or traumatic media;
- unrelated members' private content;
- privileged or confidential material outside the approved request scope.

Prefer source record IDs, existing hashes, Storage references, timestamps, and field-level manifests over copied content.

## Emergency-disclosure boundary

Phase 1 provides fields and audit events for an emergency-disclosure review but does not define the legal threshold or authorize an emergency disclosure.

Until qualified counsel approves the process:

- an emergency request must remain a documented review state;
- engineering or Trust and Safety personnel must not invent legal authority;
- Loombus must not promise emergency dispatch or guaranteed response times;
- a real disclosure must not occur through this foundation alone.

## Chain of custody and export integrity

Phase 1 records disclosure manifests and SHA-256 integrity fields so a later export workflow can prove what was prepared and transmitted without storing the disclosed payload in the ledger.

The future export workflow must record, at minimum:

1. request and disclosure identifiers;
2. operator and approver;
3. resource class and source system;
4. exact exported fields;
5. record/object count;
6. export file or package name where applicable;
7. SHA-256 hash;
8. preparation time;
9. transmission time and recipient;
10. append-only chain-of-custody events.

## Integration sequence after Phase 1

1. Apply the Phase 1 migration and run the read-only readiness verifier.
2. Create the internal legal-operations server API with capability-specific authorization.
3. Add the restricted administrator workspace for request review, holds, disclosure manifests, and event history.
4. Bootstrap the first authorized legal-operations operator through a controlled database action; do not add a public self-enrollment path.
5. Add controlled export-package generation with field-level manifests and integrity hashes.
6. Wire active-hold checks into every approved destructive or expiry path, including account deletion and Room permanent deletion, before those paths can execute.
7. Run fictional request, preservation, deficiency, emergency-review, disclosure-manifest, release, and unauthorized-access scenarios.
8. Obtain qualified counsel approval for request-validation, emergency-disclosure, preservation, member-notice, and template procedures.
9. Only then consider public Law Enforcement Request Guidelines or Emergency Disclosure Guidelines.

## Completion boundaries

Phase 1 does not satisfy Issue #674 by itself. The issue remains open until:

- dedicated application authorization is implemented and tested;
- real destructive/expiry paths consult active legal holds;
- controlled export and disclosure audit workflows are verified;
- mailbox/intake identity-verification procedures are operationally tested;
- member-notice, deficiency, rejection, emergency, cross-border, and conflicting-law procedures are approved;
- retention for request and disclosure records is reconciled with Issue #668;
- qualified counsel approves the process and templates;
- public language is reviewed against actual production capability.
