# Issue #667: Restricted Trust and Safety Case System

Status: implementation pending production verification  
Prepared: July 28, 2026  
Validation refresh requested: July 28, 2026  
Public ready: no  
Owner: Internal Trust and Safety Lead

## Purpose

This implementation provides the restricted, auditable case-record foundation required by the internal Trust and Safety escalation SOP.

It does not publish a severe-harm policy, create continuous monitoring, provide emergency dispatch, establish a guaranteed response time, appoint a backup owner, approve legal obligations, or establish final retention periods.

## Data model

The foundation creates three service-only tables:

- `trust_safety_cases` for case identity, severity, category, workflow state, allegations, observed facts, unresolved facts, reviewer inference, containment, decision, notice, preservation state, and target references;
- `trust_safety_case_evidence_refs` for minimum-necessary references to existing records, storage identifiers, and hashes without creating a new raw-media evidence repository;
- `trust_safety_case_events` for append-only case creation, change, access, evidence, handling, routing, and closure history.

Case numbers use the internal format `TS-YYYY-NNNNNN`.

The hardening migration adds two database-enforced invariants:

- an event that identifies an evidence reference must use evidence belonging to the same case;
- later edits to an already closed case preserve the original `closed_at` and `closed_by` values, while an authorized reopening clears them and a later re-closure creates new closure metadata.

## Access contract

- Browser clients do not receive direct table privileges.
- `anon` and `authenticated` receive no table privileges.
- Application access is through `/api/admin/trust-safety/cases`.
- The route verifies the authenticated member and `profiles.is_admin` before using the service client.
- Opening a case fails closed when the case-access event cannot be recorded.
- Writes are also recorded in the existing `audit_logs` contract.
- Case events cannot be updated or deleted, including by the service path.
- Case, evidence-reference, and event tables do not grant deletion privileges to the service role.

## Evidence boundary

The workspace stores references and operational metadata only. It must not be used to store:

- raw illegal sexual material;
- duplicated traumatic media;
- passwords or authentication secrets;
- full payment-card numbers;
- unnecessary government identifiers;
- unnecessary medical information;
- public GitHub evidence or ordinary-chat case notes.

Existing hashes, record IDs, table names, timestamps, and storage references may be recorded when necessary and proportionate.

## Administrator workspace

The restricted workspace is available at:

`/admin/reports/trust-safety`

The existing `/admin/reports` page links to it. The workspace supports:

- case creation and generated case numbers;
- S1 through S4 severity;
- category and workflow status;
- separate allegations, observations, unresolved facts, and inference;
- containment, decision, rationale, external-routing, notice, and preservation fields;
- evidence references without raw-media duplication;
- append-only handling and specialist-routing events;
- automatic authorized-access events.

Public-facing text and reusable labels use role titles only. No individual Trust and Safety owner name is added.

## Deployment order

1. Merge and deploy the application changes.
2. Apply `supabase/migrations/20260802120000_create_trust_safety_case_system.sql`.
3. Apply `supabase/migrations/20260802120500_harden_trust_safety_case_invariants.sql`.
4. Run `scripts/verification/trust-safety-case-system-readiness.sql` and require every row to return `PASS`.
5. Sign in as an authorized administrator and open `/admin/reports/trust-safety`.
6. Create a fictional S4 test case without real member data or harmful material.
7. Confirm a generated case number, case-created event, and audit record.
8. Update severity, status, factual fields, and decision fields; confirm append-only change events.
9. Add a fictional evidence reference containing only a synthetic record ID and synthetic hash.
10. Add a handling event and confirm it cannot be edited or deleted through the database contract.
11. Confirm an event cannot reference evidence belonging to a different fictional case.
12. Reopen the case and confirm an authorized access event is added.
13. Close the fictional case and confirm `closed_at`, `closed_by`, and the closure event.
14. Edit another field while the case remains closed and confirm the original closure timestamp and closer are preserved.
15. Delete no production evidence. Retain or remove the synthetic test record only under an approved test-data procedure.

## Completion boundaries

Merging and verifying this system satisfies only the restricted case-record and access-audit foundation. Issue #667 must remain open until its remaining gates are supported by evidence, including:

- appointed and trained backup ownership;
- qualified legal and specialist review;
- Issue #668 retention and deletion decisions;
- Issue #674 legal-request, preservation-request, and emergency-disclosure operations;
- controlled synthetic severe-harm scenarios;
- support and Room moderation escalation training;
- verified mailbox access and recovery controls.
