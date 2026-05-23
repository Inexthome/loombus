-- Loombus Revoke Anonymous Public Write Grants
-- Goal:
-- - Remove unnecessary anon INSERT/UPDATE/DELETE grants from core app tables.
-- - Keep discussion_views INSERT for anonymous/public view tracking.
-- - Do not change authenticated grants yet; current authenticated API routes rely on user-scoped RLS.

revoke insert, update, delete on table public.action_rate_events from anon;
revoke insert, update, delete on table public.bookmark_collections from anon;
revoke insert, update, delete on table public.bookmarks from anon;
revoke insert, update, delete on table public.discussion_drafts from anon;
revoke update, delete on table public.discussion_views from anon;
revoke insert, update, delete on table public.discussions from anon;
revoke insert, update, delete on table public.follows from anon;
revoke insert, update, delete on table public.labs_feature_requests from anon;
revoke insert, update, delete on table public.notification_preferences from anon;
revoke insert, update, delete on table public.profiles from anon;
revoke insert, update, delete on table public.replies from anon;
revoke insert, update, delete on table public.reports from anon;
revoke insert, update, delete on table public.user_ai_entitlements from anon;
revoke insert, update, delete on table public.user_blocks from anon;

-- Preserve anonymous view tracking only.
grant insert on table public.discussion_views to anon;

-- Verification: anon should only retain INSERT on discussion_views among write privileges.
select
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee = 'anon'
  and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
order by table_name, privilege_type;

-- Verification: authenticated write grants remain unchanged for app/API RLS flows.
select
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee = 'authenticated'
  and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
order by table_name, privilege_type;
