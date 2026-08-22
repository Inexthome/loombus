-- Loombus Library reply -> private knowledge feedback foundation.
--
-- Extends the discussion feedback loop from canonical opening-post bodies to canonical visible replies.
-- Exact selection provenance remains private to the member creating the derived Library object.
-- Offsets are zero-based UTF-16 code-unit offsets into replies.body, end exclusive.
-- PostgreSQL text indexing is not UTF-16 compatible, so the follow-on server runtime MUST
-- re-fetch the canonical visible reply, recompute SHA-256, and validate the exact JS slice.

create table if not exists public.library_reply_claim_derivations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  discussion_id uuid not null references public.discussions(id) on delete cascade,
  reply_id uuid not null references public.replies(id) on delete cascade,
  reply_author_id uuid not null references auth.users(id) on delete cascade,
  claim_id uuid references public.library_research_claims(id) on delete set null,
  source_discussion_title text not null,
  source_discussion_topic text not null,
  selected_text text not null,
  start_offset integer not null,
  end_offset integer not null,
  reply_body_sha256 text not null,
  derived_statement text not null,
  derived_claim_type text not null,
  derived_claim_status text not null,
  created_at timestamptz not null default now(),
  constraint library_reply_claim_derivations_source_title_check check (
    char_length(btrim(source_discussion_title)) between 1 and 500
  ),
  constraint library_reply_claim_derivations_source_topic_check check (
    char_length(btrim(source_discussion_topic)) between 1 and 120
  ),
  constraint library_reply_claim_derivations_range_check check (
    start_offset >= 0
    and end_offset > start_offset
    and char_length(selected_text) between 20 and 4000
    and reply_body_sha256 ~ '^[0-9a-f]{64}$'
  ),
  constraint library_reply_claim_derivations_statement_check check (
    char_length(btrim(derived_statement)) between 1 and 2000
  ),
  constraint library_reply_claim_derivations_type_check check (
    derived_claim_type in ('claim', 'question', 'conclusion')
  ),
  constraint library_reply_claim_derivations_status_check check (
    derived_claim_status in ('draft', 'working', 'supported', 'contested')
  )
);

create index if not exists library_reply_claim_derivations_user_created_idx
  on public.library_reply_claim_derivations(user_id, created_at desc);
create index if not exists library_reply_claim_derivations_discussion_reply_idx
  on public.library_reply_claim_derivations(discussion_id, reply_id, created_at desc);
create index if not exists library_reply_claim_derivations_claim_idx
  on public.library_reply_claim_derivations(claim_id, created_at desc)
  where claim_id is not null;

create table if not exists public.library_reply_knowledge_derivations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  discussion_id uuid not null references public.discussions(id) on delete cascade,
  reply_id uuid not null references public.replies(id) on delete cascade,
  reply_author_id uuid not null references auth.users(id) on delete cascade,
  knowledge_object_id uuid references public.library_knowledge_objects(id) on delete set null,
  source_discussion_title text not null,
  source_discussion_topic text not null,
  selected_text text not null,
  start_offset integer not null,
  end_offset integer not null,
  reply_body_sha256 text not null,
  derived_title text not null,
  derived_summary text,
  derived_knowledge_type text not null,
  derived_knowledge_status text not null,
  created_at timestamptz not null default now(),
  constraint library_reply_knowledge_derivations_source_title_check check (
    char_length(btrim(source_discussion_title)) between 1 and 500
  ),
  constraint library_reply_knowledge_derivations_source_topic_check check (
    char_length(btrim(source_discussion_topic)) between 1 and 120
  ),
  constraint library_reply_knowledge_derivations_range_check check (
    start_offset >= 0
    and end_offset > start_offset
    and char_length(selected_text) between 20 and 4000
    and reply_body_sha256 ~ '^[0-9a-f]{64}$'
  ),
  constraint library_reply_knowledge_derivations_title_check check (
    char_length(btrim(derived_title)) between 1 and 160
  ),
  constraint library_reply_knowledge_derivations_summary_check check (
    derived_summary is null or char_length(derived_summary) <= 10000
  ),
  constraint library_reply_knowledge_derivations_type_check check (
    derived_knowledge_type in ('synthesis', 'finding', 'open_question')
  ),
  constraint library_reply_knowledge_derivations_status_check check (
    derived_knowledge_status in ('draft', 'working', 'synthesized')
  )
);

create index if not exists library_reply_knowledge_derivations_user_created_idx
  on public.library_reply_knowledge_derivations(user_id, created_at desc);
create index if not exists library_reply_knowledge_derivations_discussion_reply_idx
  on public.library_reply_knowledge_derivations(discussion_id, reply_id, created_at desc);
create index if not exists library_reply_knowledge_derivations_knowledge_idx
  on public.library_reply_knowledge_derivations(knowledge_object_id, created_at desc)
  where knowledge_object_id is not null;

alter table public.library_reply_claim_derivations enable row level security;
alter table public.library_reply_knowledge_derivations enable row level security;

-- Browser clients may read their own immutable provenance only.
drop policy if exists "members read own library reply claim derivations"
  on public.library_reply_claim_derivations;
create policy "members read own library reply claim derivations"
  on public.library_reply_claim_derivations
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "members create own library reply claim derivations"
  on public.library_reply_claim_derivations;
create policy "members create own library reply claim derivations"
  on public.library_reply_claim_derivations
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and claim_id is not null
    and exists (
      select 1
      from public.discussions discussion
      join public.replies reply on reply.discussion_id = discussion.id
      where discussion.id = library_reply_claim_derivations.discussion_id
        and reply.id = library_reply_claim_derivations.reply_id
        and reply.user_id = library_reply_claim_derivations.reply_author_id
        and reply.deleted_at is null
        and discussion.deleted_at is null
        and discussion.title = library_reply_claim_derivations.source_discussion_title
        and discussion.topic = library_reply_claim_derivations.source_discussion_topic
    )
    and exists (
      select 1 from public.library_research_claims claim
      where claim.id = library_reply_claim_derivations.claim_id
        and claim.user_id = auth.uid()
        and claim.statement = library_reply_claim_derivations.derived_statement
        and claim.claim_type = library_reply_claim_derivations.derived_claim_type
        and claim.status = library_reply_claim_derivations.derived_claim_status
    )
  );

drop policy if exists "members read own library reply knowledge derivations"
  on public.library_reply_knowledge_derivations;
create policy "members read own library reply knowledge derivations"
  on public.library_reply_knowledge_derivations
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "members create own library reply knowledge derivations"
  on public.library_reply_knowledge_derivations;
create policy "members create own library reply knowledge derivations"
  on public.library_reply_knowledge_derivations
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and knowledge_object_id is not null
    and exists (
      select 1
      from public.discussions discussion
      join public.replies reply on reply.discussion_id = discussion.id
      where discussion.id = library_reply_knowledge_derivations.discussion_id
        and reply.id = library_reply_knowledge_derivations.reply_id
        and reply.user_id = library_reply_knowledge_derivations.reply_author_id
        and reply.deleted_at is null
        and discussion.deleted_at is null
        and discussion.title = library_reply_knowledge_derivations.source_discussion_title
        and discussion.topic = library_reply_knowledge_derivations.source_discussion_topic
    )
    and exists (
      select 1 from public.library_knowledge_objects knowledge
      where knowledge.id = library_reply_knowledge_derivations.knowledge_object_id
        and knowledge.user_id = auth.uid()
        and knowledge.title = library_reply_knowledge_derivations.derived_title
        and coalesce(knowledge.summary, '') = coalesce(library_reply_knowledge_derivations.derived_summary, '')
        and knowledge.knowledge_type = library_reply_knowledge_derivations.derived_knowledge_type
        and knowledge.status = library_reply_knowledge_derivations.derived_knowledge_status
    )
  );

revoke all on table public.library_reply_claim_derivations from anon;
revoke all on table public.library_reply_knowledge_derivations from anon;
revoke all on table public.library_reply_claim_derivations from authenticated;
revoke all on table public.library_reply_knowledge_derivations from authenticated;

grant select, insert on table public.library_reply_claim_derivations to authenticated;
grant select, insert on table public.library_reply_knowledge_derivations to authenticated;

comment on table public.library_reply_claim_derivations is
  'Private immutable provenance linking an exact validated visible Loombus reply selection to a member-owned Library Research claim.';
comment on table public.library_reply_knowledge_derivations is
  'Private immutable provenance linking an exact validated visible Loombus reply selection to a member-owned Library knowledge object.';
comment on column public.library_reply_claim_derivations.reply_body_sha256 is
  'Lowercase SHA-256 of the full canonical replies.body at derivation time; exact hash/range/text validation is a server-runtime responsibility.';
comment on column public.library_reply_knowledge_derivations.reply_body_sha256 is
  'Lowercase SHA-256 of the full canonical replies.body at derivation time; exact hash/range/text validation is a server-runtime responsibility.';
