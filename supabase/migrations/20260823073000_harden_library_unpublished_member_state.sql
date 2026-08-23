-- Keep private Library state durable while hiding it from normal member reads
-- whenever the parent publication is not currently published.
--
-- These are RESTRICTIVE SELECT policies. Existing owner-scoped permissive
-- policies still establish ownership; these policies additionally require the
-- canonical publication to be public. Rows are preserved and become visible
-- again if an archived publication is legitimately republished.

create or replace function public.library_publication_is_currently_published(
  p_publication_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
      from public.library_publications p
     where p.id = p_publication_id
       and p.status = 'published'
  );
$$;

revoke all on function public.library_publication_is_currently_published(uuid) from public;
grant execute on function public.library_publication_is_currently_published(uuid) to authenticated;

-- Saved Library membership.
drop policy if exists "members read saved items only while publication is published"
  on public.library_member_items;
create policy "members read saved items only while publication is published"
  on public.library_member_items
  as restrictive
  for select
  to authenticated
  using (public.library_publication_is_currently_published(publication_id));

-- Reading progress.
drop policy if exists "members read progress only while publication is published"
  on public.library_reading_progress;
create policy "members read progress only while publication is published"
  on public.library_reading_progress
  as restrictive
  for select
  to authenticated
  using (public.library_publication_is_currently_published(publication_id));

-- Highlights.
drop policy if exists "members read highlights only while publication is published"
  on public.library_highlights;
create policy "members read highlights only while publication is published"
  on public.library_highlights
  as restrictive
  for select
  to authenticated
  using (public.library_publication_is_currently_published(publication_id));

-- Private notes.
drop policy if exists "members read notes only while publication is published"
  on public.library_notes;
create policy "members read notes only while publication is published"
  on public.library_notes
  as restrictive
  for select
  to authenticated
  using (public.library_publication_is_currently_published(publication_id));

-- Bookmarks.
drop policy if exists "members read bookmarks only while publication is published"
  on public.library_bookmarks;
create policy "members read bookmarks only while publication is published"
  on public.library_bookmarks
  as restrictive
  for select
  to authenticated
  using (public.library_publication_is_currently_published(publication_id));

comment on function public.library_publication_is_currently_published(uuid) is
  'Returns true only when the canonical Library publication is currently published. Used by restrictive member-state SELECT policies so unavailable work does not surface while private rows remain preserved.';
