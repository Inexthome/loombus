-- Read-only verification for Trust and Safety case access-event coalescing.
-- Run after applying 20260802121000_coalesce_trust_safety_case_access_events.sql.
-- Every returned row must have status = PASS.

with checks as (
  select
    'coalescing_function_present'::text as check_name,
    case when to_regprocedure('public.coalesce_trust_safety_case_access_event()') is not null then 1 else 0 end::bigint as observed,
    1::bigint as expected

  union all

  select
    'coalescing_trigger_present',
    count(*)::bigint,
    1::bigint
  from pg_trigger trigger_row
  join pg_class class_row on class_row.oid = trigger_row.tgrelid
  join pg_namespace namespace_row on namespace_row.oid = class_row.relnamespace
  where namespace_row.nspname = 'public'
    and class_row.relname = 'trust_safety_case_events'
    and trigger_row.tgname = 'trust_safety_events_coalesce_access'
    and not trigger_row.tgisinternal

  union all

  select
    'coalescing_trigger_enabled',
    count(*)::bigint,
    1::bigint
  from pg_trigger trigger_row
  join pg_class class_row on class_row.oid = trigger_row.tgrelid
  join pg_namespace namespace_row on namespace_row.oid = class_row.relnamespace
  where namespace_row.nspname = 'public'
    and class_row.relname = 'trust_safety_case_events'
    and trigger_row.tgname = 'trust_safety_events_coalesce_access'
    and trigger_row.tgenabled <> 'D'
    and not trigger_row.tgisinternal
)
select
  check_name,
  observed,
  expected,
  case when observed = expected then 'PASS' else 'FAIL' end as status
from checks
order by check_name;
