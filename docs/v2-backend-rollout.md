# Loombus V2 backend rollout

This branch starts the V2 shell backend without changing the live V1 user experience.

## Safety rules

1. Do not replace existing V1 routes while building V2.
2. Keep V2 tables additive and isolated.
3. Keep all V2 feature flags disabled by default.
4. Use API fallbacks that return V1-safe responses if the V2 migration has not been applied yet.
5. Only wire the V2 UI after the backend is deployed, verified, and explicitly enabled for testing.

## Added foundation

### Database

Migration: `database/v2/20260625_v2_shell_foundation.sql`

Adds:

- `loombus_feature_flags`
- `loombus_shell_preferences`
- `loombus_rooms`
- `loombus_room_members`
- `loombus_room_discussions`

Initial flags are inserted as disabled:

- `v2_shell`
- `v2_signal_brief`
- `v2_rooms`

### APIs

- `GET /api/v2/shell`
  - Reads V2 feature flags.
  - Returns `version: "v1"` unless `v2_shell` is enabled for the current user.
  - Fails open to a V1-safe response if the migration is missing or unavailable.

- `GET /api/v2/rooms`
  - Reads V2 room records.
  - Returns an empty list safely if V2 rooms are not configured yet.

## Deployment sequence

1. Merge code-only PR.
2. Deploy to Vercel preview.
3. Apply the Supabase migration manually.
4. Verify the APIs return safe responses:
   - `/api/v2/shell` should return `version: "v1"` while flags are disabled.
   - `/api/v2/rooms` should return an empty `rooms` array until rooms are added.
5. Add one private/internal test user to `loombus_feature_flags.allowed_user_ids` for `v2_shell`.
6. Build the V2 UI against the new APIs.
7. Expand access by allowlist first, then low rollout percentage, then full rollout.

## Why this avoids user interruption

Existing users keep using the current routes, tables, and UI. The V2 backend is present but inactive until the `v2_shell` flag is enabled. The new APIs are defensive and return safe defaults instead of throwing user-facing errors.
