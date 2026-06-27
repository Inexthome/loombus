# Loombus V2 / V1 Compatibility Audit

This audit compares the current V2 shell against the proven V1 app surface. The goal is to wire V2 to full compatibility without breaking V1, without replacing public routes too early, and without deleting V2 shell pages that are not fully functional yet.

## Ground rules

- V1 public routes remain the production source of truth until final approval.
- V2 stays behind `v2_shell` unless explicitly noted for pre-auth pages such as `/v2/login`.
- Do not delete V2 placeholders. Convert them into live shells over time.
- Prefer existing V1 APIs, tables, and guards over new behavior.
- Every V2 mutation must reuse proven V1 behavior or stay disabled.
- V2 Create final publish remains guarded until explicitly opened.

## Current V2 coverage

### Primary shell

- `/v2`
- `/v2/discussions`
- `/v2/discussions/[id]`
- `/v2/create`
- `/v2/rooms`
- `/v2/messages`

### Secondary shell

- `/v2/people`
- `/v2/labs`
- `/v2/topics`
- `/v2/following`
- `/v2/saved`
- `/v2/stickies`
- `/v2/reading-history`
- `/v2/my-activity`
- `/v2/my-discussions`
- `/v2/my-replies`
- `/v2/profile`
- `/v2/settings`
- `/v2/premium`
- `/v2/support`
- `/v2/privacy-security`
- `/v2/notifications`
- `/v2/search`
- `/v2/onboarding`
- `/v2/admin`

### V2 entry shell

- `/v2/login`
- `/v2/signup`
- `/v2/reset-password`

These routes are intentionally not behind `v2_shell` because users must access them before signing in.

## V1 workflow audit

### Discussions feed

V1 `/discussions` is a fully functional feed, not just cards. It includes:

- `discussions` read filtered by `deleted_at is null`
- `profiles` hydration
- blocked-user filtering through `user_blocks`
- following relationships through `follows`
- reply counts through `replies`
- latest reply timestamps for recent activity
- view counts through `discussion_views`
- save counts through `bookmarks`
- tags through `discussion_tags`
- advanced filters gated by admin or Premium entitlement
- topic filters and purpose-lane filters
- Signal score formula: `replies * 3 + saves * 5 + views`
- Stickies through `/api/stickies`

V2 `/v2/discussions` currently has a strong shell and partial live wiring. Compatibility gaps:

- Following feed filter must use V1 `follows` logic.
- Advanced filters must reuse V1 entitlement logic.
- Blocked-user filtering must match V1 behavior.
- Topic and purpose query parameters should be supported.
- Stickies should preserve V1 Premium/admin access rules.
- Signal score must stay aligned with V1 formula.

### Discussion detail

V1 discussion detail is the source of truth for:

- discussion body rendering and safe formatting
- replies
- quote reply
- reply edit/delete
- discussion edit/delete for owners/admins
- save/bookmark
- share
- report discussion/reply
- attachments and video context
- AI tools for eligible users
- state-of-discussion panels

V2 detail has shell coverage and partial live reads. Compatibility gaps:

- Reply create/edit/delete should not be enabled until it reuses V1 behavior exactly.
- Save/bookmark should reuse V1 `bookmarks` behavior.
- Report actions should reuse V1 report APIs/modals.
- AI tools should reuse existing V1 entitlement and API checks.
- Owner/admin edit/delete must reuse V1 permission checks.

### Create discussion

V1 Create is production. V2 Create is a shell/preview with guarded final publishing.

Compatibility rule:

- Do not open V2 final publishing until the V2 create form has parity for moderation, drafts, attachments/video context, tags, modes, purpose lanes, and safe create behavior.
- Keep `v2_create_publish_enabled` closed until explicitly approved.

### People

V1 People supports:

- profiles list
- follow/unfollow
- followers/following/mutual/suggested logic
- user block filtering
- profile badges through `/api/profiles/badges`
- message entry points

V2 `/v2/people` is currently a shell. Compatibility gaps:

- Live people data from V1 `profiles` and `follows`.
- Follow/unfollow action wiring.
- Mutual/suggested filtering.
- Message entry point to V2 or V1 messages depending on readiness.
- Profile detail routes `/v2/people/[id]` should hydrate real user data before actions are added.

### Messages

V1 Messages is production and sensitive. V2 Messages is currently a shell.

Compatibility gaps:

- Read-only message list can be wired first.
- Sending, attachments, archive/delete, mute, typing, and reports should remain V1 until exact parity is confirmed.
- Never expose message data without matching V1 auth/relationship checks.

### Saved

V1 saved/bookmarks are backed by `bookmarks` and folders/collections where implemented.

V2 `/v2/saved` is currently a shell. Compatibility gaps:

- Load real saved discussions.
- Preserve folder/collection behavior.
- Remove/move actions should reuse V1 behavior.
- Saved detail and folder routes should remain shells until data-safe.

### Stickies

V1 Stickies API supports:

- GET user stickies
- POST discussion sticky
- PATCH order
- DELETE sticky
- Premium/admin access check
- source key based on discussion id

V2 has partial add-to-sticky wiring from discussion cards. Compatibility gaps:

- `/v2/stickies` should read from `/api/stickies`.
- Reorder/delete should not be added until the V2 UI safely mirrors V1 behavior.
- Keep Premium/admin access messages clear.

### Following

V1 following relationships are stored in `follows` and used by People and Discussions.

V2 `/v2/following` is currently a shell. Compatibility gaps:

- Load followed people.
- Load discussions by followed users.
- Later include followed rooms/topics/labs only when those systems are real.

### My Activity

V2 `/v2/my-activity` is a useful V2-forward shell. V1 does not appear as one consolidated page.

Compatibility approach:

- Compose from existing V1 tables: discussions, replies, bookmarks, follows, rooms/labs/messages once safe.
- Keep private by default.

### My Discussions

V1 production data comes from `discussions` filtered by `user_id` and deleted/draft/archive concepts where implemented.

V2 `/v2/my-discussions` is currently a shell. Compatibility gaps:

- Load the viewer's discussions.
- Include draft behavior only from proven V1 draft system.
- Edit/archive/delete actions should reuse V1 permissions.

### My Replies

V1 replies are backed by `replies` with `deleted_at` filtering.

V2 `/v2/my-replies` is currently a shell. Compatibility gaps:

- Load the viewer's replies.
- Join discussion titles/topics.
- Open thread into `/v2/discussions/[id]`.
- Edit/delete only after parity with V1 behavior.

### Profile

V1 profile supports profile data, avatar, bio, and account-related profile behavior.

V2 `/v2/profile` is currently a shell. Compatibility gaps:

- Hydrate current user's real profile.
- Show user's discussions/replies/saves counts.
- Edit profile should either route to V1 Settings/Profile or reuse the V1 update path.

### Settings / Privacy / Security

V2 Settings now owns Appearance for V2.

Compatibility gaps:

- Account settings should route or reuse V1 settings behavior.
- Notification preferences should reuse V1 profile/preferences tables.
- Privacy/security should reuse existing privacy, block, session, and account-safety behavior.

### Premium

V1/Premium production flow uses Stripe/web and platform-specific mobile billing where already implemented.

V2 `/v2/premium` is currently a shell. Compatibility gaps:

- Show current entitlement.
- Link to existing checkout/portal safely.
- Do not create new billing behavior.

### Support

V1 support/admin tooling exists separately.

V2 `/v2/support` should initially route to existing support flow or create a safe V2 support shell. Avoid new support submission behavior until API parity is confirmed.

### Admin

V1 Admin is production and sensitive.

V2 `/v2/admin` is currently a read-only shell.

Compatibility gaps:

- Add admin role check before exposing any real admin data.
- Keep all admin mutations in V1 until V2 admin parity is approved.
- Wire read-only counts first: reports, users, labs requests, deleted content, audit/support queues.

### Search

V1 global search supports people, discussions, saved destinations, and quick actions.

V2 `/v2/search` is currently a shell. Compatibility gaps:

- Reuse V1 global search logic and indexing assumptions.
- Search icon in V2 should stay inside `/v2/search`.
- AI search actions should remain gated by existing entitlements.

### Notifications

V1 notifications are production.

V2 `/v2/notifications` is currently a shell. Compatibility gaps:

- Read notification list.
- Mark-read behavior should reuse existing V1 logic.
- Bell should route to `/v2/notifications` inside V2.

## Safe wiring order

1. Route compatibility bridge so V2 clicks do not unexpectedly fall back into V1 when a V2 shell exists.
2. Read-only data hydration for People, Saved, Stickies, My Discussions, My Replies, Profile, Notifications, Search.
3. Low-risk actions already proven in V1: save/bookmark, sticky add, follow/unfollow.
4. Sensitive actions last: messages, reports, edit/delete, admin actions, billing, final create publish.

## Current PR scope

This PR intentionally limits code changes to safe compatibility routing and documentation. It does not wire high-risk live actions yet.
