-- Issue #674: member notice and confidentiality decision-control foundation.
-- Draft-only internal review controls. This migration does not authorize or send
-- member notices, lift confidentiality restrictions, disclose data, approve
-- emergency disclosures, or transmit anything externally.

begin;

alter table public.legal_operations_authorizations
  add column if not exists can_review_notice_confidentiality boolean not null default false;

comment on column public.legal_operations_authorizations.can_review_notice_confidentiality is
'Dedicated authority to review and update draft member-notice/confidentiality decision metadata. Requires can_review_requests at the database boundary. Does not authorize final legal approval, notice sending, disclosure, emergency approval, or external transmission.';

alter table public.legal_requests
  add column if not exists notice_confidentiality_review_status text not null default 'unreviewed',
  add column if not exists notice_confidentiality_revision bigint not null default 0;

comment on column public.legal_requests.notice_confidentiality_review_status is
'Internal draft-only review state for member-notice/confidentiality decision metadata. Allowed states in this foundation are unreviewed, draft, and requires_counsel. No approved/final state exists.';
comment on column public.legal_requests.notice_confidentiality_revision is
'Monotonic revision marker required for changes to canonical confidentiality_notes, member_notice_decision, or delayed_notice_basis through the dedicated notice/confidentiality workflow.';
comment on column public.legal_requests.confidentiality_notes is
'Canonical internal confidentiality review notes. In Issue #674 notice/confidentiality foundation, edits are draft-only and require the dedicated capability plus revision increment. Do not store unnecessary request/member content.';
comment on column public.legal_requests.member_notice_decision is
'Canonical internal draft member-notice recommendation text. This field does not represent final legal approval and does not authorize or send a notice.';
comment on column public.legal_requests.delayed_notice_basis is
'Canonical internal draft delayed-notice basis summary. This field does not itself authorize delay, lift confidentiality, or send a member notice.';

alter table public.legal_requests
  drop constraint if exists legal_requests_notice_confidentiality_review_status_check,
  add constraint legal_requests_notice_confidentiality_review_status_check check (
    notice_confidentiality_review_status in ('unreviewed', 'draft', 'requires_counsel')
  ),
  drop constraint if exists legal_requests_notice_confidentiality_revision_check,
  add constraint legal_requests_notice_confidentiality_revision_check check (
    notice_confidentiality_revision >= 0
  );

comment on column public.legal_operations_authorizations.can_review_requests is
'Allows restricted legal-request review metadata changes for identity, authority, scope, deficiency/rejection, cross-border, protected-party/minimization, and transparency classification. Member-notice/confidentiality decision metadata additionally requires can_review_notice_confidentiality. Does not authorize counsel approval, export, disclosure, emergency approval, notice sending, or external transmission.';

create or replace function public.legal_enforce_request_review_authorization()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  general_review_fields_changed boolean;
  notice_fields_changed boolean;
  notice_content_changed boolean;
  review_authorized boolean;
  notice_authorized boolean;
begin
  general_review_fields_changed :=
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
    or old.transparency_outcome is distinct from new.transparency_outcome
    or old.transparency_review_status is distinct from new.transparency_review_status;

  notice_content_changed :=
    old.confidentiality_notes is distinct from new.confidentiality_notes
    or old.member_notice_decision is distinct from new.member_notice_decision
    or old.delayed_notice_basis is distinct from new.delayed_notice_basis;

  notice_fields_changed :=
    notice_content_changed
    or old.notice_confidentiality_review_status is distinct from new.notice_confidentiality_review_status
    or old.notice_confidentiality_revision is distinct from new.notice_confidentiality_revision;

  if not general_review_fields_changed and not notice_fields_changed then
    return new;
  end if;

  if new.updated_by is null then
    raise exception using
      errcode = '42501',
      message = 'Legal request review changes require an identified reviewer.';
  end if;

  if general_review_fields_changed then
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
  end if;

  if notice_fields_changed then
    if new.notice_confidentiality_revision <> old.notice_confidentiality_revision + 1 then
      raise exception using
        errcode = '42501',
        message = 'Notice/confidentiality changes require the dedicated revision-controlled workflow.';
    end if;

    if new.notice_confidentiality_review_status = 'unreviewed'
       and (
         new.confidentiality_notes is not null
         or new.member_notice_decision is not null
         or new.delayed_notice_basis is not null
       ) then
      raise exception using
        errcode = '23514',
        message = 'Unreviewed notice/confidentiality state cannot contain draft decision metadata.';
    end if;

    select exists (
      select 1
      from public.legal_operations_authorizations loa
      where loa.user_id = new.updated_by
        and loa.active = true
        and loa.revoked_at is null
        and loa.can_review_requests = true
        and loa.can_review_notice_confidentiality = true
    )
    into notice_authorized;

    if not notice_authorized then
      raise exception using
        errcode = '42501',
        message = 'Legal Operations capabilities can_review_requests and can_review_notice_confidentiality are required.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.legal_enforce_request_review_authorization() from public, anon, authenticated;

commit;
