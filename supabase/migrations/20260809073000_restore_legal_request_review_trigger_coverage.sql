-- Issue #674: restore authoritative legal-request review trigger coverage.
-- PR #861 extended the trigger for transparency-review state but inadvertently
-- omitted protected-party review fields added by PR #857. This migration restores
-- the complete review-field set without changing capabilities or enabling any
-- export, disclosure, emergency approval, notice sending, or external transmission.

begin;

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
    or old.transparency_outcome is distinct from new.transparency_outcome
    or old.transparency_review_status is distinct from new.transparency_review_status;

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

commit;
