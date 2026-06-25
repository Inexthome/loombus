# V2 Create final lock

This checkpoint adds the final server endpoint structure while keeping the action hard-locked.

## Added

- `POST /api/v2/create/finalize`
- Server-side hard lock response.
- Floating lock verifier on `/v2/create/confirm`.

## Safety

- Final action remains locked.
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
6. Click Verify server lock.
7. Confirm the response says the lock is active.
8. Confirm `/create` still renders V1.
