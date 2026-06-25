# V2 Discussions preview

This checkpoint adds a gated V2 discussion preview without replacing the current Loombus discussion experience.

## Route

- `/v2/discussions`

## What it does

- Checks `/api/v2/shell` before rendering.
- Requires `v2_shell` access for the signed-in account.
- Reads latest visible discussions from the existing `discussions` table.
- Hydrates author display names from `profiles`.
- Provides a client-side filter for title, topic, author, purpose lane, reality lens, and body text.
- Opens existing V1 discussion detail pages when a preview card is selected.

## Safety model

- Does not replace `/discussions`.
- Does not modify `/home`, `/create`, or any V1 route.
- Does not add V2 to public navigation.
- Does not enable `v2_rooms`.
- Does not change rollout percentage.
- Public users and non-allowlisted accounts remain on V1.

## Manual test plan

1. Keep `v2_shell` allowlisted only to the internal user.
2. Open `/v2/discussions` as that account.
3. Confirm the V2 preview renders latest discussions.
4. Use the filter and confirm results narrow correctly.
5. Click a discussion and confirm it opens the current V1 detail page.
6. Open `/v2/discussions` signed out or from a non-allowlisted account and confirm it does not render the preview.
7. Confirm `/discussions` still renders the current V1 feed.

## Not included yet

- Replacing the V1 discussion feed.
- V2 discussion detail page.
- V2 composer.
- V2 rooms-backed discussion routing.
- Public navigation entry.
