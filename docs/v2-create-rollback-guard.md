# V2 Create publish rollback guard

This checkpoint adds a rollback guard for any future V2 Create final action.

## Added

- `POST /api/v2/create/rollback-guard`.
- Rollback guard check inside `/api/v2/create/finalize` after the existing hard lock.
- `/v2/create/readiness` rollback guard checker.

## Default state

The guard checks a feature flag key named `v2_create_publish_enabled`.

The safe default is blocked:

- Missing flag: blocked.
- `enabled = false`: blocked.
- `rollout_percentage = 0` with no allowlist match: blocked.

That means V2 final action remains blocked unless the flag is intentionally created and enabled for a specific rollout path.

## Why this exists

The existing server hard lock still blocks the final action. This rollback guard adds another layer for the future: even if the hard lock is later removed, V2 Create can still be stopped instantly by disabling `v2_create_publish_enabled` or removing rollout access.

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

1. Open `/v2/create/readiness`.
2. Click Check rollback guard.
3. Confirm the guard reports active/blocked while the flag is disabled or missing.
4. Confirm `/api/v2/create/finalize` still returns hard locked.
5. Confirm `/create` still renders V1.
6. Confirm `/discussions` still renders the V1 feed.

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
