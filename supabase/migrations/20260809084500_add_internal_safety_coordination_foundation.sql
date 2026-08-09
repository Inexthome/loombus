-- Issue #674: internal Legal Operations <-> Trust and Safety coordination foundation.
-- Metadata-only internal handoff records. This migration does not define an
-- emergency-disclosure standard, approve a disclosure, contact an outside party,
-- create an external report, transmit data, or alter Trust and Safety case state.

begin;

alter table public.legal_operations_authorizations
  add column if not exists can_coordinate_safety boolean not null default false;

comment on column public.legal_operations_authorizations.can_coordinate_safety is
'Dedicated authority to create and update internal Legal Operations coordination metadata referencing restricted Trust and Safety cases. Requires can_review_requests at the database boundary. Imminent-danger coordination additionally requires can_review_emergency. Does not authorize external reporting, emergency approval, disclosure, export, external contact, or transmission.';

create table if not exists public.legal_safety_coordination (
  id uuid primary key default gen_random_uuid(),
  trust_safety_case_id uuid not null references public.trust_safety_cases(id) on delete restrict,
  legal_request_id uuid references public.legal_requests(id) on delete restrict,
  coordination_type text not null,
  status text not null default 'draft',
  handoff_reason_summary text not null,
  minimum_necessary_reason text not null,
  assigned_legal_reviewer uuid references auth.users(id) on delete restrict,
  revision bigint not null default 0,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint legal_safety_coordination_case_unique unique (trust_safety_case_id),
  constraint legal_safety_coordination_type_check check (
    coordination_type in ('child_safety', 'imminent_danger', 'high_risk_safety')
  ),
  constraint legal_safety_coordination_status_check check (
    status in ('draft', 'legal_review_requested', 'legal_review_acknowledged', 'requires_counsel')
  ),
  constraint legal_safety_coordination_handoff_reason_length_check check (
    char_length(handoff_reason_summary) between 5 and 4000
  ),
  constraint legal_safety_coordination_minimum_reason_length_check check (
    char_length(minimum_necessary_reason) between 5 and 4000
  ),
  constraint legal_safety_coordination_revision_check check (revision >= 0)
);

comment on table public.legal_safety_coordination is
'Internal-only Legal Operations coordination metadata referencing restricted Trust and Safety cases. No row in this table authorizes external reporting, emergency disclosure, export, disclosure, contact, transmission, or a substantive legal conclusion.';
comment on column public.legal_safety_coordination.coordination_type is
'Administrative internal-routing label only. It is not a substantive emergency, child-safety, reporting, or disclosure legal standard.';
comment on column public.legal_safety_coordination.status is
'Draft-only internal coordination state. No approved, authorized, reported, contacted, disclosed, transmitted, or final state exists.';
comment on column public.legal_safety_coordination.handoff_reason_summary is
'Minimum internal summary of why Legal Operations coordination is requested. Do not copy unnecessary member content or raw evidence.';
comment on column public.legal_safety_coordination.minimum_necessary_reason is
'Why the referenced Trust and Safety case metadata is necessary for this restricted Legal Operations coordination record.';

create index if not exists legal_safety_coordination_status_idx
  on public.legal_safety_coordination (status, updated_at desc);
create index if not exists legal_safety_coordination_request_idx
  on public.legal_safety_coordination (legal_request_id, updated_at desc)
  where legal_request_id is not null;

create or replace function public.set_legal_safety_coordination_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.legal_enforce_safety_coordination_authorization()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid;
  coordination_authorized boolean;
  emergency_authorized boolean;
begin
  actor_id := case when tg_op = 'INSERT' then new.created_by else new.updated_by end;

  if actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'Safety coordination changes require an identified Legal Operations reviewer.';
  end if;

  if tg_op = 'INSERT' then
    if new.revision <> 0 then
      raise exception using
        errcode = '42501',
        message = 'New safety coordination records must begin at revision zero.';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.revision <> old.revision + 1 then
      raise exception using
        errcode = '42501',
        message = 'Safety coordination changes require the dedicated revision-controlled workflow.';
    end if;

    if new.trust_safety_case_id is distinct from old.trust_safety_case_id then
      raise exception using
        errcode = '42501',
        message = 'A safety coordination record cannot be moved to a different Trust and Safety case.';
    end if;
  end if;

  select exists (
    select 1
    from public.legal_operations_authorizations loa
    where loa.user_id = actor_id
      and loa.active = true
      and loa.revoked_at is null
      and loa.can_review_requests = true
      and loa.can_coordinate_safety = true
  ) into coordination_authorized;

  if not coordination_authorized then
    raise exception using
      errcode = '42501',
      message = 'Legal Operations capabilities can_review_requests and can_coordinate_safety are required.';
  end if;

  if new.coordination_type = 'imminent_danger' then
    select exists (
      select 1
      from public.legal_operations_authorizations loa
      where loa.user_id = actor_id
        and loa.active = true
        and loa.revoked_at is null
        and loa.can_review_emergency = true
    ) into emergency_authorized;

    if not emergency_authorized then
      raise exception using
        errcode = '42501',
        message = 'Imminent-danger coordination additionally requires can_review_emergency.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.set_legal_safety_coordination_updated_at() from public, anon, authenticated;
revoke all on function public.legal_enforce_safety_coordination_authorization() from public, anon, authenticated;

drop trigger if exists legal_safety_coordination_set_updated_at on public.legal_safety_coordination;
create trigger legal_safety_coordination_set_updated_at
before update on public.legal_safety_coordination
for each row execute function public.set_legal_safety_coordination_updated_at();

drop trigger if exists legal_safety_coordination_enforce_authorization on public.legal_safety_coordination;
create trigger legal_safety_coordination_enforce_authorization
before insert or update on public.legal_safety_coordination
for each row execute function public.legal_enforce_safety_coordination_authorization();

alter table public.legal_safety_coordination enable row level security;

revoke all on table public.legal_safety_coordination from public, anon, authenticated;
revoke all on table public.legal_safety_coordination from service_role;
grant select, insert, update on table public.legal_safety_coordination to service_role;

notify pgrst, 'reload schema';

commit;
