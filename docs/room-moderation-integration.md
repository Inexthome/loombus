# Room Moderation Integration Contract

Room moderation connects member reports to one Room-scoped review queue.

## Reporting

- Active Room members may report only discussions and replies they are authorized to view.
- Customer Support case visibility remains enforced before a report can be created.
- A report captures an evidence snapshot at submission time.
- The evidence snapshot remains available if the original content is later removed.
- Duplicate open reports from the same reporter for the same target are consolidated.
- Active Room owners, administrators, and moderators are notified about new reports.

## Review workflow

- Room moderation staff may claim or assign a case.
- Cases support low, normal, high, and urgent priority.
- Escalation marks a case urgent and records the actor and time.
- Staff may resolve or dismiss a case with a resolution note and action.
- The original reporter receives a resolution notification.
- Every report and staff action is written to the audit log.

## Privacy and retention

- Evidence snapshots must not widen access to private Customer Support cases.
- Open and reviewing moderation cases remain automatic retention exclusions.
- Resolution does not permanently delete original Room content.
- Content removal and member sanctions remain separate authorized actions.
