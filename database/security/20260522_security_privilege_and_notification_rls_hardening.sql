-- Loombus Security Hardening
-- Date: 2026-05-22
--
-- Purpose:
-- 1. Remove dangerous non-row-level table privileges from anon/authenticated.
-- 2. Remove broad notification preference read access.
-- 3. Allow users to delete only their own notifications.
--
-- Safe to run more than once.

revoke truncate, references, trigger
on all tables in schema public
from anon, authenticated;

alter default privileges for role postgres in schema public
revoke truncate, references, trigger
on tables
from anon, authenticated;

drop policy if exists "Authenticated users can read notification delivery preferences"
on public.notification_preferences;

drop policy if exists "Users can delete their own notifications"
on public.notifications;

create policy "Users can delete their own notifications"
on public.notifications
for delete
to authenticated
using (auth.uid() = user_id);

-- Verification: should return no rows.
select
  table_schema,
  table_name,
  privilege_type,
  grantee
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
  and privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER')
order by table_name, grantee, privilege_type;

-- Verification: notification preferences should be owner-scoped only.
select
  policyname,
  roles,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
from pg_policies
where schemaname = 'public'
  and tablename = 'notification_preferences'
order by policyname;

-- Verification: notifications should support owner read/update/delete.
select
  policyname,
  roles,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
from pg_policies
where schemaname = 'public'
  and tablename = 'notifications'
order by policyname;
