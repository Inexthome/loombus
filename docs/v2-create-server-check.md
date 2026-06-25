# V2 Create server check

This checkpoint adds a server-side validation preview for the V2 Create review flow.

## Added

- `POST /api/v2/create/prepare`
- Authenticated user check.
- `v2_shell` access check.
- Private V2 draft lookup.
- Validation checks for title, topic, body, mode, and tags.
- Server-check panel on `/v2/create/review`.

## Safety

- Validation only.
- No final submit action is enabled.
- V1 Create remains unchanged.
- Public navigation remains unchanged.
- Rollout percentage remains unchanged.

## Test plan

1. Open `/v2/create`.
2. Create or edit a draft and wait for autosave.
3. Open `/v2/create/review`.
4. Click Run server check.
5. Confirm validation results appear.
6. Confirm the locked action remains disabled.
7. Confirm `/create` still renders V1.
