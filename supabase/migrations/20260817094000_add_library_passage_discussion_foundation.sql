-- Loombus Library Discuss Passage foundation.
-- Stores durable provenance for one normalized Reader passage that seeds one Loombus discussion.
-- This schema is intentionally fail-closed: passage provenance is private to its creator until
-- the follow-on runtime proves and reuses the canonical discussion-visibility boundary.
--
-- Offsets use the same contract as durable Reader highlights: zero-based UTF-16 code-unit
-- offsets into library_publication_sections.content_text, with an exclusive end offset.
-- PostgreSQL text indexing is not UTF-16 compatible, so exact range/hash/text agreement MUST
-- be revalidated in server-side JavaScript before a provenance row is inserted.

create table if not exists public.library_passage_discussions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  discussion_id uuid not null references public.discussions(id) on delete cascade,
  publication_id uuid not null references public.library_publications(id) on delete cascade,
  locator text not null,
  selected_text text not null,
  start_offset integer not null,
  end_offset integer not null,
  text_sha256 text not null,
  created_at timestamptz not null default now(),
  unique (discussion_id),
  constraint library_passage_discussions_range_check check (
    start_offset >= 0
    and end_offset > start_offset
    and char_length(selected_text) between 1 and 4000
    and text_sha256 ~ '^[0-9a-f]{64}$'
  )
);

create index if not exists library_passage_discussions_user_publication_created_idx
  on public.library_passage_discussions(user_id, publication_id, created_at desc);

alter table public.library_passage_discussions enable row level security;

-- Phase-one visibility is owner-only. The runtime phase may broaden this only by reusing the
-- already-proven discussion audience/visibility contract; it must not invent a parallel rule.
drop policy if exists "members read own library passage discussions" on public.library_passage_discussions;
create policy "members read own library passage discussions"
  on public.library_passage_discussions
  for select
  to authenticated
  using (auth.uid() = user_id);

-- A provenance row must belong to the authenticated creator, point at that creator's discussion,
-- and reference an existing normalized section of the same published publication.
drop policy if exists "members create own valid library passage discussions" on public.library_passage_discussions;
create policy "members create own valid library passage discussions"
  on public.library_passage_discussions
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.discussions d
      where d.id = library_passage_discussions.discussion_id
        and d.user_id = auth.uid()
    )
    and exists (
      select 1
      from public.library_publications p
      join public.library_publication_sections s
        on s.publication_id = p.id
      where p.id = library_passage_discussions.publication_id
        and s.section_key = library_passage_discussions.locator
        and p.status = 'published'
    )
  );

drop policy if exists "members delete own library passage discussions" on public.library_passage_discussions;
create policy "members delete own library passage discussions"
  on public.library_passage_discussions
  for delete
  to authenticated
  using (auth.uid() = user_id);

revoke all on table public.library_passage_discussions from anon;
revoke all on table public.library_passage_discussions from authenticated;
grant select, insert, delete on table public.library_passage_discussions to authenticated;

comment on table public.library_passage_discussions is
  'Private durable provenance linking one normalized Loombus Library passage to one discussion. Exact UTF-16 range/hash/text validation is a server-runtime responsibility.';

comment on column public.library_passage_discussions.locator is
  'Stable normalized library_publication_sections.section_key locator.';
comment on column public.library_passage_discussions.start_offset is
  'Zero-based UTF-16 code-unit start offset into normalized section content_text.';
comment on column public.library_passage_discussions.end_offset is
  'Exclusive zero-based UTF-16 code-unit end offset into normalized section content_text.';
comment on column public.library_passage_discussions.text_sha256 is
  'Lowercase SHA-256 of the full normalized section content_text used to bind the passage to an exact text version.';
