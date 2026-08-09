-- Issue #674: protected-party review controls.
-- Metadata-only review state for privilege, reporter, victim, and unrelated-member
-- minimization. This migration does not authorize export, disclosure, emergency
-- approval, member notice sending, external transmission, or destructive deletion.

begin;

alter table public.legal_requests
  add column if not exists privilege_review_status text not null default 'unreviewed',
  add column if not exists privilege_review_summary text,
  add column if not exists reporter_protection_status text not null default 'unreviewed',
  add column if not exists reporter_protection_summary text,
  add column if not exists victim_protection_status text not null default 'unreviewed',
  add column if not exists victim_protection_summary text,
  add column if not exists unrelated_member_minimization_status text not null default 'unreviewed',
  add column if not exists unrelated_member_minimization_summary text;

comment on column public.legal_requests.privilege_review_status is
'Internal metadata-only privilege review state. Do not store privileged content or responsive material in this field.';
comment on column public.legal_requests.privilege_review_summary is
'Internal minimum-necessary privilege review summary. Do not paste communications, attachments, evidence, or responsive content.';
comment on column public.legal_requests.reporter_protection_status is
'Internal metadata-only reporter protection review state.';
comment on column public.legal_requests.reporter_protection_summary is
'Internal minimum-necessary reporter protection summary. Do not store unnecessary reporter identity data or responsive content.';
comment on column public.legal_requests.victim_protection_status is
'Internal metadata-only victim protection review state.';
comment on column public.legal_requests.victim_protection_summary is
'Internal minimum-necessary victim protection summary. Do not store unnecessary victim identity data or responsive content.';
comment on column public.legal_requests.unrelated_member_minimization_status is
'Internal metadata-only review state for minimizing records about members unrelated to the lawful request scope.';
comment on column public.legal_requests.unrelated_member_minimization_summary is
'Internal minimum-necessary minimization summary. Do not paste unrelated-member content or identifiers unless operationally necessary.';

alter table public.legal_requests
  drop constraint if exists legal_requests_privilege_review_status_check,
  add constraint legal_requests_privilege_review_status_check check (
    privilege_review_status in (
      'unreviewed', 'pending', 'not_identified', 'identified', 'requires_counsel', 'resolved'
    )
  ),
  drop constraint if exists legal_requests_reporter_protection_status_check,
  add constraint legal_requests_reporter_protection_status_check check (
    reporter_protection_status in (
      'unreviewed', 'pending', 'not_identified', 'identified', 'requires_counsel', 'resolved'
    )
  ),
  drop constraint if exists legal_requests_victim_protection_status_check,
  add constraint legal_requests_victim_protection_status_check check (
    victim_protection_status in (
      'unreviewed', 'pending', 'not_identified', 'identified', 'requires_counsel', 'resolved'
    )
  ),
  drop constraint if exists legal_requests_unrelated_member_minimization_status_check,
  add constraint legal_requests_unrelated_member_minimization_status_check check (
    unrelated_member_minimization_status in (
      'unreviewed', 'pending', 'not_applicable', 'required', 'completed', 'requires_counsel'
    )
  ),
  drop constraint if exists legal_requests_privilege_review_summary_length_check,
  add constraint legal_requests_privilege_review_summary_length_check check (
    privilege_review_summary is null or char_length(privilege_review_summary) <= 4000
  ),
  drop constraint if exists legal_requests_reporter_protection_summary_length_check,
  add constraint legal_requests_reporter_protection_summary_length_check check (
    reporter_protection_summary is null or char_length(reporter_protection_summary) <= 4000
  ),
  drop constraint if exists legal_requests_victim_protection_summary_length_check,
  add constraint legal_requests_victim_protection_summary_length_check check (
    victim_protection_summary is null or char_length(victim_protection_summary) <= 4000
  ),
  drop constraint if exists legal_requests_unrelated_member_minimization_summary_length_check,
  add constraint legal_requests_unrelated_member_minimization_summary_length_check check (
    unrelated_member_minimization_summary is null or char_length(unrelated_member_minimization_summary) <= 4000
  );

comment on column public.legal_operations_authorizations.can_review_requests is
'Allows restricted legal-request review metadata changes including identity, authority, scope, deficiency/rejection, cross-border, confidentiality, notice-decision, protected-party/minimization metadata, and transparency classification. Does not authorize counsel approval, export, disclosure, emergency approval, notice sending, or external transmission.';

create or replace function public.legal_enforce_request_review_authorization()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  review_fields_changed boolean;
  review_authorized boolean;
begin
  review_fields_changed :=
    old.status is distinct from new.status
    or old.requester_identity_status is distinct from new.requester_identity_status
    or old.requester_identity_summary is distinct from new.requester_identity_summary
    or old.jurisdiction is distinct from new.jurisdiction
    or old.asserted_authority is distinct from new.asserted_authority
    or old.authority_review_status is distinct from new.authority_review_status
    or old.authority_review_summary is distinct from new.authority_review_summary
    or old.narrowed_scope is distinct from new.narrowed_scope
    or old.scope_review_status is distinct from new.scope_review_status
    or old.counsel_review_status is distinct from new.counsel_review_status
    or old.deficiency_reason is distinct from new.deficiency_reason
    or old.rejection_reason is distinct from new.rejection_reason
    or old.emergency_criteria_summary is distinct from new.emergency_criteria_summary
    or old.cross_border_status is distinct from new.cross_border_status
    or old.conflicting_law_summary is distinct from new.conflicting_law_summary
    or old.confidentiality_notes is distinct from new.confidentiality_notes
    or old.member_notice_decision is distinct from new.member_notice_decision
    or old.delayed_notice_basis is distinct from new.delayed_notice_basis
    or old.privilege_review_status is distinct from new.privilege_review_status
    or old.privilege_review_summary is distinct from new.privilege_review_summary
    or old.reporter_protection_status is distinct from new.reporter_protection_status
    or old.reporter_protection_summary is distinct from new.reporter_protection_summary
    or old.victim_protection_status is distinct from new.victim_protection_status
    or old.victim_protection_summary is distinct from new.victim_protection_summary
    or old.unrelated_member_minimization_status is distinct from new.unrelated_member_minimization_status
    or old.unrelated_member_minimization_summary is distinct from new.unrelated_member_minimization_summary
    or old.transparency_reportable is distinct from new.transparency_reportable
    or old.transparency_jurisdiction_group is distinct from new.transparency_jurisdiction_group
    or old.transparency_outcome is distinct from new.transparency_outcome;

  if not review_fields_changed then
    return new;
  end if;

  if new.updated_by is null then
    raise exception using
      errcode = '42501',
      message = 'Legal request review changes require an identified reviewer.';
  end if;

  select exists (
    select 1
    from public.legal_operations_authorizations loa
    where loa.user_id = new.updated_by
      and loa.active = true
      and loa.revoked_at is null
      and loa.can_review_requests = true
  )
  into review_authorized;

  if not review_authorized then
    raise exception using
      errcode = '42501',
      message = 'Legal Operations capability can_review_requests is required.';
  end if;

  return new;
end;
$$;

revoke all on function public.legal_enforce_request_review_authorization() from public, anon, authenticated;

create or replace function public.log_legal_request_change()
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
    insert into public.legal_request_events (
      request_id, event_type, action, purpose, details, actor_id
    ) values (
      new.id,
      'request_created',
      'legal_request_created',
      'Create restricted legal-request record.',
      jsonb_build_object(
        'request_number', new.request_number,
        'request_type', new.request_type,
        'status', new.status,
        'intake_channel', new.intake_channel
      ),
      new.created_by
    );
    return new;
  end if;

  if new.status is distinct from old.status then
    event_name := 'status_changed';
    action_name := 'legal_request_status_changed';
  else
    event_name := 'request_updated';
    action_name := 'legal_request_updated';
  end if;

  insert into public.legal_request_events (
    request_id, event_type, action, purpose, details, actor_id
  ) values (
    new.id,
    event_name,
    action_name,
    'Record an authorized legal-request state change.',
    jsonb_strip_nulls(jsonb_build_object(
      'previous_status', old.status,
      'status', new.status,
      'previous_identity_status', old.requester_identity_status,
      'identity_status', new.requester_identity_status,
      'previous_authority_review_status', old.authority_review_status,
      'authority_review_status', new.authority_review_status,
      'previous_scope_review_status', old.scope_review_status,
      'scope_review_status', new.scope_review_status,
      'previous_counsel_review_status', old.counsel_review_status,
      'counsel_review_status', new.counsel_review_status,
      'previous_privilege_review_status', old.privilege_review_status,
      'privilege_review_status', new.privilege_review_status,
      'previous_reporter_protection_status', old.reporter_protection_status,
      'reporter_protection_status', new.reporter_protection_status,
      'previous_victim_protection_status', old.victim_protection_status,
      'victim_protection_status', new.victim_protection_status,
      'previous_unrelated_member_minimization_status', old.unrelated_member_minimization_status,
      'unrelated_member_minimization_status', new.unrelated_member_minimization_status,
      'assigned_to', new.assigned_to,
      'closed_at', new.closed_at
    )),
    new.updated_by
  );

  return new;
end;
$$;

commit;
