-- Issue #674: make preservation-target insertion auditable in the append-only legal-request history.
-- This migration records metadata-only audit events. It does not activate holds, export data,
-- transmit disclosures, contact outside parties, or change member-visible content/access.

begin;

-- The foundation event-type constraint predates preservation-target audit events.
-- Extend it before the trigger/backfill emits target_added rows.
alter table public.legal_request_events
  drop constraint if exists legal_request_events_type_check;

alter table public.legal_request_events
  add constraint legal_request_events_type_check check (
    event_type in (
      'request_created', 'request_updated', 'status_changed', 'access',
      'identity_review', 'authority_review', 'scope_review', 'scope_narrowed',
      'deficiency', 'rejection', 'specialist_routing', 'counsel_review',
      'emergency_review', 'hold_created', 'hold_updated', 'hold_released',
      'target_added',
      'disclosure_created', 'disclosure_updated', 'disclosure_approved',
      'disclosure_transmitted', 'member_notice_decision', 'handling', 'note'
    )
  );

create or replace function public.log_legal_preservation_target_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_id uuid;
begin
  select hold_row.request_id
    into v_request_id
  from public.legal_preservation_holds hold_row
  where hold_row.id = new.hold_id;

  if v_request_id is null then
    raise exception 'Unable to resolve legal request for preservation target %', new.id;
  end if;

  insert into public.legal_request_events (
    request_id,
    hold_id,
    event_type,
    action,
    purpose,
    details,
    actor_id
  )
  values (
    v_request_id,
    new.hold_id,
    'target_added',
    'preservation_target_added',
    'Record append-only preservation target.',
    jsonb_build_object(
      'target_id', new.id,
      'target_type', new.target_type,
      'source_system', new.source_system
    ),
    new.created_by
  );

  return new;
end;
$$;

revoke all on function public.log_legal_preservation_target_insert() from public, anon, authenticated;
grant execute on function public.log_legal_preservation_target_insert() to service_role;

drop trigger if exists legal_hold_targets_log_insert on public.legal_preservation_hold_targets;
create trigger legal_hold_targets_log_insert
after insert on public.legal_preservation_hold_targets
for each row execute function public.log_legal_preservation_target_insert();

-- Backfill metadata-only audit events for targets created before the insert trigger existed.
-- The event creation time remains the migration time; the original target timestamp is kept in details.
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
  target_row.hold_id,
  'target_added',
  'preservation_target_added',
  'Backfill append-only preservation target audit event.',
  jsonb_build_object(
    'target_id', target_row.id,
    'target_type', target_row.target_type,
    'source_system', target_row.source_system,
    'backfilled', true,
    'target_created_at', target_row.created_at
  ),
  target_row.created_by
from public.legal_preservation_hold_targets target_row
join public.legal_preservation_holds hold_row
  on hold_row.id = target_row.hold_id
where not exists (
  select 1
  from public.legal_request_events event_row
  where event_row.hold_id = target_row.hold_id
    and event_row.action = 'preservation_target_added'
    and event_row.details ->> 'target_id' = target_row.id::text
);

commit;
