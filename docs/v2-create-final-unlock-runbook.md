# V2 Create final unlock runbook

This runbook defines the manual requirements, go/no-go checks, rollback plan, and execution sequence required before any future PR changes the V2 Create final lock.

This document is documentation-only. It does not make V2 Create live.

## Current production state

The expected state before using this runbook is:

- `/create` remains the live V1 composer.
- `/discussions` remains the live V1 feed.
- `/discussions/[id]` remains the live V1 detail route.
- Public navigation remains pointed at V1.
- V2 routes remain private/internal.
- `rollout_percentage` remains `0`.
- `v2_rooms` remains disabled.
- `v2_signal_brief` remains disabled.
- `/api/v2/create/finalize` remains hard-locked.

## Existing V2 Create checkpoints

Before any final unlock PR, these checkpoints must exist and be tested:

- V2 draft save/restore/autosave.
- V2 review preview.
- V2 confirmation preview.
- Server validation endpoint.
- Shadow record endpoint.
- Dry-run comparison endpoint.
- Rollback guard endpoint.
- Preflight status endpoint.
- Readiness page preflight panel.

## Non-negotiable unlock requirements

Do not remove or bypass the final lock unless every item below is true:

1. V1 Create still works in production.
2. V1 Discussions feed still works in production.
3. V1 Discussion detail pages still work in production.
4. V2 Create can save and restore drafts.
5. V2 Create review preview matches the expected title, topic, body, mode, and tags.
6. V2 confirmation preview clearly shows the final payload before any action.
7. V2 server validation passes for a real valid draft.
8. V2 shadow record creation succeeds without public writes.
9. V2 dry-run comparison passes against the V1 create payload shape.
10. V2 preflight status returns `locked: true` and reports all required technical checks clearly.
11. The rollback guard blocks final action when `v2_create_publish_enabled` is missing, disabled, or not rolled out to the user.
12. Notifications do not fire from any V2 dry-run, preflight, or shadow step.
13. No public navigation points normal users to V2 Create.
14. Admin/safety expectations for V2-created discussions have been reviewed.
15. A rollback path is documented and ready.

## Go/no-go checklist

### Go

A final unlock PR may be considered only when:

- All required readiness checks pass.
- The final change is limited to a controlled allowlisted path first.
- The unlock is gated by `v2_create_publish_enabled`.
- The default state remains blocked for users who are not explicitly included.
- A rollback can be executed without redeploying V1.

### No-go

Do not proceed if any of the following are true:

- V1 Create is broken.
- V1 feed or detail routes are broken.
- The final lock is changed without a release gate.
- The rollback guard is not checked.
- Notifications have not been reviewed.
- Moderation/safety handling has not been reviewed.
- The preflight endpoint reports missing required checks.
- The test user cannot confirm the final preview payload before action.

## Future final unlock PR scope

The future unlock PR should be small and explicit. It should not include unrelated UI redesign, route migration, navigation changes, or feed changes.

Recommended scope for the future unlock PR:

- Keep `/create` as V1.
- Keep `/discussions` as V1.
- Keep public navigation unchanged.
- Keep rollout unchanged.
- Keep V2 access allowlisted.
- Modify `/api/v2/create/finalize` only enough to allow a gated V2 create action for the allowlisted test path.
- Require `v2_create_publish_enabled` to be enabled for the test user.
- Preserve a server-side blocked response when the release gate is disabled.

## Initial unlock mode

The first unlock must be private and controlled:

- Single allowlisted account only.
- One valid test discussion only.
- No broad rollout.
- No public navigation change.
- No marketing announcement.
- No forced migration from V1.

## Rollback plan

To immediately stop V2 Create final action, set the release gate to blocked:

```sql
update public.loombus_feature_flags
set enabled = false,
    rollout_percentage = 0,
    allowed_user_ids = '{}'
where key = 'v2_create_publish_enabled';
```

If the flag row does not exist, the current rollback guard treats the missing flag as blocked.

If a future unlock PR causes unexpected behavior:

1. Disable `v2_create_publish_enabled`.
2. Confirm `/create` still uses V1.
3. Confirm `/discussions` still uses V1.
4. Confirm no public navigation points to V2 Create.
5. Revert the final unlock PR if the issue is code-level.

## Manual verification after future unlock

After any future private unlock:

1. Create one V2 test discussion from the allowlisted account.
2. Confirm the created discussion appears correctly in the live V1-compatible discussion view.
3. Confirm tags were normalized correctly.
4. Confirm topic and mode are correct.
5. Confirm the body is intact.
6. Confirm no duplicate discussion was created.
7. Confirm notification behavior is expected.
8. Confirm admin/reporting behavior is expected.
9. Disable the release gate and confirm the final action blocks again.

## Explicitly out of scope for this runbook PR

This PR does not:

- Change `/api/v2/create/finalize`.
- Publish discussions.
- Insert into `discussions`.
- Insert into `discussion_tags`.
- Send notifications.
- Change V1 Create.
- Change V1 feed or detail routes.
- Change public navigation.
- Change rollout percentage.
- Enable V2 for public users.
