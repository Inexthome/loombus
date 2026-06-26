# V2 Create publish rollback guard

This checkpoint adds a rollback guard endpoint for future V2 Create final-action planning.

## Added

- `POST /api/v2/create/rollback-guard`.
- Rollback procedure documentation.

## Default state

The guard checks a feature flag key named `v2_create_publish_enabled`.

The safe default is blocked:

- Missing flag: blocked.
- `enabled = false`: blocked.
- `rollout_percentage = 0` with no allowlist match: blocked.

That means V2 final action remains blocked unless the flag is intentionally created and enabled for a specific rollout path.

## Why this exists

The existing server hard lock still blocks the final action. This rollback guard endpoint adds another layer for future planning: V2 Create can be stopped by disabling `v2_create_publish_enabled` or removing rollout access before any future final path is connected.

## What the guard does

- Requires authentication.
- Requires `v2_shell` access.
- Checks `v2_create_publish_enabled`.
- Reports blocked when the flag is off, missing, or not enabled for the user.

## What the guard does not do

- It does not publish a discussion.
- It does not create notifications.
- It does not update public feeds.
- It does not change V1 Create.
- It does not change public navigation.
- It does not change rollout percentage.
- It does not modify `/api/v2/create/finalize`.

## Test plan

1. Call `POST /api/v2/create/rollback-guard` with a signed-in V2 allowlisted account.
2. Confirm the guard reports active/blocked while the flag is disabled or missing.
3. Confirm `/api/v2/create/finalize` still returns hard locked.
4. Confirm `/create` still renders V1.
5. Confirm `/discussions` still renders the V1 feed.

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
