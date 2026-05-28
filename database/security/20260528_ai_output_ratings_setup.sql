-- Loombus AI output ratings
-- Adds helpful / not helpful ratings for AI-assisted discussion outputs.
--
-- Supabase Data API policy:
-- This file explicitly grants/revokes table access.
-- Anonymous users receive no table privileges.
-- Authenticated users can read/write only through RLS-owned rows.
-- Admin aggregate visibility can be added through admin API/UI later.

create table if not exists public.ai_output_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  discussion_id uuid not null references public.discussions(id) on delete cascade,
  feature_key text not null,
  rating text not null,
  source_content_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_output_ratings_feature_key_check
    check (
      feature_key in (
        'thread_summary',
        'key_takeaways',
        'what_changed',
        'disagreement_map'
      )
    ),
  constraint ai_output_ratings_rating_check
    check (rating in ('helpful', 'not_helpful'))
);

create unique index if not exists ai_output_ratings_user_discussion_feature_idx
on public.ai_output_ratings(user_id, discussion_id, feature_key);

create index if not exists ai_output_ratings_discussion_feature_idx
on public.ai_output_ratings(discussion_id, feature_key);

create index if not exists ai_output_ratings_feature_rating_idx
on public.ai_output_ratings(feature_key, rating);

create index if not exists ai_output_ratings_created_at_idx
on public.ai_output_ratings(created_at);

alter table public.ai_output_ratings enable row level security;

drop policy if exists "Users can read their own AI output ratings"
on public.ai_output_ratings;

create policy "Users can read their own AI output ratings"
on public.ai_output_ratings
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Admins can read AI output ratings"
on public.ai_output_ratings;

create policy "Admins can read AI output ratings"
on public.ai_output_ratings
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
);

drop policy if exists "Users can create their own AI output ratings"
on public.ai_output_ratings;

create policy "Users can create their own AI output ratings"
on public.ai_output_ratings
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can update their own AI output ratings"
on public.ai_output_ratings;

create policy "Users can update their own AI output ratings"
on public.ai_output_ratings
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can delete their own AI output ratings"
on public.ai_output_ratings;

create policy "Users can delete their own AI output ratings"
on public.ai_output_ratings
for delete
to authenticated
using (user_id = auth.uid());

-- Explicit Supabase Data API grants/revokes.
revoke all on table public.ai_output_ratings from anon;
grant select, insert, update, delete on table public.ai_output_ratings to authenticated;

comment on table public.ai_output_ratings is
'Helpful / not helpful ratings submitted by members for Loombus AI-assisted discussion outputs.';

comment on column public.ai_output_ratings.feature_key is
'AI feature being rated: thread_summary, key_takeaways, what_changed, or disagreement_map.';

comment on column public.ai_output_ratings.rating is
'User rating for the AI output: helpful or not_helpful.';

comment on column public.ai_output_ratings.source_content_hash is
'Optional content hash for the AI output source at the time of rating.';

-- Verification helper:
-- select column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'ai_output_ratings'
-- order by ordinal_position;
--
-- select grantee, privilege_type
-- from information_schema.role_table_grants
-- where table_schema = 'public'
--   and table_name = 'ai_output_ratings'
--   and grantee in ('anon', 'authenticated')
-- order by grantee, privilege_type;
--
-- select policyname, cmd
-- from pg_policies
-- where schemaname = 'public'
--   and tablename = 'ai_output_ratings'
-- order by policyname;
