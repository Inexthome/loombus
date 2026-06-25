# V2 Home panel wiring

This checkpoint wires live account activity into the gated `/v2` shell while preserving the current V1 experience.

## What is wired

- Profile-based greeting
- Unread message count from `/api/messages/unread-count`
- Unread notification count from `notifications`
- Saved discussion count from `bookmarks`
- Authored discussion count from `discussions`
- Reply count from `replies`
- Recent discussion preview from `discussions`

## Safety model

- `/v2` still renders only when `/api/v2/shell` resolves `version: "v2"` and `flags.v2_shell: true`.
- V1 routes stay unchanged.
- Public navigation stays unchanged.
- Discussions and Create links still route to the existing V1 screens.
- If panel data fails to load, `/v2` shows a safe warning and keeps V1 links available.

## Manual test plan

1. Confirm `v2_shell` is enabled only for the internal test user.
2. Open `/v2` as the allowlisted account.
3. Confirm the greeting loads from profile or email.
4. Confirm Needs Attention shows unread messages plus unread notifications.
5. Confirm Your Signal shows discussion/reply contribution totals.
6. Confirm Saved Ideas shows saved discussion count.
7. Confirm Recent Signals lists latest visible discussions.
8. Confirm `/discussions`, `/create`, `/home`, and public navigation remain V1.

## Still not included

- V2-specific feed route
- V2-specific composer
- V2 Rooms UI
- Public V2 navigation
- Wider rollout
