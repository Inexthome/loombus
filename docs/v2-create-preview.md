# V2 Create preview

This checkpoint adds a gated V2 Create preview without changing the current live composer.

## Route

- `/v2/create`

## What it does

- Checks `/api/v2/shell` before rendering.
- Requires `v2_shell` access for the signed-in account.
- Provides a preview-only signal draft form with:
  - title
  - topic
  - body
  - optional tags
  - discussion mode
- Shows draft readiness checks.
- Allows copying the preview draft to the clipboard.
- Links back to the current V1 composer for live posting.

## Safety model

- Does not write to Supabase.
- Does not submit or publish discussions.
- Does not replace `/create`.
- Does not modify `/home`, `/discussions`, or public navigation.
- Does not enable `v2_rooms`.
- Does not change rollout percentage.
- Public users and non-allowlisted accounts remain on V1.

## Manual test plan

1. Keep `v2_shell` allowlisted only to the internal user.
2. Open `/v2/create` as that account.
3. Confirm the preview form renders.
4. Fill title, topic, body, tags, and mode.
5. Confirm readiness checks update.
6. Confirm Copy draft copies a text preview.
7. Confirm Open V1 Create routes to `/create`.
8. Confirm `/create` still renders the current V1 composer.
9. Confirm signed-out or non-allowlisted accounts cannot render the V2 preview.

## Not included yet

- V2 submission.
- V2 drafts database persistence.
- Attachments or video upload.
- AI-assisted drafting.
- Replacing the V1 composer.
- Public navigation entry.
