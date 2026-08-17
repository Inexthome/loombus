-- Loombus Library Reader bookmark foundation.
-- Bookmarks are private, owner-scoped pointers to normalized publication sections.
-- Search and Table of Contents UI are deliberately outside this schema-only phase.

create table if not exists public.library_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  publication_id uuid not null references public.library_publications(id) on delete cascade,
  locator text not null,
  created_at timestamptz not null default now(),
  unique (user_id, publication_id, locator)
);

create index if not exists library_bookmarks_user_publication_created_idx
  on public.library_bookmarks(user_id, publication_id, created_at desc);

alter table public.library_bookmarks enable row level security;

-- Bookmarks are private to their owner.
drop policy if exists "members read own library bookmarks" on public.library_bookmarks;
create policy "members read own library bookmarks"
  on public.library_bookmarks
  for select
  to authenticated
  using (auth.uid() = user_id);

-- A bookmark may only target a normalized section belonging to the same published publication.
-- This prevents cross-publication locator binding while avoiding a destructive FK to normalized
-- section rows that may be replaced during future controlled re-ingestion.
drop policy if exists "members create own valid library bookmarks" on public.library_bookmarks;
create policy "members create own valid library bookmarks"
  on public.library_bookmarks
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.library_publications p
      join public.library_publication_sections s
        on s.publication_id = p.id
      where p.id = library_bookmarks.publication_id
        and p.status = 'published'
        and s.section_key = library_bookmarks.locator
    )
  );

drop policy if exists "members delete own library bookmarks" on public.library_bookmarks;
create policy "members delete own library bookmarks"
  on public.library_bookmarks
  for delete
  to authenticated
  using (auth.uid() = user_id);

revoke all on table public.library_bookmarks from anon;
grant select, insert, delete on table public.library_bookmarks to authenticated;
