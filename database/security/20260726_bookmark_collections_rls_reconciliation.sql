-- Canonical bookmark_collections RLS reconciliation.
--
-- This migration is intentionally idempotent and transactional. It restores the
-- repository source of truth after the earlier RLS migration disappeared from
-- main, removes any stale permissive policies, and preserves the intended
-- behavior:
--   - authenticated users may read only their own folders
--   - Premium or Admin users may create, update, and delete only their own folders
--   - anonymous users have no table privileges
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
begin
  select table_row_security.is_enabled
  into rls_enabled
  from (
    select relation.relrowsecurity as is_enabled
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'bookmark_collections'
  ) as table_row_security;

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
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'bookmark_collections'
      and grantee = 'anon'
  ) then
    raise exception 'Anonymous privileges still exist on public.bookmark_collections.';
  end if;
end
$$;

commit;
