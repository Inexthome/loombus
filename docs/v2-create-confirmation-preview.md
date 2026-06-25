# V2 Create confirmation preview

This checkpoint adds a guarded confirmation preview after the V2 Create server check.

## Added

- `/v2/create/confirm`
- Server-validated confirmation preview.
- Link from the server-check panel after validation passes.
- Confirmation acknowledgement checkbox.
- Locked final action button.
- Copy confirmation preview action.

## Safety

- Confirmation only.
- Final action remains disabled.
- V1 Create remains unchanged.
- Public navigation remains unchanged.
- Rollout percentage remains unchanged.

## Test plan

1. Open `/v2/create`.
2. Create or edit a draft and wait for autosave.
3. Open `/v2/create/review`.
4. Run the server check.
5. Click Open confirmation preview.
6. Confirm `/v2/create/confirm` loads the validated preview.
7. Confirm the final action remains disabled.
8. Confirm `/create` still renders V1.
