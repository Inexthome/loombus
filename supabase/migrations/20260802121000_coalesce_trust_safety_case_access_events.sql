-- Coalesce redundant Trust and Safety case-view events caused by concurrent or repeated
-- detail requests while preserving the first mandatory, immutable access record.

create or replace function public.coalesce_trust_safety_case_access_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.event_type <> 'access'
     or new.action <> 'case_viewed'
     or new.actor_id is null then
    return new;
  end if;

  -- Serialize identical case/actor/action checks so concurrent requests cannot both
  -- pass the duplicate test.
  perform pg_advisory_xact_lock(
    hashtextextended(
      new.case_id::text || ':' || new.actor_id::text || ':' || new.action,
      0
    )
  );

  if exists (
    select 1
    from public.trust_safety_case_events existing
    where existing.case_id = new.case_id
      and existing.actor_id = new.actor_id
      and existing.event_type = 'access'
      and existing.action = 'case_viewed'
      and existing.created_at >= clock_timestamp() - interval '1 minute'
  ) then
    return null;
  end if;

  return new;
end;
$$;

revoke all on function public.coalesce_trust_safety_case_access_event() from public;

drop trigger if exists trust_safety_events_coalesce_access on public.trust_safety_case_events;
create trigger trust_safety_events_coalesce_access
before insert on public.trust_safety_case_events
for each row
execute function public.coalesce_trust_safety_case_access_event();

comment on function public.coalesce_trust_safety_case_access_event() is
  'Preserves the first fail-closed case-view audit event while suppressing identical case/actor access events for one minute.';
