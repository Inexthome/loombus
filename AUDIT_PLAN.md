# Loombus v1 → v2 Remediation Plan
Generated from live audit — loombus.com is in production with real users.
Work top to bottom. Ordering matters: several fixes will break functionality if applied out of sequence.

---

## SEVERITY: CRITICAL — Data exposure, live right now

### C1. All 11 admin pages query sensitive data with the anon client, gated only by client-side JS

**What's happening:**
Every admin page (`admin/users`, `admin/safety`, `admin/reports`, `admin/support`, `admin/labs`,
`admin/ai-access`, `admin/topic-memory`, `admin/audit`, `admin/page`, `admin/deleted`,
`admin/deleted-replies`) follows this pattern:

```ts
const { data: adminProfile } = await supabase.from("profiles").select("is_admin")...
if (!adminProfile?.is_admin) { setLoading(false); return; } // <- UI gate only
const { data } = await supabase.from("profiles").select("...sensitive columns...") // <- runs regardless
```

The `is_admin` check controls whether React renders the data. It does **not** control whether the
database returns it. Because `profiles` has `SELECT true` (see C2), any request using the public
anon key — which ships in your JS bundle — can run the same query directly and get the same data,
admin flag or not. This is true for every one of the 11 pages, and depending on what each page
queries, may include moderation reports, support tickets, audit logs, deleted content, and billing
diagnostics — not just profiles.

**Fix — do this first, before anything else in this document:**

1. For each of the 11 admin pages, create a matching service-role API route if one doesn't already
   exist (`admin/moderation/actions` and `admin/health` show the existing pattern to copy):
   ```ts
   // src/app/api/admin/<name>/route.ts
   export async function GET(request: NextRequest) {
     const supabase = createServerClient(...); // user's session, not service role
     const { data: { user } } = await supabase.auth.getUser();
     if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

     const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
     if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

     const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!); // bypasses RLS, server-only
     const { data, error } = await admin.from("profiles").select("...");
     if (error) return NextResponse.json({ error: error.message }, { status: 500 });
     return NextResponse.json({ data });
   }
   ```
2. Repoint each admin page's data-fetching `useEffect` at `fetch("/api/admin/<name>")` instead of
   calling `supabase.from(...)` directly.
3. Verify each page still renders correctly for an admin account.
4. Only after all 11 are moved: the anon-client admin-check reads (like `admin/users` line 166,
   which only selects `is_admin`) can stay as a UX-only pre-check — it's harmless once bulk data
   comes from the server route.

**Do not skip to C2 before finishing this.** Revoking columns before the admin routes are moved
will break the admin panel's own display of that data.

---

### C2. `profiles` table: sensitive columns readable by anyone with the anon key

**What's exposed under `SELECT true`:** `date_of_birth`, `age_band`, `teen_safety_mode`,
`guardian_required`, `legal_name_verified`, `identity_provider_subject`,
`identity_verification_provider`, `identity_verified_at`, `identity_verification_last_checked_at`,
`identity_restriction_reason`, `enforcement_reason`, `enforcement_note`, `enforced_by`,
`enforced_at`, `suspended_until`.

The `teen_safety_mode` / `guardian_required` columns imply minors are represented in this table,
which makes the exposed `date_of_birth` field the most serious single item in this audit.

**Fix, in order, after C1 is fully done:**

1. Revoke the columns that have zero legitimate client self-reads (confirmed via grep — nothing in
   `src/app` outside `/api/` and the now-migrated admin routes touches these):
   ```sql
   revoke select (enforcement_reason, enforcement_note, enforced_by, enforced_at,
     suspended_until, identity_provider_subject, identity_verification_provider,
     identity_verified_at, identity_verification_last_checked_at,
     identity_restriction_reason, legal_name_verified)
   on public.profiles from anon, authenticated;
   ```
2. For `date_of_birth`, `age_band`, `teen_safety_mode`, `guardian_required` — these ARE read by
   users about their own row (`home/page.tsx`, `auth/callback/page.tsx` for the age-gate flow), so
   a blanket revoke breaks onboarding. Do a table split instead:
   ```sql
   create table public.profile_sensitive (
     id uuid primary key references public.profiles(id) on delete cascade,
     date_of_birth date,
     age_band text,
     teen_safety_mode boolean default false,
     guardian_required boolean default false
   );
   alter table public.profile_sensitive enable row level security;

   create policy "Users read own sensitive profile data"
     on public.profile_sensitive for select
     using (auth.uid() = id);

   -- migrate existing data
   insert into public.profile_sensitive (id, date_of_birth, age_band, teen_safety_mode, guardian_required)
   select id, date_of_birth, age_band, teen_safety_mode, guardian_required from public.profiles;

   revoke select (date_of_birth, age_band, teen_safety_mode, guardian_required)
   on public.profiles from anon, authenticated;
   ```
3. Update `home/page.tsx` and `auth/callback/page.tsx` to read from `profile_sensitive` instead of
   `profiles` for these four fields. Update any write paths (`signup/page.tsx`) similarly.
4. Test: signup flow, age-gate flow, login redirect flow, and the now-migrated admin/users panel —
   all four touch these columns.

---

### C3. Soft-deleted `discussions` / `replies` are publicly readable — ALREADY FIXED ✅
Confirmed applied earlier in this audit. No action needed. Worth a periodic spot-check
(`select * from discussions where deleted_at is not null limit 1` via anon key should return nothing).

---

## SEVERITY: HIGH — Broken or forked functionality

### H1. v2 discussion creation likely writes to a table that doesn't exist in production

The five-endpoint create pipeline (`prepare` → `dry-run` → `shadow` → `preflight-status` →
`finalize`) exclusively targets `loombus_feature_flags`, `loombus_v2_create_drafts`,
`loombus_v2_create_shadow_records`, and `loombus_v2_discussions`. Confirmed via RLS query:
`loombus_v2_discussions` and `loombus_v2_create_shadow_records` **do not exist in production.**
Only `loombus_v2_create_drafts` was ever applied.

**Action required — do this now, it's a possible live outage:**
1. Test directly: go to `loombus.com/v2/create`, submit a real test post, observe the result.
2. Check `loombus_feature_flags` policy count (0 policies, per the RLS dump) — if the pipeline
   gates on a feature flag it can't read, it may silently no-op or fall back. Check
   `src/app/v2/create/client-page.tsx` for a fallback path to `/api/discussions/create` (the v1
   endpoint).
3. Based on what you find, the fix is the same either way: **delete the five-endpoint pipeline**
   and have `/v2/create` submit to the same endpoint v1 uses (`/api/discussions/create`), writing
   to the real `discussions` table. One create path for both UIs.
4. Delete the three v2 migrations from the repo (`create_loombus_v2_discussions`,
   `create_v2_create_drafts`, `create_v2_shadow_records`) so they can never be accidentally applied
   later and resurrect this fork.
5. If any real rows exist in `loombus_v2_create_drafts` from user attempts, decide whether to
   recover them into `discussions` or discard — check row count first.

---

### H2. v1 and v2 are both live as complete, parallel products

~30 duplicated routes (`/discussions` + `/v2/discussions`, `/login` + `/v2/login`, `/settings` +
`/v2/settings`, two admin panels, etc.) are all publicly reachable simultaneously. Users on old
links get a different product than users clicking your homepage CTA.

**Fix, once H1 confirms v2 creation is safe:**
1. Decide v2 is canonical (implied by your homepage already routing there).
2. Add permanent redirects from every v1 route to its v2 equivalent, in `proxy.ts` or via
   `next.config.ts` redirects.
3. Delete the v1 route tree once redirects are confirmed working and no traffic hits it directly
   (check Vercel analytics for a week first).

---

### H3. v2's Follow button (and possibly other controls) are non-functional stubs

Confirmed: `discussions/[id]/page.tsx` Follow button `onClick` sets a message reading *"Follow is
coming to the V2 discussion shell."* File names like `v2-readonly-compat-cards.tsx` and
`v2-live-readonly-section-page.tsx` suggest more of these exist.

**Fix:** Manual parity pass — open every v2 page next to its v1 twin, click every control, note
what's stubbed. Given the naming pattern, check these files specifically:
```
src/app/v2/v2-readonly-compat-cards.tsx
src/app/v2/v2-live-readonly-section-page.tsx
src/app/v2/v2-gap-shell-page.tsx
```

---

### H4. `/v2/*` routes get no session refresh at the edge

`proxy.ts` matcher covers `/create`, `/following`, `/saved`, `/profile`, `/notifications`, `/admin`
— none of the `/v2/*` equivalents, including `/v2/admin`.

**Fix:**
```ts
// proxy.ts
export const config = {
  matcher: [
    "/create/:path*", "/following/:path*", "/saved/:path*", "/profile/:path*",
    "/notifications/:path*", "/admin/:path*",
    "/v2/:path*", // add this
  ],
};
```
Also explicitly verify `/v2/admin` checks `is_admin` server-side once C1's admin API routes exist —
don't let it be the one admin surface still trusting the client.

---

## SEVERITY: MEDIUM

### M1. Dead/duplicate middleware files
`middleware.ts` (root) is a deliberately disabled no-op — Next 16 renamed the convention to
`proxy.ts`, and this file was parked rather than deleted. `src/middleware.ts` is fully ignored by
Next 16. Only `proxy.ts` is live.
**Fix:** `rm middleware.ts src/middleware.ts` — pure cleanup, removes a source of confusion for
future-you or future-AI-agent.

### M2. Everything is client-rendered; public content is invisible to search engines and slow to paint
116 `"use client"` files, including the discussions list and detail pages. External check
confirmed `/v2/discussions` ships as an empty loading shell server-side — the actual content only
appears after a client fetch. This is both the "lag" you asked about and an SEO dead zone for a
platform whose growth depends on discussions being discoverable.
**Fix:** Convert the public read surfaces (`v2/discussions`, `v2/discussions/[id]`, `v2/[username]`
profile pages) to server components fetching via the Supabase server client. Keep interactive
pieces (reply form, AI tools panel, follow button) as small client islands within the server-rendered
shell.

### M3. Repo lives inside iCloud-synced Desktop — corrupting the build
Typecheck errors reference files literally named `cache-life.d 2.ts` and `routes.d 2.ts` — the
macOS/iCloud duplicate-file signature. This can silently duplicate source files and produce
nondeterministic builds.
**Fix:**
```bash
rm -rf .next
find . -name "* 2.*" -not -path "./node_modules/*" -not -path "./.git/*"
```
Then move the repo out of iCloud's sync scope entirely: `~/dev/loombus` or similar, or right-click
the folder in Finder → "Remove Download" is not it — use System Settings → Apple ID → iCloud →
iCloud Drive → Options, and exclude the parent folder, or just relocate off Desktop.

### M4. Raw `<img>` tags throughout v2 instead of `next/image`
~15 instances found (avatars, brand mark, attachment previews). No automatic optimization,
resizing, or lazy-loading.
**Fix:** Swap for `next/image` with explicit `width`/`height`, starting with the highest-traffic
ones (avatars in nav, discussion list thumbnails).

### M5. Supabase client instantiated ~85 times across route files instead of one factory
Not a bug today, but every future auth/config change has 85 places it can be applied
inconsistently.
**Fix:** Consolidate into `src/lib/supabase/server.ts` (service-role factory) and
`src/lib/supabase/route-client.ts` (user-session factory), import everywhere.

### M6. Triple-stacked page titles ("Login to Loombus | Loombus | Loombus")
Confirms two metadata/layout systems are both appending the site name — likely a v1 layout and a
v2 layout both active in the tree.
**Fix:** Audit `layout.tsx` files for duplicate `title.template` or `title.default` definitions;
should be defined once at the root.

---

## SEVERITY: LOW — Cleanup, not urgent

- Delete confirmed dead code: `src/lib/mock-data.ts` (nothing imports it), `src/app/api/v2/discussions/route.ts`
  (no v2 page calls it, reads from the never-created table)
- Sanitizer function (`discussionBodyToSafeHtml`) is duplicated 3x as a thin wrapper around shared
  logic in `src/lib` — consolidate the wrapper into one shared export instead of copy-pasting it
  per page.
- Two `console.log` calls left in `stripe-webhook/route.ts` — fine for now, but swap for structured
  logging before this becomes a debugging habit at 2am.
- No `error.tsx` or `not-found.tsx` boundaries anywhere in the app, only one root `loading.tsx`.
  With ~68 client-rendered pages doing their own fetching, failed requests currently render as a
  blank hang with no recovery UI. Add at minimum a root `error.tsx` and one for `/v2/discussions`.

---

## Suggested order of operations

1. **C1** — move all 11 admin pages off direct anon-client reads onto service-role API routes.
2. **C2** — revoke the safe column set, then do the `profile_sensitive` table split for DOB/age fields.
3. **H1** — test and fix v2 discussion creation; delete the fake-table pipeline.
4. **H4** — add `/v2/:path*` to the proxy matcher (quick, do it alongside H1).
5. **H2** — consolidate v1/v2 routes with redirects once creation is confirmed safe.
6. **H3** — parity pass on stubbed v2 controls.
7. **M1, M3** — quick cleanup (dead middleware, get the repo out of iCloud sync) — can be done anytime, low risk.
8. **M2, M4, M5, M6** — performance and consistency work, schedule as capacity allows.
9. **Low severity** — opportunistic cleanup.

Items 1–4 involve real user data and a possibly-broken core feature; treat those as this week's work,
not backlog.
