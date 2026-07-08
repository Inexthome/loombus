# Loombus Foundation Architecture Specification

Status: Draft 1
Date: 2026-07-08
Owner: Loombus engineering

## 1. Purpose

Loombus Foundation is the architecture direction for moving Loombus away from version-based application shells and toward one durable product architecture.

The goal is not to finish V2. The goal is to operate one Loombus application with one shell, one route tree, one appearance system, one navigation model, and feature modules that can evolve independently.

This document should guide future structural work before more modernization PRs are opened.

## 2. Background

Loombus currently contains evidence of a parallel-version migration strategy. The application has canonical routes such as `/create`, `/discussions`, `/people`, and `/saved`, while also carrying `/v2/...` equivalents for many areas.

That approach allowed experimentation, but it also introduced duplicated shells, duplicated navigation, duplicated appearance handling, and route-level ambiguity. The visible symptom is that a user can see the legacy shell flash before a V2 page or shell takes over.

The Foundation effort exists to stop that pattern and replace it with a maintainable architecture.

## 3. Non-negotiable principles

### 3.1 One product, not versions

Loombus must not be organized around V1, V2, V3, or similar product-wide version namespaces.

Avoid:

```text
src/app/v2/create
src/app/v3/discussions
components/v2-shell
```

Prefer:

```text
features/create
features/discussions
components/shell
components/navigation
```

### 3.2 One canonical route per user destination

Each user-facing destination should have one canonical route.

Examples:

```text
/create
/discussions
/discussions/[id]
/people
/saved
/messages
/notifications
/profile
/settings
/rooms
```

There should not be separate user-facing destinations such as `/v2/create` for the same product surface.

### 3.3 One app shell

The app shell owns the stable frame around authenticated Loombus:

- authenticated layout structure
- desktop navigation
- mobile navigation
- global search entry point
- global message entry point
- notification entry point
- safe-area behavior
- page spacing contracts

Feature pages should not create their own competing application shell.

### 3.4 One appearance system

Appearance must be handled by one provider and one set of CSS variables.

The accepted modes are:

- light
- dark
- system

Appearance state should not be split between V1 and V2 storage keys or providers. Compatibility bridges may exist temporarily, but only with an explicit removal plan.

### 3.5 Features do not own infrastructure

A feature may own its feature UI and business logic. A feature must not own global app infrastructure such as the app shell, global theme, global navigation, authentication runtime, or notification runtime.

### 3.6 Every modernization PR must reduce complexity

A modernization PR should leave the repository closer to this architecture. It should not add a new temporary route tree, new shell, or new global provider unless the old equivalent is being retired in the same plan.

## 4. Target folder structure

The long-term target structure should look like this:

```text
src/
  app/
    (public)/
    (authenticated)/
    api/
    layout.tsx

  components/
    shell/
    navigation/
    layout/
    ui/

  features/
    create/
    discussions/
    rooms/
    messaging/
    search/
    people/
    saved/
    notifications/
    profile/
    settings/
    admin/
    billing/

  providers/
    auth-provider.tsx
    appearance-provider.tsx
    notifications-provider.tsx
    messaging-provider.tsx
    search-provider.tsx

  hooks/
  lib/
  styles/
```

The `app/` directory should become thin. It should define routes and connect those routes to feature modules. Heavy UI, hooks, and business logic should live in feature or shared folders.

## 5. Routing model

### 5.1 Public routes

Public routes are available without authentication.

Examples:

```text
/
/login
/signup
/reset-password
/about
/privacy
/terms
/download
```

Public routes may use a public shell, but that shell must be separate from the authenticated app shell and must not create a second authenticated shell.

### 5.2 Authenticated routes

Authenticated product routes should share one app shell.

Examples:

```text
/home
/create
/discussions
/discussions/[id]
/people
/saved
/messages
/notifications
/profile
/settings
/rooms
/admin
```

### 5.3 Legacy and transition routes

Routes under `/v2` are temporary transition artifacts.

They should not receive new feature work. They should be retired only after their useful behavior has been moved into canonical routes, shared components, or feature modules.

## 6. Shell architecture

The future app shell should be a composition layer, not a large runtime file.

Target composition:

```tsx
<AppProviders>
  <AppShell>
    {children}
  </AppShell>
</AppProviders>
```

`AppShell` should render the frame only. It should not directly own every global behavior.

Recommended shell responsibilities:

- page chrome
- desktop navigation frame
- mobile navigation frame
- main content slot
- optional right rail slot
- global overlay slots

Not recommended inside the shell component:

- direct Supabase auth queries
- message polling implementation
- notification polling implementation
- large search implementation
- feature-specific data loading

Those should be moved into providers, hooks, or features.

## 7. Provider architecture

### 7.1 AuthProvider

Owns:

- current session
- current user
- auth loading state
- sign-out helper
- profile summary needed globally

Does not own:

- route-specific profile editing
- admin screens
- feature-specific permission queries unless exposed as lightweight global capability flags

### 7.2 AppearanceProvider

Owns:

- light/dark/system state
- local persistence
- server persistence for signed-in users
- document-level `data-loombus-theme`
- appearance change events if needed

The Foundation target is one storage key and one provider. Existing V2 appearance behavior should be folded into this provider, not kept as a separate provider forever.

### 7.3 NotificationsProvider

Owns:

- unread notification count
- refresh logic
- notification change event handling
- lightweight global notification state

Does not own:

- full notifications page rendering
- admin notification tooling

### 7.4 MessagingProvider

Owns:

- unread message count
- floating message launcher state if retained globally
- global message refresh events

Does not own:

- full messages page UI
- every conversation thread implementation inside the root shell

### 7.5 SearchProvider

Owns:

- global search overlay open/close state
- lightweight command palette state

The search feature should own deeper query logic and result rendering.

## 8. Feature module contract

Each feature should be allowed to own:

```text
components/
hooks/
lib/
types.ts
server actions or API client helpers
styles scoped to that feature when necessary
```

Example:

```text
src/features/create/
  components/
  hooks/
  lib/
  types.ts
  CreatePage.tsx
```

The route file should be thin:

```tsx
import { CreatePage } from '@/features/create/CreatePage';

export default function Page() {
  return <CreatePage />;
}
```

## 9. Navigation architecture

Navigation should be generated from one source of truth.

Target:

```text
src/components/navigation/nav-items.ts
```

That file should define stable destinations, labels, permissions, icons, and visibility rules.

Desktop and mobile can render differently, but they should read from the same nav item definitions.

Do not hardcode separate navigation lists across the root layout, V2 shell, mobile shell, and individual pages.

## 10. Appearance and CSS rules

CSS should be organized so global styles are intentional and minimal.

Target:

```text
src/styles/globals.css
src/styles/theme.css
src/styles/mobile.css
```

Avoid permanent files named around old migration concepts such as:

```text
v2-public-landing-theme.css
v2-mobile-theme-fixes.css
v2-global-gold-accent.css
```

Those files may be kept temporarily, but they should be renamed, merged, or deleted as part of the Foundation cleanup.

## 11. API architecture

The `/api/v2` namespace is also a transition artifact.

New APIs should not be added under `/api/v2` unless they are explicitly part of a temporary compatibility step.

Preferred API organization:

```text
src/app/api/create/...
src/app/api/discussions/...
src/app/api/rooms/...
src/app/api/messages/...
src/app/api/appearance/...
src/app/api/shell/...
```

If an existing `/api/v2/...` endpoint contains useful behavior, it should be promoted to a canonical API path before `/api/v2` is deleted.

## 12. Migration strategy

### Phase 0: Freeze version-based work

- Do not add new `/v2` routes.
- Do not add new V2-only providers.
- Do not merge broad shell rewrites without extraction first.

### Phase 1: Stabilize production

- Ensure users see one stable shell.
- Stop automatic routing into `/v2` for normal product use.
- Preserve V2 code as reference until it is safely retired.

### Phase 2: Extract responsibilities from ClientLayout

Current `ClientLayout` has accumulated too many responsibilities. The safe strategy is extraction, not replacement.

Recommended order:

1. Extract appearance logic.
2. Extract navigation definitions.
3. Extract notification state.
4. Extract messaging launcher state.
5. Extract global search overlay.
6. Reduce `ClientLayout` into an `AppShell` composition layer.

### Phase 3: Promote useful feature code

For each duplicated route:

1. Identify the better behavior.
2. Move reusable logic into a feature module.
3. Wire the canonical route to the feature module.
4. Verify the canonical route.
5. Delete or retire the duplicate transition route.

### Phase 4: Delete transition artifacts

Only after all dependencies are removed:

- delete `/src/app/v2`
- delete `/src/app/api/v2`
- delete V2-only CSS files after merging useful styles
- delete compatibility redirects and link routers

## 13. Definition of done

Foundation is complete when:

- There is no user-facing `/v2` product path.
- There is one authenticated app shell.
- Desktop and mobile navigation share one source of truth.
- Appearance uses one provider and one storage model.
- `ClientLayout` or its replacement is small and compositional.
- Feature code is organized under feature modules or intentionally shared components.
- New feature work no longer requires choosing between V1 and V2 locations.

## 14. Immediate next PR candidates

The safest first implementation PRs after this specification are:

1. Create shared navigation definitions without changing rendered UI.
2. Extract appearance storage/constants into a canonical appearance module.
3. Add an `AppProviders` composition wrapper while preserving current behavior.
4. Move notification count logic into a provider without changing the visible shell.
5. Move global search overlay into a feature module without changing the visible shell.

These steps reduce risk because they shrink the current shell before replacing it.

## 15. Engineering rule for future work

Before opening a modernization PR, answer:

1. What complexity does this remove?
2. What duplicate path, provider, style, or component does this retire or prepare to retire?
3. Does this move Loombus toward one shell, one route tree, one navigation system, and one appearance system?
4. Can this change be reviewed and rolled back safely?

If the answer is unclear, write the architecture note before writing code.
