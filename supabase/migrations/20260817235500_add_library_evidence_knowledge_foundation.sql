-- Loombus Library evidence/knowledge workflow foundation.
--
-- Establishes a member-private reasoning chain without changing immutable Reader provenance:
-- saved passage (library_research_items) -> evidence relation -> claim -> knowledge object.
--
-- This migration intentionally does not publish claims/knowledge, create Discussions,
-- invoke AI, or make library_research_items browser-updatable.

create table if not exists public.library_research_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  statement text not null,
  claim_type text not null default 'claim',
  status text not null default 'draft',
  rationale text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint library_research_claims_statement_check check (
    char_length(btrim(statement)) between 1 and 2000
  ),
  constraint library_research_claims_type_check check (
    claim_type in ('claim', 'question', 'conclusion')
  ),
  constraint library_research_claims_status_check check (
    status in ('draft', 'working', 'supported', 'contested')
  ),
  constraint library_research_claims_rationale_check check (
    rationale is null or char_length(rationale) <= 5000
  )
);

create index if not exists library_research_claims_user_updated_idx
  on public.library_research_claims(user_id, updated_at desc);

create table if not exists public.library_research_claim_evidence (
  claim_id uuid not null references public.library_research_claims(id) on delete cascade,
  research_item_id uuid not null references public.library_research_items(id) on delete cascade,
  relation text not null default 'supports',
  note text,
  created_at timestamptz not null default now(),
  primary key (claim_id, research_item_id),
  constraint library_research_claim_evidence_relation_check check (
    relation in ('supports', 'challenges', 'context')
  ),
  constraint library_research_claim_evidence_note_check check (
    note is null or char_length(note) <= 2000
  )
);

create index if not exists library_research_claim_evidence_item_idx
  on public.library_research_claim_evidence(research_item_id, created_at desc);

create table if not exists public.library_knowledge_objects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  summary text,
  knowledge_type text not null default 'synthesis',
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint library_knowledge_objects_title_check check (
    char_length(btrim(title)) between 1 and 160
  ),
  constraint library_knowledge_objects_summary_check check (
    summary is null or char_length(summary) <= 10000
  ),
  constraint library_knowledge_objects_type_check check (
    knowledge_type in ('synthesis', 'finding', 'open_question')
  ),
  constraint library_knowledge_objects_status_check check (
    status in ('draft', 'working', 'synthesized')
  )
);

create index if not exists library_knowledge_objects_user_updated_idx
  on public.library_knowledge_objects(user_id, updated_at desc);

create table if not exists public.library_knowledge_claims (
  knowledge_object_id uuid not null references public.library_knowledge_objects(id) on delete cascade,
  claim_id uuid not null references public.library_research_claims(id) on delete cascade,
  role text not null default 'core',
  created_at timestamptz not null default now(),
  primary key (knowledge_object_id, claim_id),
  constraint library_knowledge_claims_role_check check (
    role in ('core', 'supporting', 'counterpoint')
  )
);

create index if not exists library_knowledge_claims_claim_idx
  on public.library_knowledge_claims(claim_id, created_at desc);

alter table public.library_research_claims enable row level security;
alter table public.library_research_claim_evidence enable row level security;
alter table public.library_knowledge_objects enable row level security;
alter table public.library_knowledge_claims enable row level security;

-- Claims are fully private to their owner.
drop policy if exists "members read own library research claims" on public.library_research_claims;
create policy "members read own library research claims"
  on public.library_research_claims
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "members create own library research claims" on public.library_research_claims;
create policy "members create own library research claims"
  on public.library_research_claims
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "members update own library research claims" on public.library_research_claims;
create policy "members update own library research claims"
  on public.library_research_claims
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "members delete own library research claims" on public.library_research_claims;
create policy "members delete own library research claims"
  on public.library_research_claims
  for delete to authenticated
  using (auth.uid() = user_id);

-- Evidence relations require ownership of both the claim and immutable saved passage.
drop policy if exists "members read own library claim evidence" on public.library_research_claim_evidence;
create policy "members read own library claim evidence"
  on public.library_research_claim_evidence
  for select to authenticated
  using (
    exists (
      select 1 from public.library_research_claims claim
      where claim.id = library_research_claim_evidence.claim_id
        and claim.user_id = auth.uid()
    )
    and exists (
      select 1 from public.library_research_items item
      where item.id = library_research_claim_evidence.research_item_id
        and item.user_id = auth.uid()
    )
  );

drop policy if exists "members organize own library claim evidence" on public.library_research_claim_evidence;
create policy "members organize own library claim evidence"
  on public.library_research_claim_evidence
  for insert to authenticated
  with check (
    exists (
      select 1 from public.library_research_claims claim
      where claim.id = library_research_claim_evidence.claim_id
        and claim.user_id = auth.uid()
    )
    and exists (
      select 1 from public.library_research_items item
      where item.id = library_research_claim_evidence.research_item_id
        and item.user_id = auth.uid()
    )
  );

drop policy if exists "members update own library claim evidence" on public.library_research_claim_evidence;
create policy "members update own library claim evidence"
  on public.library_research_claim_evidence
  for update to authenticated
  using (
    exists (
      select 1 from public.library_research_claims claim
      where claim.id = library_research_claim_evidence.claim_id
        and claim.user_id = auth.uid()
    )
    and exists (
      select 1 from public.library_research_items item
      where item.id = library_research_claim_evidence.research_item_id
        and item.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.library_research_claims claim
      where claim.id = library_research_claim_evidence.claim_id
        and claim.user_id = auth.uid()
    )
    and exists (
      select 1 from public.library_research_items item
      where item.id = library_research_claim_evidence.research_item_id
        and item.user_id = auth.uid()
    )
  );

drop policy if exists "members remove own library claim evidence" on public.library_research_claim_evidence;
create policy "members remove own library claim evidence"
  on public.library_research_claim_evidence
  for delete to authenticated
  using (
    exists (
      select 1 from public.library_research_claims claim
      where claim.id = library_research_claim_evidence.claim_id
        and claim.user_id = auth.uid()
    )
    and exists (
      select 1 from public.library_research_items item
      where item.id = library_research_claim_evidence.research_item_id
        and item.user_id = auth.uid()
    )
  );

-- Knowledge objects are private working syntheses, not public truth assertions.
drop policy if exists "members read own library knowledge objects" on public.library_knowledge_objects;
create policy "members read own library knowledge objects"
  on public.library_knowledge_objects
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "members create own library knowledge objects" on public.library_knowledge_objects;
create policy "members create own library knowledge objects"
  on public.library_knowledge_objects
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "members update own library knowledge objects" on public.library_knowledge_objects;
create policy "members update own library knowledge objects"
  on public.library_knowledge_objects
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "members delete own library knowledge objects" on public.library_knowledge_objects;
create policy "members delete own library knowledge objects"
  on public.library_knowledge_objects
  for delete to authenticated
  using (auth.uid() = user_id);

-- A knowledge object may reference only claims owned by the same authenticated member.
drop policy if exists "members read own library knowledge claims" on public.library_knowledge_claims;
create policy "members read own library knowledge claims"
  on public.library_knowledge_claims
  for select to authenticated
  using (
    exists (
      select 1 from public.library_knowledge_objects knowledge
      where knowledge.id = library_knowledge_claims.knowledge_object_id
        and knowledge.user_id = auth.uid()
    )
    and exists (
      select 1 from public.library_research_claims claim
      where claim.id = library_knowledge_claims.claim_id
        and claim.user_id = auth.uid()
    )
  );

drop policy if exists "members organize own library knowledge claims" on public.library_knowledge_claims;
create policy "members organize own library knowledge claims"
  on public.library_knowledge_claims
  for insert to authenticated
  with check (
    exists (
      select 1 from public.library_knowledge_objects knowledge
      where knowledge.id = library_knowledge_claims.knowledge_object_id
        and knowledge.user_id = auth.uid()
    )
    and exists (
      select 1 from public.library_research_claims claim
      where claim.id = library_knowledge_claims.claim_id
        and claim.user_id = auth.uid()
    )
  );

drop policy if exists "members update own library knowledge claims" on public.library_knowledge_claims;
create policy "members update own library knowledge claims"
  on public.library_knowledge_claims
  for update to authenticated
  using (
    exists (
      select 1 from public.library_knowledge_objects knowledge
      where knowledge.id = library_knowledge_claims.knowledge_object_id
        and knowledge.user_id = auth.uid()
    )
    and exists (
      select 1 from public.library_research_claims claim
      where claim.id = library_knowledge_claims.claim_id
        and claim.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.library_knowledge_objects knowledge
      where knowledge.id = library_knowledge_claims.knowledge_object_id
        and knowledge.user_id = auth.uid()
    )
    and exists (
      select 1 from public.library_research_claims claim
      where claim.id = library_knowledge_claims.claim_id
        and claim.user_id = auth.uid()
    )
  );

drop policy if exists "members remove own library knowledge claims" on public.library_knowledge_claims;
create policy "members remove own library knowledge claims"
  on public.library_knowledge_claims
  for delete to authenticated
  using (
    exists (
      select 1 from public.library_knowledge_objects knowledge
      where knowledge.id = library_knowledge_claims.knowledge_object_id
        and knowledge.user_id = auth.uid()
    )
    and exists (
      select 1 from public.library_research_claims claim
      where claim.id = library_knowledge_claims.claim_id
        and claim.user_id = auth.uid()
    )
  );

revoke all on table public.library_research_claims from anon;
revoke all on table public.library_research_claim_evidence from anon;
revoke all on table public.library_knowledge_objects from anon;
revoke all on table public.library_knowledge_claims from anon;

revoke all on table public.library_research_claims from authenticated;
revoke all on table public.library_research_claim_evidence from authenticated;
revoke all on table public.library_knowledge_objects from authenticated;
revoke all on table public.library_knowledge_claims from authenticated;

grant select, insert, update, delete on table public.library_research_claims to authenticated;
grant select, insert, update, delete on table public.library_research_claim_evidence to authenticated;
grant select, insert, update, delete on table public.library_knowledge_objects to authenticated;
grant select, insert, update, delete on table public.library_knowledge_claims to authenticated;

comment on table public.library_research_claims is
  'Member-private claims/questions/conclusions developed from Library Research evidence.';
comment on table public.library_research_claim_evidence is
  'Member-private supports/challenges/context relations from immutable saved Library passages to claims.';
comment on table public.library_knowledge_objects is
  'Member-private working syntheses/findings/open questions assembled from structured Library Research claims; not public truth assertions.';
comment on table public.library_knowledge_claims is
  'Member-private core/supporting/counterpoint claim membership for Library knowledge objects.';
