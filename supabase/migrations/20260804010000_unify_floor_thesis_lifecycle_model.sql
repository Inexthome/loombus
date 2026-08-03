-- Canonicalize The Floor's thesis lifecycle on lifecycle_status
-- (active/withdrawn/deleted) + withdrawn_at -- the model every feed
-- component (the-floor-page, the-floor-company-intelligence,
-- the-floor-opening-bell, the-floor-earnings-center, the-floor-my-theses)
-- already filters on. status ('open'/'closed') never left its 'open'
-- default in production and nothing in application code reads it; rather
-- than carry two parallel vocabularies forward, this drops it and moves
-- RLS + the live-feed index off deleted_at onto lifecycle_status.
--
-- No backfill needed: verified against production (read-only) that every
-- row's lifecycle_status/deleted_at already agree and status is uniformly
-- 'open'.
--
-- This also removes "thesis authors update own", a permissive UPDATE
-- policy left over from 20260801030000_floor_thesis_lifecycle.sql (added
-- before this table had a real UPDATE policy). Postgres OR's multiple
-- permissive policies together, so its bare `author_id = auth.uid()` check
-- has been silently overriding "Thesis authors can edit their open
-- thesis"'s deleted_at guard ever since -- an author could update a
-- deleted thesis by calling the Supabase REST API directly.

begin;

drop policy if exists "thesis authors update own" on public.floor_theses;

drop policy if exists "Floor theses are visible to eligible members" on public.floor_theses;
create policy "Floor theses are visible to eligible members"
on public.floor_theses for select to authenticated
using (
  lifecycle_status <> 'deleted'
  or author_id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
);

drop policy if exists "Eligible members can post their own thesis" on public.floor_theses;
create policy "Eligible members can post their own thesis"
on public.floor_theses for insert to authenticated
with check (
  author_id = auth.uid()
  and public.floor_member_is_eligible()
  and lifecycle_status = 'active'
);

drop policy if exists "Thesis authors can edit their open thesis" on public.floor_theses;
create policy "Thesis authors can edit their own thesis"
on public.floor_theses for update to authenticated
using (author_id = auth.uid() and lifecycle_status <> 'deleted')
with check (author_id = auth.uid());

drop policy if exists "Eligible members can post their own falsifiable call" on public.floor_calls;
create policy "Eligible members can post their own falsifiable call"
on public.floor_calls for insert to authenticated
with check (
  author_id = auth.uid()
  and public.floor_member_is_eligible()
  and status = 'pending'
  and outcome is null
  and resolved_value is null
  and resolved_at is null
  and resolved_by is null
  and resolves_by > now()
  and exists (
    select 1 from public.floor_theses t
    where t.id = thesis_id
      and t.author_id = auth.uid()
      and t.lifecycle_status = 'active'
  )
);

drop index if exists public.floor_theses_live_feed_idx;
create index if not exists floor_theses_live_feed_idx
  on public.floor_theses (created_at desc)
  where lifecycle_status <> 'deleted';

alter table public.floor_theses drop constraint if exists floor_theses_status_check;
alter table public.floor_theses drop column if exists status;

commit;
