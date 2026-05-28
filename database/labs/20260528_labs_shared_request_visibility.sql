-- Loombus Labs shared request visibility for voting
-- Allows Premium Plus/Admin Labs members to view shared Labs feature requests
-- so they can vote on requests, while preserving RLS protection.
--
-- Supabase Data API policy:
-- This migration explicitly grants/revokes table access.
-- Anonymous users receive no table privileges.
-- Authenticated access remains controlled by RLS policies.

alter table public.labs_feature_requests enable row level security;

drop policy if exists "Users can read their own Labs requests"
on public.labs_feature_requests;

drop policy if exists "Labs members can read visible Labs requests"
on public.labs_feature_requests;

create policy "Labs members can read visible Labs requests"
on public.labs_feature_requests
for select
to authenticated
using (
  auth.uid() = user_id
  or public.user_has_loombus_labs_access(auth.uid())
  or public.user_is_loombus_admin(auth.uid())
);

-- Explicit Supabase Data API grants/revokes.
revoke all on table public.labs_feature_requests from anon;

-- Keep authenticated table privileges available for existing RLS-backed app/API flows.
grant select, insert, update, delete on table public.labs_feature_requests to authenticated;

comment on policy "Labs members can read visible Labs requests"
on public.labs_feature_requests is
'Allows Labs members to view shared feature requests for voting while preserving RLS.';

-- Verification helper:
-- select grantee, privilege_type
-- from information_schema.role_table_grants
-- where table_schema = 'public'
--   and table_name = 'labs_feature_requests'
--   and grantee in ('anon', 'authenticated')
-- order by grantee, privilege_type;
--
-- select policyname, cmd
-- from pg_policies
-- where schemaname = 'public'
--   and tablename = 'labs_feature_requests'
-- order by policyname;
