create table if not exists public.loombus_v2_create_shadow_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_draft_id uuid null references public.loombus_v2_create_drafts(id) on delete set null,
  title text not null,
  topic text not null,
  body text not null,
  mode text not null check (mode in ('open_discussion', 'debate', 'research_question', 'problem_solving')),
  tags text[] not null default '{}',
  status text not null default 'shadow_recorded' check (status in ('shadow_recorded')),
  source text not null default 'v2_create_readiness',
  created_at timestamptz not null default now()
);

create index if not exists loombus_v2_create_shadow_records_user_id_idx
  on public.loombus_v2_create_shadow_records (user_id, created_at desc);

alter table public.loombus_v2_create_shadow_records enable row level security;

comment on table public.loombus_v2_create_shadow_records is
  'Internal non-public V2 Create shadow records. These records do not create live discussions.';
