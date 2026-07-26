-- Canonical bookmark_collections RLS reconciliation.
--
-- This migration is intentionally idempotent and transactional. It restores the
-- repository source of truth after the earlier RLS migration disappeared from
-- main, removes stale permissive policies, and preserves the intended behavior:
--   - authenticated users may read only their own folders
--   - Premium or Admin users may create, update, and delete only their own folders
--   - anonymous users have no table privileges
--
-- Confirmed live preflight before this migration:
--   - RLS was enabled
--   - five permissive policies existed
--   - bookmark_collections_insert_own allowed every authenticated owner to insert,
--     bypassing the intended Premium/Admin insert policy through OR-combination
--   - anon retained SELECT and MAINTAIN table privileges
--
-- Apply with the Supabase SQL Editor or the project's database migration runner.

begin;

do $$
begin
  if to_regclass('public.bookmark_collections') is null then
    raise exception 'Required table public.bookmark_collections does not exist.';
  end if;

  if to_regclass('public.user_ai_entitlements') is null then
    raise exception 'Required table public.user_ai_entitlements does not exist.';
  end if;

  if to_regclass('public.profiles') is null then
    raise exception 'Required table public.profiles does not exist.';
  end if;
end
$$;

alter table public.bookmark_collections enable row level security;

create or replace function public.user_has_bookmark_collection_access(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    target_user_id = (select auth.uid())
    and (
      exists (
        select 1
        from public.user_ai_entitlements as entitlement
        where entitlement.user_id = target_user_id
          and entitlement.ai_assisted_enabled is true
          and entitlement.tier in ('premium', 'admin')
      )
      or exists (
        select 1
        from public.profiles as profile
        where profile.id = target_user_id
          and profile.is_admin is true
      )
    );
$$;

revoke all on function public.user_has_bookmark_collection_access(uuid) from public;
grant execute on function public.user_has_bookmark_collection_access(uuid) to authenticated;
grant execute on function public.user_has_bookmark_collection_access(uuid) to service_role;

revoke all on table public.bookmark_collections from anon;
revoke all on table public.bookmark_collections from authenticated;
grant select, insert, update, delete on table public.bookmark_collections to authenticated;

-- Replace every existing policy so a historical permissive policy cannot remain
-- OR-combined with the intended Premium/Admin write policies.
do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'bookmark_collections'
  loop
    execute format(
      'drop policy %I on public.bookmark_collections',
      existing_policy.policyname
    );
  end loop;
end
$$;

create policy "Users can read their bookmark collections"
on public.bookmark_collections
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Premium users can create their bookmark collections"
on public.bookmark_collections
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and public.user_has_bookmark_collection_access(user_id)
);

create policy "Premium users can update their bookmark collections"
on public.bookmark_collections
for update
to authenticated
using (
  (select auth.uid()) = user_id
  and public.user_has_bookmark_collection_access(user_id)
)
with check (
  (select auth.uid()) = user_id
  and public.user_has_bookmark_collection_access(user_id)
);

create policy "Premium users can delete their bookmark collections"
on public.bookmark_collections
for delete
to authenticated
using (
  (select auth.uid()) = user_id
  and public.user_has_bookmark_collection_access(user_id)
);

-- Fail the transaction instead of leaving a partially reconciled policy set.
do $$
declare
  rls_enabled boolean;
  policy_count integer;
  authenticated_privileges text[];
  helper_security_definer boolean;
  helper_volatility "char";
  anon_can_execute boolean;
  authenticated_can_execute boolean;
  service_role_can_execute boolean;
begin
  select relation.relrowsecurity
  into rls_enabled
  from pg_catalog.pg_class as relation
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relname = 'bookmark_collections';

  if rls_enabled is distinct from true then
    raise exception 'RLS verification failed for public.bookmark_collections.';
  end if;

  select count(*)
  into policy_count
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and tablename = 'bookmark_collections';

  if policy_count <> 4 then
    raise exception 'Expected 4 bookmark_collections policies, found %.', policy_count;
  end if;

  if exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'bookmark_collections'
      and roles <> array['authenticated']::name[]
  ) then
    raise exception 'A bookmark_collections policy is not scoped exclusively to authenticated.';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'bookmark_collections'
      and grantee = 'anon'
  ) then
    raise exception 'Anonymous privileges still exist on public.bookmark_collections.';
  end if;

  select array_agg(privilege_type::text order by privilege_type::text)
  into authenticated_privileges
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name = 'bookmark_collections'
    and grantee = 'authenticated';

  if authenticated_privileges is distinct from array['DELETE', 'INSERT', 'SELECT', 'UPDATE']::text[] then
    raise exception 'Unexpected authenticated privileges on public.bookmark_collections: %.', authenticated_privileges;
  end if;

  select
    procedure.prosecdef,
    procedure.provolatile,
    has_function_privilege('anon', procedure.oid, 'EXECUTE'),
    has_function_privilege('authenticated', procedure.oid, 'EXECUTE'),
    has_function_privilege('service_role', procedure.oid, 'EXECUTE')
  into
    helper_security_definer,
    helper_volatility,
    anon_can_execute,
    authenticated_can_execute,
    service_role_can_execute
  from pg_catalog.pg_proc as procedure
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname = 'user_has_bookmark_collection_access'
    and pg_catalog.pg_get_function_identity_arguments(procedure.oid) = 'target_user_id uuid';

  if helper_security_definer is distinct from true then
    raise exception 'Bookmark collection access helper is not SECURITY DEFINER.';
  end if;

  if helper_volatility is distinct from 's' then
    raise exception 'Bookmark collection access helper is not STABLE.';
  end if;

  if anon_can_execute is distinct from false
     or authenticated_can_execute is distinct from true
     or service_role_can_execute is distinct from true then
    raise exception 'Unexpected helper-function execution privileges.';
  end if;
end
$$;

commit;
