# Loombus V2 shell flag wiring

This checkpoint adds the first real V2 shell route without replacing the current Loombus experience.

## Route

- `/v2`

## Safety model

- V1 remains the default experience.
- No current V1 user-facing route is replaced.
- `/v2` checks `/api/v2/shell` before rendering the V2 shell.
- If `v2_shell` is disabled, the route shows a locked state and links back to V1.
- If the visitor is not authenticated, the route shows a sign-in required state.
- The V2 shell renders only when the server resolves `version: "v2"` and `flags.v2_shell: true` for the signed-in user.

## Current state

- V2 shell UI is a gated foundation route.
- Main V2 panels still use placeholder content.
- Discussions and Create link back to existing V1 routes until V2-specific sections are wired.
- Rooms remain hidden unless `v2_rooms` is enabled.
- Appearance polish is still a later task.

## Manual test plan

1. Keep all V2 flags disabled.
2. Open `/v2` while signed out and confirm the page says sign-in is required.
3. Sign in and open `/v2` while `v2_shell` is disabled. Confirm the page says V2 shell is not enabled.
4. Add only one internal user ID to `v2_shell.allowed_user_ids`, then set `v2_shell.enabled = true`.
5. Open `/v2` as that account and confirm the V2 shell renders.
6. Confirm `/discussions`, `/home`, `/create`, and normal navigation still show V1 for users who are not allowed through the flag.

## Do not do yet

- Do not redirect `/home` or `/discussions` to `/v2`.
- Do not set rollout percentage above `0`.
- Do not enable `v2_rooms` until the room directory UI is connected.
- Do not publicly announce V2 from the navigation.
