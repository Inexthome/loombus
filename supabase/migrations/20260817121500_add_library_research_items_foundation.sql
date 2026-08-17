-- Loombus Library Save to Research foundation.
-- Stores a member-private research item captured from one exact normalized Reader passage.
--
-- Offsets use the same canonical Reader contract as durable highlights and Discuss Passage:
-- zero-based UTF-16 code-unit offsets into library_publication_sections.content_text, with
-- an exclusive end offset. PostgreSQL text indexing is not UTF-16 compatible, so exact
-- range/hash/text agreement MUST be revalidated in server-side JavaScript before insert.
--
-- locator intentionally remains a logical section key rather than a foreign key to
-- library_publication_sections. Controlled re-ingestion may replace normalized section rows;
-- a destructive section foreign key could silently delete a member's research item.

create table if not exists public.library_research_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  publication_id uuid not null references public.library_publications(id) on delete cascade,
  locator text not null,
  selected_text text not null,
  start_offset integer not null,
  end_offset integer not null,
  text_sha256 text not null,
  created_at timestamptz not null default now(),
  constraint library_research_items_range_check check (
    start_offset >= 0
    and end_offset > start_offset
    and char_length(selected_text) between 1 and 4000
    and text_sha256 ~ '^[0-9a-f]{64}$'
  ),
  constraint library_research_items_unique_passage unique (
    user_id,
    publication_id,
    locator,
    start_offset,
    end_offset,
    text_sha256
  )
);

create index if not exists library_research_items_user_created_idx
  on public.library_research_items(user_id, created_at desc);

create index if not exists library_research_items_user_publication_created_idx
  on public.library_research_items(user_id, publication_id, created_at desc);

alter table public.library_research_items enable row level security;

drop policy if exists "members read own library research items" on public.library_research_items;
create policy "members read own library research items"
  on public.library_research_items
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Insert is owner-only and must point at an existing normalized section of the same
-- published publication. Exact UTF-16 substring/hash validation remains a server-runtime
-- responsibility because PostgreSQL text indexing cannot reproduce JavaScript code units.
drop policy if exists "members create own valid library research items" on public.library_research_items;
create policy "members create own valid library research items"
  on public.library_research_items
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.library_publications p
      join public.library_publication_sections s
        on s.publication_id = p.id
      where p.id = library_research_items.publication_id
        and s.section_key = library_research_items.locator
        and p.status = 'published'
    )
  );

drop policy if exists "members delete own library research items" on public.library_research_items;
create policy "members delete own library research items"
  on public.library_research_items
  for delete
  to authenticated
  using (auth.uid() = user_id);

revoke all on table public.library_research_items from anon;
revoke all on table public.library_research_items from authenticated;
grant select, insert, delete on table public.library_research_items to authenticated;

comment on table public.library_research_items is
  'Member-private research items captured from exact normalized Loombus Library passages. Exact UTF-16 range/hash/text validation is a server-runtime responsibility.';

comment on column public.library_research_items.locator is
  'Stable logical library_publication_sections.section_key locator; intentionally not a destructive section foreign key.';
comment on column public.library_research_items.start_offset is
  'Zero-based UTF-16 code-unit start offset into normalized section content_text.';
comment on column public.library_research_items.end_offset is
  'Exclusive zero-based UTF-16 code-unit end offset into normalized section content_text.';
comment on column public.library_research_items.text_sha256 is
  'Lowercase SHA-256 of the full normalized section content_text used to bind the research passage to an exact text version.';
