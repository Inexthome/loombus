# V2 Create draft persistence

This checkpoint adds private draft persistence to the gated V2 Create preview without publishing anything and without replacing the current V1 composer.

## Route

- `/v2/create`

## Database

Adds migration:

- `supabase/migrations/20260625193000_create_v2_create_drafts.sql`

Adds table:

- `public.loombus_v2_create_drafts`

Each user can have one private V2 create draft.

## What it does

- Checks `/api/v2/shell` before rendering.
- Requires `v2_shell` access for the signed-in account.
- Restores the signed-in user's private V2 draft when available.
- Saves title, topic, body, optional tags, and discussion mode.
- Allows clearing the private draft.
- Keeps copy-to-clipboard handoff to the V1 composer.
- Keeps V1 `/create` as the only live publishing path.

## Safety model

- Does not insert into `discussions`.
- Does not publish posts.
- Does not submit replies.
- Does not replace `/create`.
- Does not modify public V1 navigation.
- Does not enable `v2_rooms`.
- Does not change rollout percentage.
- RLS limits draft access to the owning authenticated user.
- Public users and non-allowlisted accounts remain on V1.

## Migration test plan

1. Apply the migration in Supabase.
2. Confirm `public.loombus_v2_create_drafts` exists.
3. Confirm RLS is enabled.
4. Confirm policies only allow each user to access their own row.

## Manual product test plan

1. Keep `v2_shell` allowlisted only to the internal user.
2. Open `/v2/create` as that account.
3. Enter title, topic, body, tags, and a mode.
4. Click Save private draft.
5. Refresh `/v2/create`.
6. Confirm the draft restores.
7. Click Clear draft.
8. Refresh `/v2/create`.
9. Confirm the draft no longer restores.
10. Confirm `/create` still renders the current V1 composer.
11. Confirm signed-out or non-allowlisted accounts cannot render the V2 preview.

## Not included yet

- Publishing from V2.
- Multiple named drafts.
- Autosave.
- Attachments or video upload.
- AI-assisted drafting.
- Replacing the V1 composer.
- Public navigation entry.
