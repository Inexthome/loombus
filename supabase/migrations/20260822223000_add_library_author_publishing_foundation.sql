-- Loombus Library author publishing foundation.
--
-- Establishes a private ownership/review boundary for member-authored Library
-- publications without changing the existing public publication metadata shape.
-- Author ownership is deliberately kept out of library_publications so member UUIDs
-- are not exposed through the existing published-publication SELECT policy.

create table if not exists public.library_author_publications (
  publication_id uuid primary key references public.library_publications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  submission_status text not null default 'draft',
  submitted_at timestamptz,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint library_author_publications_submission_status_check check (
    submission_status in ('draft', 'submitted', 'changes_requested', 'approved', 'rejected')
  ),
  constraint library_author_publications_review_note_check check (
    review_note is null or char_length(review_note) <= 2000
  ),
  constraint library_author_publications_submission_time_check check (
    submission_status = 'draft' or submitted_at is not null
  ),
  constraint library_author_publications_review_time_check check (
    submission_status not in ('changes_requested', 'approved', 'rejected') or reviewed_at is not null
  )
);

create index if not exists library_author_publications_user_updated_idx
  on public.library_author_publications(user_id, updated_at desc);

create index if not exists library_author_publications_submission_status_idx
  on public.library_author_publications(submission_status, submitted_at desc)
  where submission_status <> 'draft';

alter table public.library_author_publications enable row level security;

-- Authors may read only their own private ownership/review row. This foundation does
-- not grant browser INSERT/UPDATE/DELETE; author creation, upload, submission, and
-- review transitions remain controlled follow-on runtime work.
drop policy if exists "authors read own library publication ownership" on public.library_author_publications;
create policy "authors read own library publication ownership"
  on public.library_author_publications
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Existing published metadata remains readable through the original published-only
-- policy. This additional policy lets a future author workspace read its own draft
-- publication metadata after a controlled server/runtime path creates the ownership row.
drop policy if exists "authors read own library publication metadata" on public.library_publications;
create policy "authors read own library publication metadata"
  on public.library_publications
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.library_author_publications author_publication
      where author_publication.publication_id = library_publications.id
        and author_publication.user_id = auth.uid()
    )
  );

revoke all on table public.library_author_publications from anon;
revoke all on table public.library_author_publications from authenticated;
grant select on table public.library_author_publications to authenticated;

comment on table public.library_author_publications is
  'Private single-owner author publishing/review state for Library publications. Public publication metadata remains in library_publications; browser mutation is not enabled by this foundation.';
comment on column public.library_author_publications.user_id is
  'Private member owner. Kept separate from library_publications to avoid exposing member UUIDs through published metadata reads.';
comment on column public.library_author_publications.submission_status is
  'Controlled author publishing workflow state. This foundation does not grant authors direct browser mutation of review state.';
