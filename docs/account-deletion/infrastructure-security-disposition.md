# Infrastructure, Security, Fraud, Access, and Incident Disposition

## Status

- Issue: #668
- Disposition: manual review
- Destructive handling: not implemented
- Account-deletion worker dispatch: not implemented

## Purpose

This document defines the account-deletion boundary for infrastructure, security, fraud, access, abuse-prevention, and incident records. Account deletion does not itself authorize deletion of records required to secure Loombus, investigate abuse, reconstruct incidents, prove administrator activity, comply with legal obligations, or defend against fraud and disputes.

## Resource family

The resource key for this phase is `infrastructure_security_and_incident_records`.

The resource family includes:

- Vercel request, function, build, deployment, edge, firewall, and runtime logs
- Supabase authentication, database, API, Storage, Realtime, and platform logs
- application error, diagnostic, performance, tracing, and operational telemetry
- administrator access, impersonation, moderation, configuration, and privileged-action history
- sign-in events, session evidence, IP addresses, user agents, device identifiers, and authentication risk signals
- rate-limit, anti-abuse, spam, bot, scraping, credential-stuffing, and fraud indicators
- security alerts, incident cases, investigation notes, containment actions, and remediation evidence
- webhook, queue, scheduler, retry, dead-letter, and idempotency records used for operational integrity
- audit exports, support escalations, legal holds, forensic snapshots, caches, backups, replicas, and vendor copies

## Systems of record

No single canonical table is assumed.

Potential systems of record include:

- Supabase database tables and audit functions
- Supabase Auth and platform-managed logs
- Vercel project and deployment logs
- application runtime logging and observability providers
- source-control, deployment, and administrator-operation audit history
- support, Trust and Safety, billing, fraud, and incident-management systems
- backups, replicas, exports, and vendor-controlled copies

The production inventory, retention controls, export paths, regional storage, and deletion capabilities for each system remain subject to verification.

## Account-deletion rules

1. Account deletion is not log deletion, incident closure, fraud clearance, or audit-history removal.
2. Direct identifiers may be removed, tokenized, pseudonymized, detached, or retained only under an approved resource-specific contract.
3. Security and fraud records must preserve event integrity, timestamps, actor relationships, evidence chains, and administrator accountability.
4. Records linked to other users, recipients, Rooms, administrators, incidents, transactions, reports, or legal matters require role-aware review.
5. Active sessions, credentials, secrets, and future access are separate from historical security evidence. Credential revocation does not imply evidence deletion.
6. Vendor-held logs and backups require provider-specific verification and cannot be represented as immediately deleted without evidence.
7. Any approved mutation must produce an exception report identifying retained records, legal holds, vendor copies, backup expiry, and verification results.

## Retention exceptions

Manual review must consider:

- active or suspected security incidents
- fraud, spam, abuse, bot activity, scraping, or account compromise
- payment disputes, chargebacks, refund investigations, or account takeover
- Trust and Safety investigations, appeals, severe-harm cases, or law-enforcement requests
- legal holds, preservation obligations, litigation, regulatory inquiries, or insurance matters
- administrator accountability, privileged access, configuration changes, and incident reconstruction
- system reliability, debugging, outage analysis, and data-integrity investigations
- suppression, rate-limiting, credential-abuse prevention, and repeat-offender detection

## Vendor boundary

Vercel, Supabase, observability vendors, email and push providers, source-control systems, support systems, and other infrastructure subprocessors may retain logs or backups under their own controls. Their retention periods, deletion APIs, immutable audit behavior, backup expiry, subprocessors, and regional processing must be verified before Loombus publishes precise commitments.

## Verification requirements

Before an executable disposition is approved, the accountable owners must verify:

- the complete production log and incident inventory
- which records contain direct or indirect user identifiers
- normal retention and backup-expiration periods
- access roles and administrator permissions
- legal, security, fraud, billing, safety, and dispute exceptions
- pseudonymization or detachment feasibility without breaking forensic integrity
- vendor deletion and export capabilities
- verification queries for first-party records
- evidence that future access is revoked while historical evidence is preserved appropriately
- exception-report output for retained or vendor-controlled records

## Safety boundary

This disposition adds no log deletion, anonymization, detachment, incident mutation, session revocation, credential mutation, provider API call, cache purge, backup purge, or worker dispatch. `ACCOUNT_DELETION_DESTRUCTIVE_HANDLERS_ENABLED` remains unchanged.
