# Issue #674: Disclosure Preparation Capability Separation

## Purpose

This follow-up narrows authorization after the Disclosure Preparation Controls production-readiness pass.

PR #853 correctly keeps export generation, disclosure approval, emergency approval, member-notice sending, and external transmission unavailable. Its API gate initially reused `can_export` for preparation access, however. That would make future export authority ambiguous once export generation is implemented.

## Corrected authorization boundary

`can_prepare_disclosure` is now the only capability used to enter the disclosure-preparation API.

It permits only the already-deployed preparation operations:

- create restricted draft disclosure metadata;
- update restricted draft disclosure metadata;
- append least-data manifest field metadata.

It does not authorize:

- source-data collection or export generation;
- export-package creation;
- manifest finalization or export hashes;
- disclosure approval;
- emergency-disclosure approval;
- member-notice sending;
- external transmission.

`can_export`, `can_disclose`, and `can_approve_emergency` remain separate and disabled during this controlled phase.

## Deployment order

1. Keep `ACCOUNT_DELETION_DESTRUCTIVE_HANDLERS_ENABLED` disabled.
2. Keep `ROOM_PERMANENT_DELETION_ENABLED` disabled.
3. Keep all existing Legal Operations capability assignments unchanged.
4. Apply `20260808114000_add_legal_disclosure_preparation_capability.sql`.
5. Run `scripts/verification/legal-disclosure-preparation-capability-readiness.sql` and require every row to return `PASS`.
6. Only after that verifier passes, enable `can_prepare_disclosure` for the single already-authorized fictional-workflow tester without enabling `can_export`, `can_disclose`, or `can_approve_emergency`.
7. Use fictional legal-request metadata, fictional recipient metadata, fictional record references, and fictional field names only.

No real request, member data, actual export, disclosure, notice, or external contact belongs in this phase.
