begin;

alter table public.floor_research_publications
  add column if not exists public_byline text not null default 'Loombus Research Desk',
  add column if not exists public_approval_label text not null default 'Loombus';

alter table public.floor_research_publications
  alter column author_id drop not null;

create table if not exists public.floor_research_publication_provenance (
  publication_id uuid primary key references public.floor_research_publications(id) on delete cascade,
  generation_method text not null default 'human' check (generation_method in ('human', 'ai_assisted', 'ai_generated')),
  model_provider text,
  model_name text,
  prompt_version text,
  generated_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  approved_by uuid references public.profiles(id) on delete restrict,
  approved_at timestamptz,
  internal_review_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.floor_research_publication_provenance (
  publication_id,
  generation_method,
  created_by,
  approved_by,
  approved_at
)
select
  publication.id,
  case when publication.ai_assisted then 'ai_assisted' else 'human' end,
  coalesce(publication.author_id, publication.reviewer_id),
  publication.reviewer_id,
  case when publication.status = 'published' then publication.published_at else null end
from public.floor_research_publications publication
on conflict (publication_id) do nothing;

alter table public.floor_research_publications drop column if exists ai_assisted;

alter table public.floor_research_publication_provenance enable row level security;

create policy "Admins read Research Desk provenance"
on public.floor_research_publication_provenance for select to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "Admins manage Research Desk provenance"
on public.floor_research_publication_provenance for all to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

revoke all on table public.floor_research_publication_provenance from public, anon;
grant select, insert, update, delete on table public.floor_research_publication_provenance to authenticated;
grant all on table public.floor_research_publication_provenance to service_role;

drop trigger if exists touch_floor_research_publication_provenance_updated_at
  on public.floor_research_publication_provenance;
create trigger touch_floor_research_publication_provenance_updated_at
before update on public.floor_research_publication_provenance
for each row execute function public.touch_floor_program_updated_at();

comment on table public.floor_research_publications is
  'Member-visible Research Desk publications attributed to the Loombus Research Desk and approved by Loombus.';
comment on table public.floor_research_publication_provenance is
  'Administrator-only generation and approval provenance. Never exposed in the member Research Desk interface.';

notify pgrst, 'reload schema';
commit;
