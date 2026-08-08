-- Issue #674: make preservation-hold activation and expiry explicit in append-only legal-request history.
-- This migration changes audit semantics only. It does not activate, release, expire, export,
-- disclose, contact outside parties, or change member-visible content/access.

begin;

alter table public.legal_request_events
  drop constraint if exists legal_request_events_type_check;

alter table public.legal_request_events
  add constraint legal_request_events_type_check check (
    event_type in (
      'request_created', 'request_updated', 'status_changed', 'access',
      'identity_review', 'authority_review', 'scope_review', 'scope_narrowed',
      'deficiency', 'rejection', 'specialist_routing', 'counsel_review',
      'emergency_review', 'hold_created', 'hold_updated', 'hold_activated',
      'hold_released', 'hold_expired', 'target_added', 'disclosure_created',
      'disclosure_updated', 'disclosure_approved', 'disclosure_transmitted',
      'member_notice_decision', 'handling', 'note'
    )
  );

create or replace function public.log_legal_hold_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  event_name text;
  action_name text;
begin
  if tg_op = 'INSERT' then
    event_name := 'hold_created';
    action_name := 'preservation_hold_created';
  elsif new.status = 'active' and old.status is distinct from 'active' then
    event_name := 'hold_activated';
    action_name := 'preservation_hold_activated';
  elsif new.status = 'released' and old.status is distinct from 'released' then
    event_name := 'hold_released';
    action_name := 'preservation_hold_released';
  elsif new.status = 'expired' and old.status is distinct from 'expired' then
    event_name := 'hold_expired';
    action_name := 'preservation_hold_expired';
  else
    event_name := 'hold_updated';
    action_name := 'preservation_hold_updated';
  end if;

  insert into public.legal_request_events (
    request_id, hold_id, event_type, action, purpose, details, actor_id
  ) values (
    new.request_id,
    new.id,
    event_name,
    action_name,
    'Record preservation-hold lifecycle state.',
    jsonb_strip_nulls(jsonb_build_object(
      'previous_status', case when tg_op = 'UPDATE' then old.status else null end,
      'status', new.status,
      'starts_at', new.starts_at,
      'expires_at', new.expires_at,
      'next_review_at', new.next_review_at,
      'released_at', new.released_at
    )),
    coalesce(new.updated_by, new.approved_by, new.created_by)
  );

  return new;
end;
$$;

revoke all on function public.log_legal_hold_change() from public, anon, authenticated;
grant execute on function public.log_legal_hold_change() to service_role;

-- Backfill an explicit activation event for holds that started before lifecycle-specific
-- activation auditing existed. Existing append-only events are not mutated.
insert into public.legal_request_events (
  request_id,
  hold_id,
  event_type,
  action,
  purpose,
  details,
  actor_id
)
select
  hold_row.request_id,
  hold_row.id,
  'hold_activated',
  'preservation_hold_activated',
  'Backfill explicit preservation-hold activation audit event.',
  jsonb_strip_nulls(jsonb_build_object(
    'status', hold_row.status,
    'starts_at', hold_row.starts_at,
    'expires_at', hold_row.expires_at,
    'next_review_at', hold_row.next_review_at,
    'backfilled', true
  )),
  coalesce(hold_row.approved_by, hold_row.updated_by, hold_row.created_by)
from public.legal_preservation_holds hold_row
where hold_row.starts_at is not null
  and not exists (
    select 1
    from public.legal_request_events event_row
    where event_row.hold_id = hold_row.id
      and event_row.action = 'preservation_hold_activated'
  );

-- Backfill explicit expiry events only for holds already marked expired.
insert into public.legal_request_events (
  request_id,
  hold_id,
  event_type,
  action,
  purpose,
  details,
  actor_id
)
select
  hold_row.request_id,
  hold_row.id,
  'hold_expired',
  'preservation_hold_expired',
  'Backfill explicit preservation-hold expiry audit event.',
  jsonb_strip_nulls(jsonb_build_object(
    'status', hold_row.status,
    'starts_at', hold_row.starts_at,
    'expires_at', hold_row.expires_at,
    'next_review_at', hold_row.next_review_at,
    'backfilled', true
  )),
  coalesce(hold_row.updated_by, hold_row.approved_by, hold_row.created_by)
from public.legal_preservation_holds hold_row
where hold_row.status = 'expired'
  and not exists (
    select 1
    from public.legal_request_events event_row
    where event_row.hold_id = hold_row.id
      and event_row.action = 'preservation_hold_expired'
  );

commit;
