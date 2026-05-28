-- Loombus Labs feature request voting
-- Adds upvote-only voting for Premium Plus/Admin Labs members.
--
-- Supabase Data API policy:
-- This migration explicitly grants/revokes table access.
-- Anonymous users receive no table privileges.
-- Authenticated users may read Labs vote rows through RLS.
-- Authenticated Premium Plus/Admin users may create/delete only their own votes.
-- API/UI code still validates access before mutating votes.

create table if not exists public.labs_feature_request_votes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.labs_feature_requests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint labs_feature_request_votes_unique_user_request
    unique (request_id, user_id)
);

create index if not exists labs_feature_request_votes_request_idx
on public.labs_feature_request_votes(request_id, created_at desc);

create index if not exists labs_feature_request_votes_user_idx
on public.labs_feature_request_votes(user_id, created_at desc);

alter table public.labs_feature_request_votes enable row level security;

drop policy if exists "Labs members can read feature request votes"
on public.labs_feature_request_votes;

create policy "Labs members can read feature request votes"
on public.labs_feature_request_votes
for select
to authenticated
using (public.user_has_loombus_labs_access(auth.uid()));

drop policy if exists "Labs members can create their own feature request votes"
on public.labs_feature_request_votes;

create policy "Labs members can create their own feature request votes"
on public.labs_feature_request_votes
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.user_has_loombus_labs_access(auth.uid())
);

drop policy if exists "Labs members can delete their own feature request votes"
on public.labs_feature_request_votes;

create policy "Labs members can delete their own feature request votes"
on public.labs_feature_request_votes
for delete
to authenticated
using (
  user_id = auth.uid()
  and public.user_has_loombus_labs_access(auth.uid())
);

drop policy if exists "Admins can manage Labs feature request votes"
on public.labs_feature_request_votes;

create policy "Admins can manage Labs feature request votes"
on public.labs_feature_request_votes
for all
to authenticated
using (public.user_is_loombus_admin(auth.uid()))
with check (public.user_is_loombus_admin(auth.uid()));

-- Explicit Supabase Data API grants/revokes.
revoke all on table public.labs_feature_request_votes from anon;

revoke update on table public.labs_feature_request_votes from authenticated;
grant select, insert, delete on table public.labs_feature_request_votes to authenticated;

comment on table public.labs_feature_request_votes is
'Upvote-only votes on Loombus Labs feature requests by Premium Plus/Admin members.';

comment on column public.labs_feature_request_votes.request_id is
'Labs feature request receiving the vote.';

comment on column public.labs_feature_request_votes.user_id is
'Premium Plus/Admin member who cast the vote.';

-- Verification helper:
-- select column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'labs_feature_request_votes'
-- order by ordinal_position;
--
-- select grantee, privilege_type
-- from information_schema.role_table_grants
-- where table_schema = 'public'
--   and table_name = 'labs_feature_request_votes'
--   and grantee in ('anon', 'authenticated')
-- order by grantee, privilege_type;
--
-- select policyname, cmd
-- from pg_policies
-- where schemaname = 'public'
--   and tablename = 'labs_feature_request_votes'
-- order by policyname;
