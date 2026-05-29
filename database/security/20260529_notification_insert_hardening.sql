-- Loombus Notification Insert Hardening
-- Date: 2026-05-29
--
-- Purpose:
-- Remove normal authenticated client INSERT access on notifications.
-- Notification creation is handled through server-side service-role helpers.
--
-- Expected remaining policies:
-- - Users can read their own notifications
-- - Users can update their own notifications
-- - Users can delete their own notifications

drop policy if exists "Authenticated users can create notifications"
on public.notifications;

-- Verification
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
