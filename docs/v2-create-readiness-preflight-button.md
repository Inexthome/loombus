# V2 Create readiness preflight button

This checkpoint wires the read-only V2 Create preflight status endpoint into the internal readiness page.

## Added

- `V2CreatePreflightStatusCheck` client component.
- Floating internal preflight status panel on `/v2/create/readiness`.
- V2 layout wiring for the checker.

## Behavior

The checker:

- Appears only on `/v2/create/readiness`.
- Requires a signed-in session.
- Calls `POST /api/v2/create/preflight-status`.
- Displays the returned readiness status.
- Displays the pass/fail checklist from the endpoint.

## What it does not do

- It does not publish a discussion.
- It does not insert into `discussions`.
- It does not insert into `discussion_tags`.
- It does not send notifications.
- It does not write audit events.
- It does not change `/create`.
- It does not change `/discussions`.
- It does not change public navigation.
- It does not change rollout percentage.
- It does not unlock `/api/v2/create/finalize`.

## Test plan

1. Open `/v2/create/readiness` as an allowlisted V2 user.
2. Confirm the preflight status panel appears.
3. Click Run preflight status.
4. Confirm it shows the preflight response and checklist.
5. Confirm `/api/v2/create/finalize` still returns hard locked.
6. Confirm `/create` still renders V1.
7. Confirm `/discussions` still renders the V1 feed.
