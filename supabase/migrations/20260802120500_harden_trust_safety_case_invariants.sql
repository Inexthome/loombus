-- Issue #667 hardening: preserve original closure metadata and require
-- evidence-linked events to reference evidence from the same case.

begin;

create or replace function public.normalize_trust_safety_case_closure()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status <> 'closed' and new.status = 'closed' then
    new.closed_at := coalesce(new.closed_at, now());
    new.closed_by := coalesce(new.closed_by, new.updated_by);
  elsif old.status = 'closed' and new.status = 'closed' then
    new.closed_at := old.closed_at;
    new.closed_by := old.closed_by;
  elsif old.status = 'closed' and new.status <> 'closed' then
    new.closed_at := null;
    new.closed_by := null;
  else
    new.closed_at := null;
    new.closed_by := null;
  end if;

  return new;
end;
$$;

create or replace function public.validate_trust_safety_case_event_evidence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.evidence_ref_id is not null and not exists (
    select 1
    from public.trust_safety_case_evidence_refs evidence
    where evidence.id = new.evidence_ref_id
      and evidence.case_id = new.case_id
  ) then
    raise exception 'Evidence reference must belong to the same Trust and Safety case.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.normalize_trust_safety_case_closure() from public;
revoke all on function public.validate_trust_safety_case_event_evidence() from public;

drop trigger if exists trust_safety_cases_normalize_closure on public.trust_safety_cases;
create trigger trust_safety_cases_normalize_closure
before update on public.trust_safety_cases
for each row execute function public.normalize_trust_safety_case_closure();

drop trigger if exists trust_safety_events_validate_evidence on public.trust_safety_case_events;
create trigger trust_safety_events_validate_evidence
before insert on public.trust_safety_case_events
for each row execute function public.validate_trust_safety_case_event_evidence();

notify pgrst, 'reload schema';

commit;
