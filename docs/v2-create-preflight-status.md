# V2 Create preflight status endpoint

This checkpoint adds one read-only endpoint that consolidates V2 Create launch-readiness signals without enabling publishing.

## Added

- `POST /api/v2/create/preflight-status`
- Preflight readiness report
- Docs and test plan

## What it checks

- Signed-in user session
- `v2_shell` access
- Latest V2 draft exists
- Latest V2 shadow record exists
- Shadow title maps to the future live payload
- Shadow topic maps to the configured V1 topic list
- Shadow body maps to live content expectations
- Shadow body fits the conservative standard V1 length limit
- Shadow mode maps to the V1 discussion type list
- Shadow tags pass V1 normalization
- Rollback guard blocks final action when `v2_create_publish_enabled` is missing or disabled
- Final action remains hard locked
- V1 routes remain unchanged
- No writes are performed

## What it does not do

- It does not publish a discussion.
- It does not insert into `discussions`.
- It does not insert into `discussion_tags`.
- It does not write audit events.
- It does not create notifications.
- It does not change `/create`.
- It does not change `/discussions`.
- It does not change public navigation.
- It does not change rollout percentage.
- It does not include a migration.

## Expected response

The endpoint returns:

- `ready`: whether every preflight check passed
- `locked`: always true for this checkpoint
- `status`: `preflight_ready` or `preflight_needs_work`
- `checks`: detailed pass/fail checklist
- latest draft metadata
- latest shadow record metadata
- rollback guard status
- skipped write targets

## Test plan

1. Open `/v2/create` and save a valid draft.
2. Open `/v2/create/review` and run the server check.
3. Open `/v2/create/readiness` and create a shadow record.
4. Run the dry-run comparison.
5. Call `POST /api/v2/create/preflight-status` with your signed-in V2 session token.
6. Confirm the response includes the full checklist.
7. Confirm `locked` is true.
8. Confirm no live discussion appears in `/discussions`.
9. Confirm `/api/v2/create/finalize` still returns hard locked.
10. Confirm `/create` still renders V1.
