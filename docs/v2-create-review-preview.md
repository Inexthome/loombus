# V2 Create review preview

This checkpoint adds a read-only review screen for the private V2 Create draft.

## Routes

- `/v2/create`
- `/v2/create/review`

## Added

- `/v2/create/review` reads the signed-in user's private draft from `public.loombus_v2_create_drafts`.
- The page checks `/api/v2/shell` and requires `v2_shell` access.
- The review screen shows title, topic, mode, tags, body, and saved timestamp.
- `/v2/create` now has a visible Review draft action.
- The review page can copy the reviewed draft text.
- The review page links back to `/v2/create` and `/create`.

## Safety

- No writes to `discussions`.
- No live publishing.
- No reply submission.
- No replacement of `/create`.
- No public navigation change.
- No rollout percentage change.

## Test plan

1. Confirm the V2 draft table exists and autosave works.
2. Open `/v2/create` with the allowlisted account.
3. Type a draft and wait for autosave.
4. Click Review draft.
5. Confirm `/v2/create/review` opens.
6. Confirm the draft fields render correctly.
7. Confirm Copy review draft works.
8. Confirm Edit V2 draft returns to `/v2/create`.
9. Confirm Open V1 Create routes to `/create`.
10. Confirm `/create` still renders the current V1 composer.

## Not included yet

- Publishing from V2.
- Multiple named drafts.
- Attachments or video upload.
- AI-assisted drafting.
- Replacing the V1 composer.
