-- Reader-state behavior across active publication-version switches.
-- Historical rows stay stored with their exact version_id. Ordinary Reader state exposes only
-- the active version for highlights/notes/bookmarks. Research/discussion provenance remains historical.

create or replace function public.library_row_targets_active_version(p_publication_id uuid, p_version_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.library_publications p
    where p.id = p_publication_id
      and p.status = 'published'
      and p.active_version_id = p_version_id
  );
$$;
revoke all on function public.library_row_targets_active_version(uuid,uuid) from public;
grant execute on function public.library_row_targets_active_version(uuid,uuid) to authenticated;

-- Existing Reader clients omit version_id. Keep inserts bound to active_version_id via #1027's
-- assignment trigger, and fail closed if a caller tries to bind current Reader state elsewhere.
drop policy if exists "active version only library highlights" on public.library_highlights;
create policy "active version only library highlights"
  on public.library_highlights as restrictive for all to authenticated
  using (public.library_row_targets_active_version(publication_id,version_id))
  with check (public.library_row_targets_active_version(publication_id,version_id));

drop policy if exists "active version only library notes" on public.library_notes;
create policy "active version only library notes"
  on public.library_notes as restrictive for all to authenticated
  using (public.library_row_targets_active_version(publication_id,version_id))
  with check (public.library_row_targets_active_version(publication_id,version_id));

drop policy if exists "active version only library bookmarks" on public.library_bookmarks;
create policy "active version only library bookmarks"
  on public.library_bookmarks as restrictive for all to authenticated
  using (public.library_row_targets_active_version(publication_id,version_id))
  with check (public.library_row_targets_active_version(publication_id,version_id));

-- Reading progress remains a single current cursor per publication for compatibility with the
-- existing (user_id, publication_id) key. On its next upsert after a revision is published, the
-- row is rebound to the active version. Passage-level annotations/provenance are never rewritten.
create or replace function public.library_assign_current_reading_progress_version()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  select p.active_version_id into new.version_id
    from public.library_publications p
   where p.id = new.publication_id
     and p.status = 'published';
  if new.version_id is null then raise exception 'library_reading_progress_active_version_required'; end if;
  return new;
end;
$$;

drop trigger if exists library_reading_progress_assign_version on public.library_reading_progress;
create trigger library_reading_progress_assign_version
before insert or update on public.library_reading_progress
for each row execute function public.library_assign_current_reading_progress_version();

comment on function public.library_row_targets_active_version(uuid,uuid) is
  'Fail-closed check used by Reader-state RLS so ordinary current Reader annotations cannot drift across publication versions.';
