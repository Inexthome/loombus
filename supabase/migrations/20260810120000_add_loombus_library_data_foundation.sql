-- Loombus Library persistent data foundation.
-- Scope: metadata, personal library state, reading progress, highlights, and notes.
-- No uploads, commerce, DRM, author publishing, or AI execution are enabled here.

create extension if not exists pgcrypto;

create table if not exists public.library_publications (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  subtitle text,
  description text,
  publication_type text not null check (publication_type in ('book','essay','research','report','guide','article','other')),
  author_name text,
  publisher_name text,
  language_code text not null default 'en',
  cover_url text,
  isbn text,
  publication_date date,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  is_free boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.library_member_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  publication_id uuid not null references public.library_publications(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (user_id, publication_id)
);

create table if not exists public.library_reading_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  publication_id uuid not null references public.library_publications(id) on delete cascade,
  locator text,
  progress_percent numeric(5,2) not null default 0 check (progress_percent >= 0 and progress_percent <= 100),
  last_read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, publication_id)
);

create table if not exists public.library_highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  publication_id uuid not null references public.library_publications(id) on delete cascade,
  locator text not null,
  selected_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.library_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  publication_id uuid not null references public.library_publications(id) on delete cascade,
  highlight_id uuid references public.library_highlights(id) on delete cascade,
  locator text,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists library_publications_status_idx on public.library_publications(status);
create index if not exists library_member_items_user_added_idx on public.library_member_items(user_id, added_at desc);
create index if not exists library_reading_progress_user_last_read_idx on public.library_reading_progress(user_id, last_read_at desc);
create index if not exists library_highlights_user_publication_idx on public.library_highlights(user_id, publication_id, created_at desc);
create index if not exists library_notes_user_publication_idx on public.library_notes(user_id, publication_id, created_at desc);

alter table public.library_publications enable row level security;
alter table public.library_member_items enable row level security;
alter table public.library_reading_progress enable row level security;
alter table public.library_highlights enable row level security;
alter table public.library_notes enable row level security;

-- Published metadata is readable to signed-in members. Draft/archive management remains server/admin-only.
drop policy if exists "library publications readable when published" on public.library_publications;
create policy "library publications readable when published"
on public.library_publications for select
to authenticated
using (status = 'published');

-- Personal Library rows are strictly owner-scoped.
drop policy if exists "members read own library items" on public.library_member_items;
create policy "members read own library items" on public.library_member_items for select to authenticated using (auth.uid() = user_id);
drop policy if exists "members add own library items" on public.library_member_items;
create policy "members add own library items" on public.library_member_items for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "members remove own library items" on public.library_member_items;
create policy "members remove own library items" on public.library_member_items for delete to authenticated using (auth.uid() = user_id);

-- Reading position is private to its member.
drop policy if exists "members read own reading progress" on public.library_reading_progress;
create policy "members read own reading progress" on public.library_reading_progress for select to authenticated using (auth.uid() = user_id);
drop policy if exists "members create own reading progress" on public.library_reading_progress;
create policy "members create own reading progress" on public.library_reading_progress for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "members update own reading progress" on public.library_reading_progress;
create policy "members update own reading progress" on public.library_reading_progress for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "members delete own reading progress" on public.library_reading_progress;
create policy "members delete own reading progress" on public.library_reading_progress for delete to authenticated using (auth.uid() = user_id);

-- Highlights are private by default. A future explicit sharing model must add a separate public/discussion boundary.
drop policy if exists "members read own highlights" on public.library_highlights;
create policy "members read own highlights" on public.library_highlights for select to authenticated using (auth.uid() = user_id);
drop policy if exists "members create own highlights" on public.library_highlights;
create policy "members create own highlights" on public.library_highlights for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "members update own highlights" on public.library_highlights;
create policy "members update own highlights" on public.library_highlights for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "members delete own highlights" on public.library_highlights;
create policy "members delete own highlights" on public.library_highlights for delete to authenticated using (auth.uid() = user_id);

-- Notes are private by default and cannot be used to read another member's highlight.
drop policy if exists "members read own notes" on public.library_notes;
create policy "members read own notes" on public.library_notes for select to authenticated using (auth.uid() = user_id);
drop policy if exists "members create own notes" on public.library_notes;
create policy "members create own notes" on public.library_notes for insert to authenticated with check (
  auth.uid() = user_id
  and (highlight_id is null or exists (
    select 1 from public.library_highlights h
    where h.id = highlight_id and h.user_id = auth.uid() and h.publication_id = publication_id
  ))
);
drop policy if exists "members update own notes" on public.library_notes;
create policy "members update own notes" on public.library_notes for update to authenticated using (auth.uid() = user_id) with check (
  auth.uid() = user_id
  and (highlight_id is null or exists (
    select 1 from public.library_highlights h
    where h.id = highlight_id and h.user_id = auth.uid() and h.publication_id = publication_id
  ))
);
drop policy if exists "members delete own notes" on public.library_notes;
create policy "members delete own notes" on public.library_notes for delete to authenticated using (auth.uid() = user_id);

revoke all on table public.library_publications from anon;
revoke all on table public.library_member_items from anon;
revoke all on table public.library_reading_progress from anon;
revoke all on table public.library_highlights from anon;
revoke all on table public.library_notes from anon;

grant select on table public.library_publications to authenticated;
grant select, insert, delete on table public.library_member_items to authenticated;
grant select, insert, update, delete on table public.library_reading_progress to authenticated;
grant select, insert, update, delete on table public.library_highlights to authenticated;
grant select, insert, update, delete on table public.library_notes to authenticated;
