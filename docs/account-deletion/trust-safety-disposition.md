# Trust and Safety account-deletion disposition

Status: disposition defined, no destructive handler approved

## Scope

This disposition covers member reports, Room reports, moderation queues, trust-and-safety cases, safety-review results, enforcement decisions, account restrictions, appeals, administrator notes, evidentiary attachments, support escalations, underage-account reports, age-correction review records, fraud and coordinated-abuse investigations, legal holds, and related audit history.

It also covers derived or copied evidence held in Supabase Database and Storage, administrator exports, application logs, notification and email delivery records, support systems, infrastructure providers, backups, replicas, caches, and subprocessors.

## Core rule

Account deletion is not evidence deletion. A member can simultaneously be a reporter, subject, witness, administrator, Room owner, moderator, support requester, or affected third party. Trust and Safety records can contain multiple people's rights and can be necessary to investigate severe harm, enforce prior decisions, defend appeals, prevent repeat abuse, satisfy legal obligations, or document administrator conduct.

No automated deletion, anonymization, detachment, archive, or rewrite is approved for this resource.

## Systems of record

The reviewed repository establishes feature-specific records rather than one universal case table. Relevant families include:

- trust and safety cases and queues
- content, account, Room, commerce, age-safety, and underage reports
- moderation and safety-model review results
- enforcement decisions, restrictions, bans, suspensions, removals, and reasons
- appeals and administrator review actions
- safety notes, investigation notes, evidence references, and audit history
- support cases and escalations that become safety, fraud, billing, or legal evidence
- notifications and email records proving submission or outcome delivery
- Storage objects and external attachments used as evidence

Exact table, bucket, vendor, and field coverage must be verified against production before a retention period or terminal disposition is approved.

## Required disposition sequence

1. Inventory every case, report, note, decision, appeal, evidence object, support record, delivery record, export, log, and vendor copy linked to the member.
2. Classify the member's role in each record. Reporter, subject, witness, moderator, owner, recipient, and administrator roles have different continuity requirements.
3. Identify open investigations, unresolved appeals, active restrictions, repeat-abuse links, fraud or chargeback matters, litigation or regulatory requests, emergency disclosures, and legal holds.
4. Preserve the minimum record needed for case integrity, recipient continuity, administrator accountability, enforcement consistency, fraud prevention, and legal obligations.
5. Consider approved minimization only after the case is closed, appeal periods and dispute windows are complete, no hold applies, and downstream evidence copies are mapped.
6. Verify public and member-visible attribution separately from restricted internal evidence. Removing a public profile must not silently corrupt case history.
7. Verify Storage, notifications, email, logs, exports, caches, backups, replicas, and vendors separately.
8. Record the decision, reviewer, basis, affected identifiers, exceptions, verification evidence, and unresolved copies in the account-deletion exception report.

## Preservation and minimization boundaries

Possible later actions may include restricted access, pseudonymous subject references, redaction of unnecessary contact data, or expiration of duplicate operational copies. Those actions require an approved case-type rule and must not:

- delete or alter evidence needed to assess the original conduct
- erase the existence or rationale of an enforcement decision
- break an appeal, audit, legal-hold, fraud, or repeat-abuse relationship
- expose reporter, victim, minor, witness, or administrator identities
- remove records required to prove notice, consent, escalation, or outcome delivery
- treat a closed case as automatically eligible for immediate deletion

## Exceptions requiring preservation

- active or reasonably anticipated legal hold, litigation, law-enforcement request, regulatory inquiry, or emergency disclosure review
- child safety, sexual exploitation, credible threats, self-harm escalation, non-consensual intimate imagery, doxxing, or other severe-harm evidence
- fraud, spam, coordinated manipulation, account evasion, payment dispute, or security investigation
- pending or recently completed appeal, complaint, support escalation, or administrator review
- active suspension, ban, restriction, Room action, commerce action, or repeat-offender linkage
- records needed to protect reporters, victims, minors, witnesses, recipients, moderators, or administrators

## Unresolved retention decisions

No universal duration is approved for Trust and Safety data. Case families require distinct normal-retention periods, appeal windows, evidence rules, and exceptions. Production vendor retention, Storage lifecycle, support-system retention, log retention, backup expiration, access roles, and legal requirements remain unverified.

Public Privacy, Retention, Reporting, Enforcement, Appeals, Teen Safety, and Support documents must not publish unsupported deletion timelines.

## Verification requirements

An approved future workflow must produce evidence that:

- every applicable case family and member role was inventoried
- open cases, appeals, restrictions, holds, and severe-harm exceptions were checked
- public attribution and internal evidence were handled independently
- evidence objects and delivery records remain linked where preservation is required
- access remains restricted to authorized roles
- Storage, logs, exports, backups, replicas, caches, and vendors were separately reviewed
- the account-deletion exception report lists every preserved or unresolved copy and its accountable owner

## Safety boundary

This disposition adds no case mutation, report deletion, evidence deletion, anonymization, archive, appeal closure, enforcement reversal, Storage deletion, provider API call, account-deletion worker dispatch, or feature-flag change.