-- Loombus Library knowledge -> discussion promotion foundation.
--
-- Establishes an explicit opt-in provenance boundary for promoting a private Library
-- knowledge object into a public Loombus discussion. The private knowledge object,
-- private claims, evidence notes, and saved-passage provenance are never made public
-- by this schema. Runtime must create the discussion through the existing guarded
-- discussion-creation path, then insert a private promotion provenance row.

create table if not exists public.library_knowledge_discussion_promotions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  knowledge_object_id uuid references public.library_knowledge_objects(id) on delete set null,
  discussion_id uuid not null references public.discussions(id) on delete cascade,
  published_title text not null,
  published_summary text,
  source_knowledge_type text not null,
  source_knowledge_status text not null,
  source_updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (discussion_id),
  constraint library_knowledge_discussion_promotions_title_check check (
    char_length(btrim(published_title)) between 1 and 160
  ),
  constraint library_knowledge_discussion_promotions_summary_check check (
    published_summary is null or char_length(published_summary) <= 10000
  ),
  constraint library_knowledge_discussion_promotions_type_check check (
    source_knowledge_type in ('synthesis', 'finding', 'open_question')
  ),
  constraint library_knowledge_discussion_promotions_status_check check (
    source_knowledge_status in ('draft', 'working', 'synthesized')
  )
);

create index if not exists library_knowledge_discussion_promotions_user_created_idx
  on public.library_knowledge_discussion_promotions(user_id, created_at desc);

create index if not exists library_knowledge_discussion_promotions_knowledge_idx
  on public.library_knowledge_discussion_promotions(knowledge_object_id, created_at desc)
  where knowledge_object_id is not null;

create table if not exists public.library_knowledge_discussion_claims (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references public.library_knowledge_discussion_promotions(id) on delete cascade,
  claim_id uuid references public.library_research_claims(id) on delete set null,
  published_statement text not null,
  published_claim_type text not null,
  published_claim_status text not null,
  published_role text not null,
  created_at timestamptz not null default now(),
  constraint library_knowledge_discussion_claims_statement_check check (
    char_length(btrim(published_statement)) between 1 and 2000
  ),
  constraint library_knowledge_discussion_claims_type_check check (
    published_claim_type in ('claim', 'question', 'conclusion')
  ),
  constraint library_knowledge_discussion_claims_status_check check (
    published_claim_status in ('draft', 'working', 'supported', 'contested')
  ),
  constraint library_knowledge_discussion_claims_role_check check (
    published_role in ('core', 'supporting', 'counterpoint')
  )
);

create unique index if not exists library_knowledge_discussion_claims_promotion_claim_unique_idx
  on public.library_knowledge_discussion_claims(promotion_id, claim_id)
  where claim_id is not null;

create index if not exists library_knowledge_discussion_claims_promotion_created_idx
  on public.library_knowledge_discussion_claims(promotion_id, created_at asc);

alter table public.library_knowledge_discussion_promotions enable row level security;
alter table public.library_knowledge_discussion_claims enable row level security;

-- Promotion provenance is private to the member who explicitly created the public discussion.
drop policy if exists "members read own library knowledge discussion promotions"
  on public.library_knowledge_discussion_promotions;
create policy "members read own library knowledge discussion promotions"
  on public.library_knowledge_discussion_promotions
  for select to authenticated
  using (auth.uid() = user_id);

-- Insert only after both sides are owned by the authenticated member. The runtime must
-- snapshot the current knowledge fields that were actually approved for publication.
drop policy if exists "members create own library knowledge discussion promotions"
  on public.library_knowledge_discussion_promotions;
create policy "members create own library knowledge discussion promotions"
  on public.library_knowledge_discussion_promotions
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and knowledge_object_id is not null
    and exists (
      select 1
      from public.library_knowledge_objects knowledge
      where knowledge.id = library_knowledge_discussion_promotions.knowledge_object_id
        and knowledge.user_id = auth.uid()
        and knowledge.title = library_knowledge_discussion_promotions.published_title
        and coalesce(knowledge.summary, '') = coalesce(library_knowledge_discussion_promotions.published_summary, '')
        and knowledge.knowledge_type = library_knowledge_discussion_promotions.source_knowledge_type
        and knowledge.status = library_knowledge_discussion_promotions.source_knowledge_status
        and knowledge.updated_at = library_knowledge_discussion_promotions.source_updated_at
    )
    and exists (
      select 1
      from public.discussions discussion
      where discussion.id = library_knowledge_discussion_promotions.discussion_id
        and discussion.user_id = auth.uid()
    )
  );

-- Deliberately no browser UPDATE or DELETE policy. A promotion row is durable private
-- provenance for a public discussion. It disappears only if the discussion itself is deleted.

-- Claim snapshots are also private provenance. They record exactly which claim text and
-- role were intentionally included at promotion time, without exposing private evidence.
drop policy if exists "members read own library knowledge discussion claims"
  on public.library_knowledge_discussion_claims;
create policy "members read own library knowledge discussion claims"
  on public.library_knowledge_discussion_claims
  for select to authenticated
  using (
    exists (
      select 1
      from public.library_knowledge_discussion_promotions promotion
      where promotion.id = library_knowledge_discussion_claims.promotion_id
        and promotion.user_id = auth.uid()
    )
  );

drop policy if exists "members create own library knowledge discussion claims"
  on public.library_knowledge_discussion_claims;
create policy "members create own library knowledge discussion claims"
  on public.library_knowledge_discussion_claims
  for insert to authenticated
  with check (
    claim_id is not null
    and exists (
      select 1
      from public.library_knowledge_discussion_promotions promotion
      where promotion.id = library_knowledge_discussion_claims.promotion_id
        and promotion.user_id = auth.uid()
    )
    and exists (
      select 1
      from public.library_research_claims claim
      where claim.id = library_knowledge_discussion_claims.claim_id
        and claim.user_id = auth.uid()
        and claim.statement = library_knowledge_discussion_claims.published_statement
        and claim.claim_type = library_knowledge_discussion_claims.published_claim_type
        and claim.status = library_knowledge_discussion_claims.published_claim_status
    )
    and exists (
      select 1
      from public.library_knowledge_claims membership
      join public.library_knowledge_discussion_promotions promotion
        on promotion.id = library_knowledge_discussion_claims.promotion_id
      where membership.knowledge_object_id = promotion.knowledge_object_id
        and membership.claim_id = library_knowledge_discussion_claims.claim_id
        and membership.role = library_knowledge_discussion_claims.published_role
        and promotion.user_id = auth.uid()
    )
  );

-- No UPDATE or DELETE policy for claim snapshots; they are an immutable record of the
-- member-approved public payload. Deleting the discussion cascades through the promotion.

revoke all on table public.library_knowledge_discussion_promotions from anon;
revoke all on table public.library_knowledge_discussion_claims from anon;
revoke all on table public.library_knowledge_discussion_promotions from authenticated;
revoke all on table public.library_knowledge_discussion_claims from authenticated;

grant select, insert on table public.library_knowledge_discussion_promotions to authenticated;
grant select, insert on table public.library_knowledge_discussion_claims to authenticated;

comment on table public.library_knowledge_discussion_promotions is
  'Private immutable provenance for explicit member-approved promotion of a Library knowledge object into a Loombus discussion.';
comment on table public.library_knowledge_discussion_claims is
  'Private immutable snapshots of member-selected knowledge claims intentionally included in a promoted discussion; no evidence or private notes are exposed.';
comment on column public.library_knowledge_discussion_promotions.knowledge_object_id is
  'Nullable after source deletion so public-discussion promotion provenance can survive deletion of the private knowledge object.';
