-- Read-only production readiness checks for Issues #666, #679, #680, and #683.
-- Run in Supabase SQL Editor after all teen-safety migrations are applied.
-- This is intentionally one SQL statement so Supabase displays every check
-- in a single result table rather than only displaying the final SELECT.
-- Every row with status = FAIL is a release blocker.

with required_tables(name) as (
  values
    ('teen_safety_settings'),
    ('age_correction_requests'),
    ('underage_account_reports'),
    ('room_minor_safety_settings')
),
required_functions(name) as (
  values
    ('compute_loombus_age_band'),
    ('refresh_age_bands_and_preserve_privacy'),
    ('can_start_private_conversation'),
    ('enforce_profile_sensitive_age_state'),
    ('review_age_correction_request'),
    ('enforce_private_conversation_age_eligibility')
),
required_triggers(name) as (
  values
    ('enforce_profile_sensitive_age_state_trigger'),
    ('sync_teen_defaults_after_age_change_trigger'),
    ('enforce_private_conversation_age_eligibility_trigger')
),
checks as (
  select
    10 as sort_order,
    'required_table:' || rt.name as check_name,
    case
      when to_regclass('public.' || rt.name) is not null then 'PASS'
      else 'FAIL'
    end as status,
    null::bigint as violation_count
  from required_tables rt

  union all

  select
    20,
    'required_function:' || rf.name,
    case
      when exists (
        select 1
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname = rf.name
      ) then 'PASS'
      else 'FAIL'
    end,
    null::bigint
  from required_functions rf

  union all

  select
    30,
    'required_trigger:' || trg.name,
    case
      when exists (
        select 1
        from pg_trigger t
        join pg_class c on c.oid = t.tgrelid
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and t.tgname = trg.name
          and not t.tgisinternal
          and t.tgenabled <> 'D'
      ) then 'PASS'
      else 'FAIL'
    end,
    null::bigint
  from required_triggers trg

  union all

  select
    40,
    'teen_room_owners',
    case when count(*) = 0 then 'PASS' else 'FAIL' end,
    count(*)::bigint
  from public.rooms r
  join public.profile_sensitive ps
    on ps.id = coalesce(r.owner_id, r.created_by)
  where ps.age_band = 'teen'

  union all

  select
    50,
    'teen_elevated_room_roles',
    case when count(*) = 0 then 'PASS' else 'FAIL' end,
    count(*)::bigint
  from public.room_members rm
  join public.profile_sensitive ps on ps.id = rm.user_id
  where ps.age_band = 'teen'
    and lower(coalesce(rm.role, 'member')) in (
      'owner',
      'admin',
      'administrator',
      'moderator'
    )
    and lower(coalesce(rm.status, 'active')) not in (
      'blocked',
      'removed',
      'inactive'
    )

  union all

  select
    60,
    'ineligible_active_room_members',
    case when count(*) = 0 then 'PASS' else 'FAIL' end,
    count(*)::bigint
  from public.room_members rm
  join public.profile_sensitive ps on ps.id = rm.user_id
  where ps.age_band in ('unknown', 'under_13')
    and lower(coalesce(rm.status, 'active')) not in (
      'blocked',
      'removed',
      'inactive'
    )

  union all

  select
    70,
    'teen_members_in_rooms_blocking_minors',
    case when count(*) = 0 then 'PASS' else 'FAIL' end,
    count(*)::bigint
  from public.room_members rm
  join public.profile_sensitive ps on ps.id = rm.user_id
  left join public.room_minor_safety_settings rms on rms.room_id = rm.room_id
  where ps.age_band = 'teen'
    and lower(coalesce(rm.status, 'active')) not in (
      'blocked',
      'removed',
      'inactive'
    )
    and coalesce(rms.allows_minors, false) = false

  union all

  select
    80,
    'teen_members_without_approved_application',
    case when count(*) = 0 then 'PASS' else 'FAIL' end,
    count(*)::bigint
  from public.room_members rm
  join public.profile_sensitive ps on ps.id = rm.user_id
  where ps.age_band = 'teen'
    and lower(coalesce(rm.status, 'active')) not in (
      'blocked',
      'removed',
      'inactive'
    )
    and not exists (
      select 1
      from public.room_applications ra
      where ra.room_id = rm.room_id
        and ra.applicant_id = rm.user_id
        and lower(coalesce(ra.state, 'pending')) = 'approved'
    )

  union all

  select
    90,
    'teen_privacy_defaults',
    case when count(*) = 0 then 'PASS' else 'FAIL' end,
    count(*)::bigint
  from public.profile_sensitive ps
  left join public.member_privacy_settings mps on mps.user_id = ps.id
  left join public.teen_safety_settings tss on tss.user_id = ps.id
  where ps.age_band = 'teen'
    and (
      coalesce(mps.private_account, false) = false
      or coalesce(mps.discoverable, true) = true
      or coalesce(tss.future_discussion_audience, '') <> 'followers'
      or coalesce(tss.allow_unsolicited_adult_contact, true) = true
    )

  union all

  select
    100,
    'age_state_mismatch',
    case when count(*) = 0 then 'PASS' else 'FAIL' end,
    count(*)::bigint
  from public.profile_sensitive ps
  where ps.date_of_birth is not null
    and (
      ps.age_band is distinct from
        public.compute_loombus_age_band(ps.date_of_birth)
      or ps.teen_safety_mode is distinct from (
        public.compute_loombus_age_band(ps.date_of_birth)
        in ('under_13', 'teen')
      )
      or ps.guardian_required is distinct from (
        public.compute_loombus_age_band(ps.date_of_birth) = 'under_13'
      )
    )
)
select check_name, status, violation_count
from checks
order by sort_order, check_name;
