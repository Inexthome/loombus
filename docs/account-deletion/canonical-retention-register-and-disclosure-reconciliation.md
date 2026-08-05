# Canonical retention register and disclosure reconciliation

Issue: #668

## Purpose

This document closes the policy-design phase for Loombus account deletion by defining how the canonical account-deletion resource registry, resource-specific disposition documents, exception reporting, user export, deletion disclosures, Room staged deletion, public policy language, and quarterly governance must remain aligned.

It does not authorize destructive execution. Every resource remains governed by its registered disposition, handler approval state, legal and operational exceptions, verification requirements, and feature flags.

## Canonical sources

The canonical machine-readable inventory is `public.account_deletion_resource_registry`.

The canonical human-readable evidence is the account-deletion documentation set under `docs/account-deletion/`, including architecture, public content, private messaging, Rooms, commerce, Search, AI, billing, Trust and Safety, notification delivery, infrastructure and security, and Storage or vendor-copy dispositions.

A public policy, help-center statement, administrator workflow, export response, or deletion confirmation must not contradict either canonical source.

## Required register fields

Each resource entry must identify or preserve:

- resource key and data class
- system of record
- purpose and operational or legal basis
- normal retention rule or an explicit statement that the period is not yet approved
- deletion, anonymization, detachment, archive, or manual-review trigger
- execution mode and approved handler status
- legal hold, fraud, safety, billing, dispute, recipient, Room, organization, and support exceptions
- backup, replica, cache, export, and vendor-copy treatment
- access roles and accountable owner
- verification requirements and unresolved dependencies

Unsupported timelines are prohibited. Where production behavior or provider retention remains unverified, the register must say so rather than publishing a specific period.

## Exception report contract

Account-deletion orchestration must produce one exception report before terminal completion. The report must include, for every unresolved or retained resource:

- account-deletion request identifier
- resource key and affected system
- local and provider identifiers where appropriate
- disposition reached
- retained, transferred, detached, anonymized, archived, expired, or unresolved status
- exception category and rationale
- legal hold or case reference where applicable
- accountable reviewer and review time
- expected expiry or next-review date when known
- verification result and evidence reference
- unresolved vendor, backup, replica, cache, export, recipient, Room, or organization copy

A request must not be reported as fully deleted when the exception report contains unresolved retained copies. User-facing completion language must distinguish account closure, access revocation, first-party deletion, scheduled expiry, and unresolved external copies.

## Export reconciliation

User data export must map to the same resource classes as the retention register. Export documentation must state:

- which first-party data classes are included
- which shared, recipient-controlled, Room, organization, evidence, security, billing, or vendor-held records may be excluded or represented indirectly
- that an export is not a complete inventory of backups, replicas, caches, logs, or provider copies
- that omission from an export does not itself prove deletion

Any new production data class must be added to both the register and the export coverage review before release.

## Deletion disclosure reconciliation

Deletion disclosures must accurately distinguish:

- immediate access revocation from historical-record disposition
- deletion from anonymization, detachment, transfer, archive, or scheduled expiry
- first-party records from recipient-controlled or vendor-held copies
- account deletion from subscription cancellation, payment-record retention, Room ownership transfer, case closure, or evidence deletion
- normal deletion from legal hold, fraud, safety, billing, dispute, support, recipient-continuity, Room, organization, and administrator-accountability exceptions

No disclosure may promise immediate deletion from backups, replicas, caches, exports, logs, or third-party providers unless verified evidence supports that statement.

## Room staged deletion

Room staged deletion remains independent from member account deletion.

A member deletion request must not bypass Room ownership transfer, governance continuity, billing resolution, member or recipient continuity, legal holds, lifecycle manifests, evidence retention, or the separate Room permanent-deletion feature gate.

`ROOM_PERMANENT_DELETION_ENABLED` remains unchanged. Account deletion must not be presented as immediate Room deletion.

## Public policy review

Before publishing or changing Privacy, Retention, Help Center, account-deletion, or export language:

1. Map each statement to one or more registry resources.
2. Confirm the stated behavior exists in production or is explicitly marked as planned.
3. Confirm provider, backup, replica, cache, and export behavior.
4. Confirm Room staged deletion and recipient continuity are accurately described.
5. Remove unsupported dates, periods, or guarantees.
6. Record the reviewer, evidence, approval date, and affected resource keys.

## Quarterly ownership and change process

The accountable owner is the Privacy and Data Governance owner, with required review from Engineering, Trust and Safety, Security, Billing or Finance, Support, and Legal or policy counsel where applicable.

A quarterly review must:

- inventory new and changed production tables, Storage buckets, logs, providers, exports, queues, caches, backups, replicas, and subprocessors
- compare production resources to the registry
- verify handler, feature-flag, and execution-mode states
- review unresolved exception categories and provider evidence
- reconcile export and deletion disclosures
- verify Room staged-deletion language
- record approvals, gaps, remediation owners, and due dates

Any schema, vendor, feature, billing, safety, Room, export, or deletion-workflow change that creates or changes personal-data handling must update the register and disclosure review in the same release or remain blocked from production.

## Current completion boundary

Issue #668 defines the platform-wide inventory and decision framework. It does not, by itself, approve destructive handlers, establish unverified retention periods, call provider deletion APIs, or prove that every production copy is currently deletable.

`ACCOUNT_DELETION_DESTRUCTIVE_HANDLERS_ENABLED` and `ROOM_PERMANENT_DELETION_ENABLED` remain unchanged.