-- Read-only readiness checks for the Phase 2C calendar-feed credential foundation.
-- Expected result: every boolean column is true after the migration is applied.

select
  to_regclass('public.calendar_feed_credentials') is not null as calendar_feed_credentials_present,
  coalesce(
    (select relrowsecurity from pg_class where oid = 'public.calendar_feed_credentials'::regclass),
    false
  ) as calendar_feed_credentials_rls,
  coalesce(
    (select relforcerowsecurity from pg_class where oid = 'public.calendar_feed_credentials'::regclass),
    false
  ) as calendar_feed_credentials_force_rls,
  not has_table_privilege('anon', 'public.calendar_feed_credentials', 'SELECT') as anon_select_revoked,
  not has_table_privilege('anon', 'public.calendar_feed_credentials', 'INSERT') as anon_insert_revoked,
  not has_table_privilege('anon', 'public.calendar_feed_credentials', 'UPDATE') as anon_update_revoked,
  not has_table_privilege('anon', 'public.calendar_feed_credentials', 'DELETE') as anon_delete_revoked,
  not has_table_privilege('authenticated', 'public.calendar_feed_credentials', 'SELECT') as authenticated_select_revoked,
  not has_table_privilege('authenticated', 'public.calendar_feed_credentials', 'INSERT') as authenticated_insert_revoked,
  not has_table_privilege('authenticated', 'public.calendar_feed_credentials', 'UPDATE') as authenticated_update_revoked,
  not has_table_privilege('authenticated', 'public.calendar_feed_credentials', 'DELETE') as authenticated_delete_revoked,
  has_table_privilege('service_role', 'public.calendar_feed_credentials', 'SELECT') as service_role_select_granted,
  has_table_privilege('service_role', 'public.calendar_feed_credentials', 'INSERT') as service_role_insert_granted,
  has_table_privilege('service_role', 'public.calendar_feed_credentials', 'UPDATE') as service_role_update_granted,
  has_table_privilege('service_role', 'public.calendar_feed_credentials', 'DELETE') as service_role_delete_granted,
  not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'calendar_feed_credentials'
  ) as no_client_rls_policies,
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'calendar_feed_credentials'
      and column_name in ('token', 'feed_token', 'secret', 'raw_token')
  ) as raw_token_column_absent;
