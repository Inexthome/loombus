-- Issue #674: emergency review decision-control foundation.
-- Draft-only internal assessment metadata. This migration does not define an
-- emergency-disclosure legal standard, approve an emergency disclosure, collect
-- source data, contact an outside party, or transmit anything externally.

begin;

alter table public.legal_operations_authorizations
  add column if not exists can_review_emergency boolean not null default false;

comment on column public.legal_operations_authorizations.can_review_emergency is
'Dedicated authority to review and update draft emergency-request assessment metadata. Requires can_review_requests at the database boundary. Does not authorize emergency approval, disclosure, export, external contact, transmission, or public emergency criteria.';

alter table public.legal_requests
  add column if not exists emergency_review_status text not null default 'unreviewed',
  add column if not exists emergency_review_revision bigint not null default 0;

comment on column public.legal_requests.emergency_review_status is
'Internal draft-only review state for emergency-request assessment metadata. Allowed states in this foundation are unreviewed, draft, and requires_counsel. No approved or final state exists.';
comment on column public.legal_requests.emergency_review_revision is
'Monotonic revision marker required for changes to canonical emergency_criteria_summary through the dedicated emergency-review workflow.';
comment on column public.legal_requests.emergency_criteria_summary is
'Canonical internal draft emergency-request assessment summary. This field does not establish approved legal criteria and does not authorize emergency approval, disclosure, contact, or transmission.';

alter table public.legal_requests
  drop constraint if exists legal_requests_emergency_review_status_check,
  add constraint legal_requests_emergency_review_status_check check (
    emergency_review_status in ('unreviewed', 'draft', 'requires_counsel')
  ),
  drop constraint if exists legal_requests_emergency_review_revision_check,
  add constraint legal_requests_emergency_review_revision_check check (
    emergency_review_revision >= 0
  );

create or replace function public.legal_enforce_emergency_review_authorization()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  emergency_fields_changed boolean;
  emergency_authorized boolean;
begin
  emergency_fields_changed :=
    old.emergency_criteria_summary is distinct from new.emergency_criteria_summary
    or old.emergency_review_status is distinct from new.emergency_review_status
    or old.emergency_review_revision is distinct from new.emergency_review_revision;

  if not emergency_fields_changed then
    return new;
  end if;

  if new.updated_by is null then
    raise exception using
      errcode = '42501',
      message = 'Emergency review changes require an identified reviewer.';
  end if;

  if new.emergency_review_revision <> old.emergency_review_revision + 1 then
    raise exception using
      errcode = '42501',
      message = 'Emergency review changes require the dedicated revision-controlled workflow.';
  end if;

  if new.emergency_review_status = 'unreviewed'
     and new.emergency_criteria_summary is not null then
    raise exception using
      errcode = '23514',
      message = 'Unreviewed emergency state cannot contain draft assessment metadata.';
  end if;

  select exists (
    select 1
    from public.legal_operations_authorizations loa
    where loa.user_id = new.updated_by
      and loa.active = true
      and loa.revoked_at is null
      and loa.can_review_requests = true
      and loa.can_review_emergency = true
  )
  into emergency_authorized;

  if not emergency_authorized then
    raise exception using
      errcode = '42501',
      message = 'Legal Operations capabilities can_review_requests and can_review_emergency are required.';
  end if;

  return new;
end;
$$;

revoke all on function public.legal_enforce_emergency_review_authorization() from public, anon, authenticated;

-- Keep this as a separate trigger from the shared legal-request review trigger.
-- That avoids replacing the shared function and preserves the protected-party,
-- transparency, and notice/confidentiality coverage already repaired and verified.
drop trigger if exists legal_requests_enforce_emergency_review_authorization on public.legal_requests;
create trigger legal_requests_enforce_emergency_review_authorization
before update on public.legal_requests
for each row
execute function public.legal_enforce_emergency_review_authorization();

commit;
