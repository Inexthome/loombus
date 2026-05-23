-- Loombus Revoke Unused Authenticated Write Grants
-- Goal:
-- - Remove authenticated write grants that are not used by current app/API workflows.
-- - Keep authenticated INSERT/UPDATE/DELETE where RLS-backed app/API flows still need them.
-- - This is intentionally conservative.

-- action_rate_events: API routes insert events; no user update/delete workflow.
revoke update, delete on table public.action_rate_events from authenticated;

-- discussion_views: public/authenticated users may insert view events; no update/delete workflow.
revoke update, delete on table public.discussion_views from authenticated;

-- follows: users create/delete follows; no update workflow.
revoke update on table public.follows from authenticated;

-- user_blocks: users create/delete blocks; no update workflow.
revoke update on table public.user_blocks from authenticated;

-- notification_preferences: users insert/update preferences; no delete workflow.
revoke delete on table public.notification_preferences from authenticated;

-- profiles: users insert/update/bootstrap profiles; no delete workflow.
revoke delete on table public.profiles from authenticated;

-- discussions: users create discussions, admins/server routes update moderation/edit state; no direct delete workflow.
revoke delete on table public.discussions from authenticated;

-- replies: users create replies, server routes soft-delete/update replies; no direct delete workflow.
revoke delete on table public.replies from authenticated;

-- reports: users create reports, admins update review state; no delete workflow.
revoke delete on table public.reports from authenticated;

-- Verification: authenticated write grants after cleanup.
select
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee = 'authenticated'
  and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
order by table_name, privilege_type;

-- Verification: high-danger grants should remain absent.
select
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
  and privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER')
order by table_name, grantee, privilege_type;
