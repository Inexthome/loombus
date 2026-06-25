# V2 discussion detail preview

This checkpoint adds a gated, read-only V2 discussion detail preview without replacing the current V1 discussion detail experience.

## Route

- `/v2/discussions/[id]`

## What it does

- Checks `/api/v2/shell` before rendering.
- Requires `v2_shell` access for the signed-in account.
- Loads one visible discussion from the existing `discussions` table.
- Hydrates the discussion author from `profiles`.
- Shows a limited read-only reply preview when reply rows are available.
- Keeps links back to the current V1 detail page for live interaction.
- Updates the V2-only router so discussion card clicks from the V2 preview route open `/v2/discussions/[id]`.

## Safety model

- Does not submit replies.
- Does not edit discussions.
- Does not delete discussions or replies.
- Does not perform moderation actions.
- Does not replace `/discussions/[id]`.
- Does not modify public V1 navigation.
- Does not enable `v2_rooms`.
- Does not change rollout percentage.
- Public users and non-allowlisted accounts remain on V1.

## Manual test plan

1. Keep `v2_shell` allowlisted only to the internal user.
2. Open `/v2/discussions` as that account.
3. Click a discussion card.
4. Confirm it opens `/v2/discussions/[id]`.
5. Confirm the detail preview renders the title, topic, author, body, and read-only safety panel.
6. Confirm the V1 detail link opens `/discussions/[id]`.
7. Confirm direct `/discussions/[id]` still renders the current V1 detail page.
8. Confirm signed-out or non-allowlisted accounts cannot render the V2 preview.

## Not included yet

- Replacing the V1 detail page.
- Posting replies from V2.
- Editing or deleting from V2.
- Reports or moderation from V2.
- Attachments or video preview.
- Public navigation entry.
