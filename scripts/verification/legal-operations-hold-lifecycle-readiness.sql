-- Read-only Issue #674 checks for explicit preservation-hold lifecycle auditing.
-- Run after 20260808101000_audit_legal_preservation_hold_lifecycle.sql.
-- Every returned row must have status = PASS.

with checks as (
  select
    'hold_lifecycle_event_types_allowed'::text as check_name,
    count(*)::bigint as observed,
    1::bigint as expected
  from pg_constraint constraint_row
  join pg_class class_row on class_row.oid = constraint_row.conrelid
  join pg_namespace namespace_row on namespace_row.oid = class_row.relnamespace
  where namespace_row.nspname = 'public'
    and class_row.relname = 'legal_request_events'
    and constraint_row.conname = 'legal_request_events_type_check'
    and pg_get_constraintdef(constraint_row.oid) like '%hold_activated%'
    and pg_get_constraintdef(constraint_row.oid) like '%hold_expired%'
    and pg_get_constraintdef(constraint_row.oid) like '%target_added%'

  union all

  select
    'hold_change_function_present',
    case when to_regprocedure('public.log_legal_hold_change()') is not null then 1 else 0 end::bigint,
    1::bigint

  union all

  select
    'hold_change_trigger_enabled',
    count(*)::bigint,
    1::bigint
  from pg_trigger trigger_row
  where trigger_row.tgname = 'legal_preservation_holds_log_change'
    and trigger_row.tgenabled <> 'D'
    and not trigger_row.tgisinternal

  union all

  select
    'started_holds_have_activation_audit_events',
    count(*)::bigint,
    0::bigint
  from public.legal_preservation_holds hold_row
  where hold_row.starts_at is not null
    and not exists (
      select 1
      from public.legal_request_events event_row
      where event_row.hold_id = hold_row.id
        and event_row.action = 'preservation_hold_activated'
    )

  union all

  select
    'expired_holds_have_expiry_audit_events',
    count(*)::bigint,
    0::bigint
  from public.legal_preservation_holds hold_row
  where hold_row.status = 'expired'
    and not exists (
      select 1
      from public.legal_request_events event_row
      where event_row.hold_id = hold_row.id
        and event_row.action = 'preservation_hold_expired'
    )
)
select
  check_name,
  observed,
  expected,
  case when observed = expected then 'PASS' else 'FAIL' end as status
from checks
order by check_name;
