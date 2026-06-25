# V2 Create autosave

This checkpoint adds debounced autosave to the gated V2 Create preview without publishing anything and without replacing the current V1 composer.

## Route

- `/v2/create`

## What it does

- Uses the existing `public.loombus_v2_create_drafts` table from the V2 draft persistence checkpoint.
- Restores the signed-in user's private draft when the page loads.
- Autosaves title, topic, body, optional tags, and discussion mode after typing pauses.
- Shows a visible autosave status message.
- Keeps a manual Save now action.
- Allows clearing the private draft.
- Keeps copy-to-clipboard handoff to V1 Create.

## Safety model

- Does not insert into `discussions`.
- Does not publish posts.
- Does not submit replies.
- Does not replace `/create`.
- Does not modify public V1 navigation.
- Does not enable `v2_rooms`.
- Does not change rollout percentage.
- Autosave is gated by `v2_shell` and the current signed-in user.
- Public users and non-allowlisted accounts remain on V1.

## Manual product test plan

1. Confirm the V2 draft migration from PR #102 has been applied.
2. Keep `v2_shell` allowlisted only to the internal user.
3. Open `/v2/create` as that account.
4. Type in title, topic, body, tags, or mode.
5. Confirm the autosave status moves through pending/saving/saved states.
6. Refresh `/v2/create`.
7. Confirm the draft restores.
8. Click Clear draft.
9. Refresh `/v2/create`.
10. Confirm the draft no longer restores.
11. Confirm `/create` still renders the current V1 composer.
12. Confirm signed-out or non-allowlisted accounts cannot render the V2 preview.

## Not included yet

- Publishing from V2.
- Multiple named drafts.
- Attachments or video upload.
- AI-assisted drafting.
- Replacing the V1 composer.
- Public navigation entry.
