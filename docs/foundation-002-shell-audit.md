# Foundation-002 — Shell Inventory and Dependency Audit

Status: Draft audit
Date: 2026-07-08
Scope: Shell/layout/provider inventory only. No runtime code changes.

## Objective

Identify every known shell/layout/provider boundary that still makes Loombus behave like more than one application.

Foundation-001 removed the forced V2 rewrites for the main canonical routes. Foundation-002 documents what remains so the next implementation PR can remove the right layer without guessing.

## Current shell map

### 1. Root application shell

File: `src/app/layout.tsx`

Observed responsibilities:

- Imports global CSS.
- Imports multiple V2-specific global CSS files.
- Imports `ClientLayout`.
- Injects the appearance bootstrap script from `getAppearanceBootstrapScript()`.
- Mounts native biometric and push registration helpers globally.
- Wraps all children in `ClientLayout`.

Key finding:

`ClientLayout` is the root runtime wrapper for the canonical app. Even after the V2 rewrites were disabled, this remains the main shell for canonical routes.

Risk:

Because root layout imports many V2-specific CSS files globally, V2 styling can still leak into the canonical application even when canonical routes are no longer rewritten to `/v2`.

### 2. Canonical ClientLayout shell

File: `src/app/client-layout.tsx`

Observed responsibilities from imports and known implementation:

- Auth/session lookup.
- Nav profile loading.
- Admin capability detection.
- Notification count loading.
- Message unread count and floating conversation state.
- Global search overlay state and query execution.
- Appearance mode storage/application.
- Desktop rail navigation.
- Mobile navigation/menu behavior.
- Right rail sizing logic.
- Scroll-driven mobile nav visibility.
- Floating private message UI.

Key finding:

`ClientLayout` is not only a layout. It is currently the canonical app runtime. It should not be replaced in one large PR. It should be decomposed by extracting responsibilities into smaller providers and shell components.

Risk:

A broad replacement could break auth, notifications, messages, appearance, search, or navigation at the same time.

### 3. V2 route shell

File: `src/app/v2/layout.tsx`

Observed responsibilities:

- Wraps `/v2` routes in `V2AppearanceProvider`.
- Injects a large inline style block for V2 theme and contrast behavior.
- Mounts `V2ShellLinkRouter`.
- Applies V2 page/top-nav/bottom-nav theme rules.

Key finding:

`/v2` is still a separate shell with its own appearance provider and link router. It is no longer the main path for canonical routes after Foundation-001, but it remains active for V2-only islands such as Rooms.

Risk:

Any route still served under `/v2` continues to use the V2 shell stack and can diverge from the canonical shell.

### 4. Admin shell island

Files:

- `src/app/admin/layout.tsx`
- `src/components/admin/admin-v2-shell.tsx`

Observed responsibilities:

- `src/app/admin/layout.tsx` wraps all admin pages in `AdminV2Shell`.
- `AdminV2Shell` renders its own fixed full-screen shell.
- It defines its own top navigation and admin side navigation.
- Its top navigation contains hardcoded `/v2` destinations:
  - `/v2`
  - `/v2/discussions`
  - `/v2/create`
  - `/v2/messages`
  - `/v2/search`
  - `/v2/notifications`
- Admin side navigation uses canonical `/admin/...` links plus `/settings`.

Key finding:

Admin is a separate shell island. It is independent from the V2 rewrite issue. Removing rewrites does not affect it because the admin layout explicitly imports and renders `AdminV2Shell`.

Risk:

Admin is now the clearest remaining non-canonical shell. Because it is lower-traffic and admin-only, it is a good candidate for a controlled shell correction after the root shell responsibilities are understood.

### 5. Room shell island

Current routing behavior:

Foundation-001 intentionally preserved these temporary rewrites in `next.config.ts`:

- `/rooms` → `/v2/rooms`
- `/rooms/:path*` → `/v2/rooms/:path*`
- `/create-room` → `/v2/create-room`

Key finding:

Rooms remain intentionally V2-backed because they were built as V2-only surfaces. They should not be migrated until the shell strategy is stable.

Risk:

Rooms still depend on `/v2` layout, V2 appearance, and V2 link routing.

## Known remaining V2 dependencies

### Route/layout dependencies

- `/v2` route tree still has its own layout.
- `/admin` has its own AdminV2Shell.
- `/rooms` and room detail routes still rewrite into `/v2/rooms`.

### Provider dependencies

- Root app uses the appearance bootstrap script from `lib/appearance-mode`.
- `/v2` uses `V2AppearanceProvider`.
- `ClientLayout` also manages appearance mode state directly.

This indicates that appearance still has multiple ownership points.

### Styling dependencies

Root layout imports multiple V2-specific CSS files globally:

- `v2-mobile-theme-fixes.css`
- `v2-public-landing-theme.css`
- `v2-public-signed-out-theme.css`
- `v2-public-final-contrast.css`
- `v2-public-landing-login-readability.css`
- `v2-public-landing-cta-contrast.css`
- `v2-settings-gold-accent.css`
- `v2-global-gold-accent.css`

These should eventually be renamed, merged, scoped, or deleted. They should not remain permanent global imports with V2 names.

## Recommended implementation order

### Foundation-003 — Admin shell correction

Reason:

Admin is the smallest clearly isolated shell island. It can be corrected without touching the root user shell or Rooms.

Goal:

- Remove hardcoded `/v2` destinations from `AdminV2Shell`.
- Preserve admin page functionality.
- Keep admin side navigation intact.
- If possible, rename the shell away from `AdminV2Shell` only after behavior is stable.

Acceptance criteria:

- `/admin` works.
- `/admin/*` pages work.
- Admin top nav points to canonical routes, not `/v2` routes.
- No admin page links users back into `/v2` unless the destination is explicitly still V2-only.

### Foundation-004 — Appearance ownership inventory/extraction

Reason:

Appearance has at least three ownership points: root bootstrap, ClientLayout state, and V2AppearanceProvider.

Goal:

- Identify canonical storage key and owner.
- Extract constants/helpers first.
- Do not redesign themes.

### Foundation-005 — ClientLayout decomposition

Reason:

ClientLayout is too large to replace directly.

Goal:

Extract one responsibility at a time:

1. Navigation definitions/helpers.
2. Appearance state.
3. Notification count.
4. Message unread/floating launcher state.
5. Global search overlay.

### Foundation-006 — Rooms shell migration

Reason:

Rooms are still V2-backed and feature-heavy. They should be migrated only after Admin and appearance ownership are stable.

Goal:

Move Rooms toward canonical routing without losing private-room features.

## Do not do yet

- Do not delete `/src/app/v2`.
- Do not remove V2 CSS files globally until each style dependency is verified.
- Do not replace `ClientLayout` in one PR.
- Do not migrate Rooms before Admin and appearance ownership are cleaned up.

## Definition of done for Foundation-002

- This audit document exists in the repo.
- Remaining shell islands are identified.
- The next implementation target is selected based on evidence.
- No runtime behavior is changed.
