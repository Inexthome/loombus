# V2 Create final readiness checklist

This checkpoint adds an internal checklist before any future change removes the final server guard.

## Added

- `/v2/create/readiness`
- Internal readiness checklist page.
- Link from the confirmation flow.
- Server checks for V2 shell access, draft validation, preview availability, and final guard status.

## Required checklist items

- Authenticated internal user.
- `v2_shell` access confirmed.
- Draft validation passes.
- Validated preview is available.
- Server hard lock remains active.
- V1 fallback remains preserved.
- Public rollout remains unchanged.

## Operational review items

- Moderation handoff reviewed.
- Notification behavior reviewed.
- Rollback plan documented.

## Safety

- Checklist only.
- Final server guard remains locked.
- No live action is enabled.
- V1 Create remains unchanged.
- Public navigation remains unchanged.
- Rollout percentage remains unchanged.

## Test plan

1. Open `/v2/create`.
2. Save a draft.
3. Open `/v2/create/review`.
4. Run the server check.
5. Open `/v2/create/confirm`.
6. Click Open readiness checklist.
7. Confirm `/v2/create/readiness` loads.
8. Refresh checklist.
9. Confirm required items show status.
10. Confirm `/create` still renders V1.
