-- Loombus discussion summary cache
-- Run this in Supabase SQL Editor before deploying AI-assisted summary UI/API code.

create table if not exists public.discussion_summaries (
  id uuid primary key default gen_random_uuid(),
  discussion_id uuid not null references public.discussions(id) on delete cascade,
  summary text not null,
  model_name text,
  source_reply_count integer not null default 0,
  source_content_hash text,
  generated_by uuid references public.profiles(id) on delete set null,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists discussion_summaries_discussion_id_idx
on public.discussion_summaries(discussion_id);

create index if not exists discussion_summaries_generated_at_idx
on public.discussion_summaries(generated_at);

alter table public.discussion_summaries enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'discussion_summaries'
      and policyname = 'Anyone can read discussion summaries'
  ) then
    create policy "Anyone can read discussion summaries"
    on public.discussion_summaries
    for select
    using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'discussion_summaries'
      and policyname = 'Authenticated users can create discussion summaries'
  ) then
    create policy "Authenticated users can create discussion summaries"
    on public.discussion_summaries
    for insert
    with check (auth.uid() = generated_by);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'discussion_summaries'
      and policyname = 'Authenticated users can update discussion summaries'
  ) then
    create policy "Authenticated users can update discussion summaries"
    on public.discussion_summaries
    for update
    using (auth.uid() = generated_by)
    with check (auth.uid() = generated_by);
  end if;
end $$;

comment on table public.discussion_summaries is
'Cached AI-assisted discussion summaries. Summaries are generated server-side and reused.';

comment on column public.discussion_summaries.source_content_hash is
'Hash of the discussion/reply source text used to determine whether a cached summary is stale.';
