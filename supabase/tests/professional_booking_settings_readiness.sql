-- Read-only readiness checks for Phase 3B.1 Professional Booking settings.
-- Expected result: every boolean column is true after the migration is applied.

select
  to_regclass('public.professional_booking_settings') is not null
    as professional_booking_settings_present,

  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'professional_booking_settings'
      and column_name = 'provider_id'
      and is_nullable = 'NO'
  ) as provider_id_present_not_null,

  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'professional_booking_settings'
      and column_name = 'weekly_availability'
      and data_type = 'jsonb'
      and is_nullable = 'NO'
  ) as weekly_availability_jsonb_present,

  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'professional_booking_settings'
      and column_name = 'minimum_notice_minutes'
      and is_nullable = 'NO'
  ) as minimum_notice_present_not_null,

  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'professional_booking_settings'
      and column_name = 'maximum_advance_days'
      and is_nullable = 'NO'
  ) as maximum_advance_present_not_null,

  coalesce(
    (
      select relrowsecurity
      from pg_class
      where oid = to_regclass('public.professional_booking_settings')
    ),
    false
  ) as professional_booking_rls_enabled,

  coalesce(
    (
      select relforcerowsecurity
      from pg_class
      where oid = to_regclass('public.professional_booking_settings')
    ),
    false
  ) as professional_booking_force_rls_enabled,

  not coalesce(
    has_table_privilege(
      'anon',
      'public.professional_booking_settings',
      'SELECT'
    ),
    false
  ) as anon_select_revoked,

  not coalesce(
    has_table_privilege(
      'anon',
      'public.professional_booking_settings',
      'INSERT'
    ),
    false
  ) as anon_insert_revoked,

  not coalesce(
    has_table_privilege(
      'anon',
      'public.professional_booking_settings',
      'UPDATE'
    ),
    false
  ) as anon_update_revoked,

  not coalesce(
    has_table_privilege(
      'anon',
      'public.professional_booking_settings',
      'DELETE'
    ),
    false
  ) as anon_delete_revoked,

  not coalesce(
    has_table_privilege(
      'authenticated',
      'public.professional_booking_settings',
      'SELECT'
    ),
    false
  ) as authenticated_select_revoked,

  not coalesce(
    has_table_privilege(
      'authenticated',
      'public.professional_booking_settings',
      'INSERT'
    ),
    false
  ) as authenticated_insert_revoked,

  not coalesce(
    has_table_privilege(
      'authenticated',
      'public.professional_booking_settings',
      'UPDATE'
    ),
    false
  ) as authenticated_update_revoked,

  not coalesce(
    has_table_privilege(
      'authenticated',
      'public.professional_booking_settings',
      'DELETE'
    ),
    false
  ) as authenticated_delete_revoked,

  coalesce(
    has_table_privilege(
      'service_role',
      'public.professional_booking_settings',
      'SELECT'
    ),
    false
  ) as service_role_select_granted,

  coalesce(
    has_table_privilege(
      'service_role',
      'public.professional_booking_settings',
      'INSERT'
    ),
    false
  ) as service_role_insert_granted,

  coalesce(
    has_table_privilege(
      'service_role',
      'public.professional_booking_settings',
      'UPDATE'
    ),
    false
  ) as service_role_update_granted,

  coalesce(
    has_table_privilege(
      'service_role',
      'public.professional_booking_settings',
      'DELETE'
    ),
    false
  ) as service_role_delete_granted,

  (
    select count(*) = 0
    from pg_policies
    where schemaname = 'public'
      and tablename = 'professional_booking_settings'
  ) as no_direct_member_rls_policies,

  exists (
    select 1
    from pg_constraint
    where conrelid = to_regclass('public.professional_booking_settings')
      and contype = 'p'
  ) as provider_primary_key_present,

  exists (
    select 1
    from pg_constraint
    where conrelid = to_regclass('public.professional_booking_settings')
      and contype = 'f'
  ) as provider_profile_foreign_key_present;
