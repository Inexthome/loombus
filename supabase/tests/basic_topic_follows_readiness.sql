-- Read-only readiness checks for Free Basic Topic Alerts.
-- Expected result: every boolean column is true after the migration is applied.

select
  to_regclass('public.user_topic_follows') is not null
    as basic_topic_follows_present,
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_topic_follows'
      and column_name = 'enabled'
      and is_nullable = 'NO'
  ) as enabled_column_present_not_null,
  coalesce(
    (select relrowsecurity
     from pg_class
     where oid = 'public.user_topic_follows'::regclass),
    false
  ) as basic_topic_follows_rls,
  coalesce(
    (select relforcerowsecurity
     from pg_class
     where oid = 'public.user_topic_follows'::regclass),
    false
  ) as basic_topic_follows_force_rls,
  not has_table_privilege(
    'anon',
    'public.user_topic_follows',
    'SELECT'
  ) as anon_select_revoked,
  not has_table_privilege(
    'anon',
    'public.user_topic_follows',
    'INSERT'
  ) as anon_insert_revoked,
  not has_table_privilege(
    'anon',
    'public.user_topic_follows',
    'UPDATE'
  ) as anon_update_revoked,
  not has_table_privilege(
    'anon',
    'public.user_topic_follows',
    'DELETE'
  ) as anon_delete_revoked,
  has_table_privilege(
    'authenticated',
    'public.user_topic_follows',
    'SELECT'
  ) as authenticated_select_granted,
  has_table_privilege(
    'authenticated',
    'public.user_topic_follows',
    'INSERT'
  ) as authenticated_insert_granted,
  has_table_privilege(
    'authenticated',
    'public.user_topic_follows',
    'UPDATE'
  ) as authenticated_update_granted,
  has_table_privilege(
    'authenticated',
    'public.user_topic_follows',
    'DELETE'
  ) as authenticated_delete_granted,
  (
    select count(*) = 4
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_topic_follows'
      and cmd in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
  ) as four_self_rls_policies_present,
  coalesce(
    (
      select prosecdef
      from pg_proc
      where oid = 'public.notify_basic_topic_followers()'::regprocedure
    ),
    false
  ) as basic_delivery_function_security_definer,
  coalesce(
    (
      select prosecdef
      from pg_proc
      where oid =
        'public.prefer_advanced_topic_alert_notification()'::regprocedure
    ),
    false
  ) as advanced_preference_function_security_definer,
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.discussions'::regclass
      and tgname = 'notify_basic_topic_followers_after_discussion_insert'
      and not tgisinternal
  ) as basic_delivery_trigger_present,
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.notifications'::regclass
      and tgname = 'prefer_advanced_topic_alert_after_notification_insert'
      and not tgisinternal
  ) as advanced_preference_trigger_present,
  to_regclass('public.user_topic_alerts') is not null
    as advanced_topic_alert_store_preserved,
  not has_function_privilege(
    'anon',
    'public.notify_basic_topic_followers()',
    'EXECUTE'
  ) as anon_basic_delivery_execute_revoked,
  not has_function_privilege(
    'authenticated',
    'public.notify_basic_topic_followers()',
    'EXECUTE'
  ) as authenticated_basic_delivery_execute_revoked;
