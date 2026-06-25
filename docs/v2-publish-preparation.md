# V2 publish preparation

This checkpoint adds publish-readiness UI to the V2 Create review screen.

## Route

- `/v2/create/review`

## Added

- Publish preparation panel.
- Draft readiness checks for title, topic, body, mode, and tag count.
- Local review acknowledgement checkbox.
- Disabled publish button that clearly stays locked.
- Guardrail copy confirming no live discussion row is created.

## Safety

- No insert into `discussions`.
- No publish API.
- No submit action.
- No V1 composer replacement.
- No public navigation change.
- No rollout percentage change.

## Test plan

1. Open `/v2/create` with the allowlisted account.
2. Create or edit a draft and wait for autosave.
3. Open `/v2/create/review`.
4. Confirm the publish preparation panel appears.
5. Confirm readiness checks update from the saved draft.
6. Toggle the review acknowledgement checkbox.
7. Confirm the publish button remains disabled.
8. Confirm no live discussion is created.
9. Confirm `/create` still renders the V1 composer.
