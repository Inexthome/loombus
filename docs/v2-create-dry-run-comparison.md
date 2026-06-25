# V2 Create dry-run comparison checkpoint

This checkpoint compares the latest V2 Create shadow record against the V1 Create payload shape without publishing anything live.

## Added

- `POST /api/v2/create/dry-run`
- `/v2/create/readiness` dry-run comparison control.
- Would-publish payload preview.
- Pass/fail checklist for V1 payload compatibility.

## What the dry-run checks

- Title maps to the V1 payload.
- Topic maps to the configured V1 discussion topic list.
- Body maps to V1 content.
- Body fits the conservative standard V1 length limit.
- Mode maps to V1 `discussionType`.
- Tags pass V1 tag normalization.
- Live discussion write is skipped.
- Notifications are skipped.

## What the dry-run does not do

- It does not insert into `discussions`.
- It does not insert into `discussion_tags`.
- It does not write audit events.
- It does not notify followers or topic-alert subscribers.
- It does not call `/api/v2/create/finalize`.
- It does not change rollout percentage.

## Safety

- Final server guard remains locked.
- V1 Create remains the production path.
- Public navigation remains unchanged.
- The dry-run response is a comparison only.

## Test plan

1. Open `/v2/create`.
2. Save a valid draft.
3. Open `/v2/create/review`.
4. Run the server check.
5. Open `/v2/create/confirm`.
6. Open `/v2/create/readiness`.
7. Create a shadow record if needed.
8. Click Run dry-run comparison.
9. Confirm the dry-run checklist appears.
10. Confirm the would-publish preview appears.
11. Confirm no live discussion appears in `/discussions`.
12. Confirm `/api/v2/create/finalize` still returns locked.
