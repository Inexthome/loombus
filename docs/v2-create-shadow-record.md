# V2 Create shadow record checkpoint

This checkpoint adds a non-public V2 Create shadow/audit record before any future final activation.

## Added

- `supabase/migrations/20260625225500_create_v2_shadow_records.sql`
- `POST /api/v2/create/shadow`
- `/v2/create/readiness` shadow record control.
- Internal-only shadow/audit record storage.

## What the endpoint does

1. Requires authentication.
2. Requires `v2_shell` access.
3. Loads the signed-in user's private V2 draft.
4. Re-runs server validation.
5. Inserts a non-public shadow record into `loombus_v2_create_shadow_records`.
6. Returns the created shadow record summary.

## What the endpoint does not do

- It does not create a live discussion.
- It does not call the V1 Create flow.
- It does not notify users.
- It does not update public feeds.
- It does not change rollout percentage.
- It does not unlock `/api/v2/create/finalize`.

## Safety

- Final server guard remains locked.
- Shadow records are internal audit records only.
- The table has RLS enabled and no public select policy.
- Existing V1 routes remain unchanged.

## Test plan

1. Apply the Supabase migration.
2. Open `/v2/create`.
3. Save a valid draft.
4. Open `/v2/create/review`.
5. Run the server check.
6. Open `/v2/create/confirm`.
7. Open `/v2/create/readiness`.
8. Click Create shadow record.
9. Confirm a shadow record summary appears.
10. Confirm `/api/v2/create/finalize` still returns locked.
11. Confirm `/create` still renders V1.
