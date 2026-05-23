-- Loombus Audit Logs Service-Role Hardening
-- Goal:
-- - Keep admin read access through RLS.
-- - Prevent anon users from accessing audit logs directly.
-- - Prevent normal authenticated clients from inserting/updating/deleting audit logs directly.
-- - Preserve authenticated SELECT grant so the existing admin-read RLS policy can function.

alter table public.audit_logs enable row level security;

drop policy if exists "Admins can read audit logs"
on public.audit_logs;

create policy "Admins can read audit logs"
on public.audit_logs
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

revoke all on table public.audit_logs from anon;

revoke insert, update, delete
on table public.audit_logs
from authenticated;

grant select
on table public.audit_logs
to authenticated;

-- Verification: RLS should be enabled.
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'audit_logs';

-- Verification: only admin read policy should remain.
select
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'audit_logs'
order by policyname;

-- Verification: anon should have no privileges; authenticated should only have SELECT.
select
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'audit_logs'
  and grantee in ('anon', 'authenticated')
order by grantee, privilege_type;
