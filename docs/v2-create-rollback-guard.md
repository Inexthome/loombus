# V2 Create publish rollback guard

This checkpoint adds a rollback guard for any future V2 Create final action.

## Added

- `v2_create_publish_enabled` feature flag.
- `POST /api/v2/create/rollback-guard`.
- Rollback guard check inside `/api/v2/create/finalize` after the existing hard lock.
- `/v2/create/readiness` rollback guard checker.

## Default state

`v2_create_publish_enabled` defaults to:

- `enabled = false`
- `rollout_percentage = 0`
- `allowed_user_ids = {}`

That means V2 final action remains blocked by default.

## Why this exists

The existing server hard lock still blocks the final action. This rollback guard adds another layer for the future: even if the hard lock is later removed, V2 Create can still be stopped instantly by disabling `v2_create_publish_enabled`.

## What the guard does

- Requires authentication.
- Requires `v2_shell` access.
- Checks `v2_create_publish_enabled`.
- Blocks the V2 final action when the flag is off, missing, or not enabled for the user.

## What the guard does not do

- It does not publish a discussion.
- It does not create notifications.
- It does not update public feeds.
- It does not change V1 Create.
- It does not change public navigation.
- It does not change rollout percentage.

## Test plan

1. Apply the Supabase migration.
2. Open `/v2/create/readiness`.
3. Click Check rollback guard.
4. Confirm the guard reports active/blocked while the flag is disabled.
5. Confirm `/api/v2/create/finalize` still returns hard locked.
6. Confirm `/create` still renders V1.
7. Confirm `/discussions` still renders the V1 feed.

## Rollback procedure

To stop V2 Create final action in the future, set:

```sql
update public.loombus_feature_flags
set enabled = false,
    rollout_percentage = 0,
    allowed_user_ids = '{}'
where key = 'v2_create_publish_enabled';
```

No V1 route change is required.
