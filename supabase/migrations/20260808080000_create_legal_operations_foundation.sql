-- Issue #674: restricted legal-request, preservation-hold, and disclosure foundation.
-- Internal metadata and references only. This migration does not disclose data,
-- contact an outside party, publish legal guidelines, or enable destructive deletion.

begin;

create sequence if not exists public.legal_request_number_seq;

create or replace function public.next_legal_request_number()
returns text
language sql
volatile
security definer
set search_path = public
as $$
  select
    'LR-' || to_char(current_date, 'YYYY') || '-' ||
    lpad(nextval('public.legal_request_number_seq')::text, 6, '0');
$$;

revoke all on function public.next_legal_request_number() from public;
grant execute on function public.next_legal_request_number() to service_role;

create table if not exists public.legal_operations_authorizations (
  user_id uuid primary key references auth.users(id) on delete restrict,
  role text not null default 'legal_intake',
  can_intake boolean not null default false,
  can_preserve boolean not null default false,
  can_export boolean not null default false,
  can_disclose boolean not null default false,
  can_approve_emergency boolean not null default false,
  can_manage_access boolean not null default false,
  active boolean not null default true,
  appointed_by uuid references auth.users(id) on delete restrict,
  appointed_at timestamptz not null default now(),
  revoked_at timestamptz,
  notes text,
  constraint legal_operations_authorizations_role_check check (
    role in ('legal_intake', 'legal_reviewer', 'legal_exporter', 'legal_approver', 'legal_admin')
  ),
  constraint legal_operations_authorizations_notes_length_check check (
    notes is null or char_length(notes) <= 4000
  ),
  constraint legal_operations_authorizations_revoked_state_check check (
    (active and revoked_at is null) or ((not active) and revoked_at is not null)
  )
);

create table if not exists public.legal_requests (
  id uuid primary key default gen_random_uuid(),
  request_number text not null default public.next_legal_request_number(),
  request_type text not null,
  status text not null default 'intake',
  intake_channel text not null default 'legal_email',
  received_at timestamptz not null default now(),
  requester_organization text,
  requester_name text,
  requester_contact_ref text,
  requester_identity_status text not null default 'unverified',
  requester_identity_summary text,
  jurisdiction text,
  asserted_authority text,
  authority_review_status text not null default 'unreviewed',
  authority_review_summary text,
  original_scope text not null,
  narrowed_scope text,
  scope_review_status text not null default 'unreviewed',
  counsel_review_status text not null default 'not_requested',
  deficiency_reason text,
  rejection_reason text,
  emergency_criteria_summary text,
  cross_border_status text not null default 'not_identified',
  conflicting_law_summary text,
  confidentiality_notes text,
  member_notice_decision text,
  delayed_notice_basis text,
  transparency_reportable boolean not null default true,
  transparency_jurisdiction_group text,
  transparency_outcome text,
  assigned_to uuid references auth.users(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  closed_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint legal_requests_request_number_unique unique (request_number),
  constraint legal_requests_request_type_check check (
    request_type in (
      'subpoena', 'warrant', 'court_order', 'preservation_request',
      'emergency_disclosure', 'ip_notice', 'regulatory_request',
      'law_enforcement_inquiry', 'civil_request', 'other'
    )
  ),
  constraint legal_requests_status_check check (
    status in (
      'intake', 'identity_verification', 'authority_review', 'scope_review',
      'awaiting_counsel', 'preservation_active', 'ready_for_disclosure',
      'partially_fulfilled', 'fulfilled', 'deficient', 'rejected', 'closed'
    )
  ),
  constraint legal_requests_intake_channel_check check (
    intake_channel in ('legal_email', 'mail', 'service', 'portal', 'internal_referral', 'other')
  ),
  constraint legal_requests_identity_status_check check (
    requester_identity_status in ('unverified', 'pending', 'verified', 'failed', 'not_applicable')
  ),
  constraint legal_requests_authority_status_check check (
    authority_review_status in ('unreviewed', 'pending', 'sufficient', 'insufficient', 'requires_counsel')
  ),
  constraint legal_requests_scope_status_check check (
    scope_review_status in ('unreviewed', 'pending', 'accepted', 'narrowed', 'deficient', 'rejected')
  ),
  constraint legal_requests_counsel_status_check check (
    counsel_review_status in ('not_requested', 'pending', 'approved', 'changes_required', 'declined')
  ),
  constraint legal_requests_cross_border_status_check check (
    cross_border_status in ('not_identified', 'not_applicable', 'identified', 'requires_counsel', 'resolved')
  ),
  constraint legal_requests_original_scope_length_check check (
    char_length(original_scope) between 5 and 20000
  ),
  constraint legal_requests_requester_organization_length_check check (
    requester_organization is null or char_length(requester_organization) <= 500
  ),
  constraint legal_requests_requester_name_length_check check (
    requester_name is null or char_length(requester_name) <= 500
  ),
  constraint legal_requests_requester_contact_length_check check (
    requester_contact_ref is null or char_length(requester_contact_ref) <= 1000
  ),
  constraint legal_requests_identity_summary_length_check check (
    requester_identity_summary is null or char_length(requester_identity_summary) <= 8000
  ),
  constraint legal_requests_jurisdiction_length_check check (
    jurisdiction is null or char_length(jurisdiction) <= 1000
  ),
  constraint legal_requests_authority_length_check check (
    asserted_authority is null or char_length(asserted_authority) <= 12000
  ),
  constraint legal_requests_authority_summary_length_check check (
    authority_review_summary is null or char_length(authority_review_summary) <= 12000
  ),
  constraint legal_requests_narrowed_scope_length_check check (
    narrowed_scope is null or char_length(narrowed_scope) <= 20000
  ),
  constraint legal_requests_deficiency_length_check check (
    deficiency_reason is null or char_length(deficiency_reason) <= 12000
  ),
  constraint legal_requests_rejection_length_check check (
    rejection_reason is null or char_length(rejection_reason) <= 12000
  ),
  constraint legal_requests_emergency_length_check check (
    emergency_criteria_summary is null or char_length(emergency_criteria_summary) <= 12000
  ),
  constraint legal_requests_conflicting_law_length_check check (
    conflicting_law_summary is null or char_length(conflicting_law_summary) <= 12000
  ),
  constraint legal_requests_confidentiality_length_check check (
    confidentiality_notes is null or char_length(confidentiality_notes) <= 12000
  ),
  constraint legal_requests_member_notice_length_check check (
    member_notice_decision is null or char_length(member_notice_decision) <= 8000
  ),
  constraint legal_requests_delayed_notice_length_check check (
    delayed_notice_basis is null or char_length(delayed_notice_basis) <= 8000
  ),
  constraint legal_requests_transparency_jurisdiction_length_check check (
    transparency_jurisdiction_group is null or char_length(transparency_jurisdiction_group) <= 500
  ),
  constraint legal_requests_transparency_outcome_length_check check (
    transparency_outcome is null or char_length(transparency_outcome) <= 500
  ),
  constraint legal_requests_closed_state_check check (
    (status = 'closed' and closed_at is not null)
    or (status <> 'closed' and closed_at is null)
  )
);

create table if not exists public.legal_preservation_holds (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.legal_requests(id) on delete restrict,
  status text not null default 'draft',
  legal_basis_summary text not null,
  scope_summary text not null,
  starts_at timestamptz,
  expires_at timestamptz,
  next_review_at timestamptz,
  extended_at timestamptz,
  released_at timestamptz,
  approved_by uuid references auth.users(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint legal_preservation_holds_status_check check (
    status in ('draft', 'active', 'released', 'expired')
  ),
  constraint legal_preservation_holds_basis_length_check check (
    char_length(legal_basis_summary) between 5 and 12000
  ),
  constraint legal_preservation_holds_scope_length_check check (
    char_length(scope_summary) between 5 and 20000
  ),
  constraint legal_preservation_holds_active_approval_check check (
    status <> 'active' or (approved_by is not null and starts_at is not null)
  ),
  constraint legal_preservation_holds_release_check check (
    status <> 'released' or released_at is not null
  ),
  constraint legal_preservation_holds_expiry_order_check check (
    expires_at is null or starts_at is null or expires_at > starts_at
  )
);

create table if not exists public.legal_preservation_hold_targets (
  id uuid primary key default gen_random_uuid(),
  hold_id uuid not null references public.legal_preservation_holds(id) on delete restrict,
  resource_key text,
  target_type text not null,
  target_ref text,
  subject_user_id uuid references auth.users(id) on delete restrict,
  source_system text,
  minimum_necessary_reason text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint legal_preservation_hold_targets_type_check check (
    target_type in (
      'account', 'profile', 'discussion', 'reply', 'private_message', 'room',
      'storage_object', 'billing_record', 'support_record', 'search_document',
      'ai_record', 'trust_safety_case', 'audit_log', 'notification_delivery',
      'vendor_record', 'other'
    )
  ),
  constraint legal_preservation_hold_targets_resource_key_length_check check (
    resource_key is null or char_length(resource_key) <= 200
  ),
  constraint legal_preservation_hold_targets_ref_length_check check (
    target_ref is null or char_length(target_ref) <= 2000
  ),
  constraint legal_preservation_hold_targets_source_system_length_check check (
    source_system is null or char_length(source_system) <= 500
  ),
  constraint legal_preservation_hold_targets_reason_length_check check (
    char_length(minimum_necessary_reason) between 5 and 4000
  ),
  constraint legal_preservation_hold_targets_locator_check check (
    target_ref is not null or subject_user_id is not null or resource_key is not null
  ),
  constraint legal_preservation_hold_targets_metadata_object_check check (
    jsonb_typeof(metadata) = 'object'
  ),
  constraint legal_preservation_hold_targets_metadata_size_check check (
    octet_length(metadata::text) <= 30000
  )
);

create table if not exists public.legal_disclosures (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.legal_requests(id) on delete restrict,
  disclosure_type text not null default 'ordinary',
  status text not null default 'draft',
  legal_basis_summary text not null,
  scope_summary text not null,
  recipient_organization text not null,
  recipient_contact_ref text,
  member_notice_decision text,
  delayed_notice_basis text,
  manifest_sha256 text,
  approved_by uuid references auth.users(id) on delete restrict,
  approved_at timestamptz,
  transmitted_by uuid references auth.users(id) on delete restrict,
  transmitted_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint legal_disclosures_type_check check (
    disclosure_type in ('ordinary', 'emergency', 'preservation_ack', 'ip_response', 'regulatory', 'other')
  ),
  constraint legal_disclosures_status_check check (
    status in ('draft', 'awaiting_approval', 'approved', 'transmitted', 'cancelled')
  ),
  constraint legal_disclosures_basis_length_check check (
    char_length(legal_basis_summary) between 5 and 12000
  ),
  constraint legal_disclosures_scope_length_check check (
    char_length(scope_summary) between 5 and 20000
  ),
  constraint legal_disclosures_recipient_length_check check (
    char_length(recipient_organization) between 2 and 1000
  ),
  constraint legal_disclosures_recipient_contact_length_check check (
    recipient_contact_ref is null or char_length(recipient_contact_ref) <= 1000
  ),
  constraint legal_disclosures_notice_length_check check (
    member_notice_decision is null or char_length(member_notice_decision) <= 8000
  ),
  constraint legal_disclosures_delayed_notice_length_check check (
    delayed_notice_basis is null or char_length(delayed_notice_basis) <= 8000
  ),
  constraint legal_disclosures_manifest_hash_check check (
    manifest_sha256 is null or manifest_sha256 ~ '^[0-9a-fA-F]{64}$'
  ),
  constraint legal_disclosures_approval_state_check check (
    status not in ('approved', 'transmitted')
    or (approved_by is not null and approved_at is not null)
  ),
  constraint legal_disclosures_transmission_state_check check (
    status <> 'transmitted'
    or (transmitted_by is not null and transmitted_at is not null)
  )
);

create table if not exists public.legal_disclosure_items (
  id uuid primary key default gen_random_uuid(),
  disclosure_id uuid not null references public.legal_disclosures(id) on delete restrict,
  resource_key text,
  source_system text not null,
  record_ref text,
  field_names text[] not null default '{}'::text[],
  object_count integer not null default 0,
  file_name text,
  sha256 text,
  minimum_necessary_justification text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint legal_disclosure_items_resource_key_length_check check (
    resource_key is null or char_length(resource_key) <= 200
  ),
  constraint legal_disclosure_items_source_system_length_check check (
    char_length(source_system) between 2 and 500
  ),
  constraint legal_disclosure_items_record_ref_length_check check (
    record_ref is null or char_length(record_ref) <= 2000
  ),
  constraint legal_disclosure_items_field_count_check check (
    cardinality(field_names) <= 200
  ),
  constraint legal_disclosure_items_object_count_check check (
    object_count >= 0
  ),
  constraint legal_disclosure_items_file_name_length_check check (
    file_name is null or char_length(file_name) <= 1000
  ),
  constraint legal_disclosure_items_hash_check check (
    sha256 is null or sha256 ~ '^[0-9a-fA-F]{64}$'
  ),
  constraint legal_disclosure_items_minimum_length_check check (
    char_length(minimum_necessary_justification) between 5 and 4000
  ),
  constraint legal_disclosure_items_metadata_object_check check (
    jsonb_typeof(metadata) = 'object'
  ),
  constraint legal_disclosure_items_metadata_size_check check (
    octet_length(metadata::text) <= 30000
  )
);

create table if not exists public.legal_request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.legal_requests(id) on delete restrict,
  hold_id uuid references public.legal_preservation_holds(id) on delete restrict,
  disclosure_id uuid references public.legal_disclosures(id) on delete restrict,
  event_type text not null,
  action text not null,
  purpose text,
  details jsonb not null default '{}'::jsonb,
  actor_id uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint legal_request_events_type_check check (
    event_type in (
      'request_created', 'request_updated', 'status_changed', 'access',
      'identity_review', 'authority_review', 'scope_review', 'scope_narrowed',
      'deficiency', 'rejection', 'specialist_routing', 'counsel_review',
      'emergency_review', 'hold_created', 'hold_updated', 'hold_released',
      'disclosure_created', 'disclosure_updated', 'disclosure_approved',
      'disclosure_transmitted', 'member_notice_decision', 'handling', 'note'
    )
  ),
  constraint legal_request_events_action_length_check check (
    char_length(action) between 2 and 200
  ),
  constraint legal_request_events_purpose_length_check check (
    purpose is null or char_length(purpose) <= 4000
  ),
  constraint legal_request_events_details_object_check check (
    jsonb_typeof(details) = 'object'
  ),
  constraint legal_request_events_details_size_check check (
    octet_length(details::text) <= 30000
  )
);

create index if not exists legal_requests_status_received_idx
  on public.legal_requests (status, received_at desc);
create index if not exists legal_requests_type_status_idx
  on public.legal_requests (request_type, status, updated_at desc);
create index if not exists legal_requests_assignment_idx
  on public.legal_requests (assigned_to, status, updated_at desc);
create index if not exists legal_preservation_holds_request_idx
  on public.legal_preservation_holds (request_id, status, updated_at desc);
create index if not exists legal_preservation_holds_active_idx
  on public.legal_preservation_holds (status, expires_at, next_review_at)
  where status = 'active';
create index if not exists legal_preservation_hold_targets_hold_idx
  on public.legal_preservation_hold_targets (hold_id, created_at asc);
create index if not exists legal_preservation_hold_targets_subject_idx
  on public.legal_preservation_hold_targets (subject_user_id, target_type)
  where subject_user_id is not null;
create index if not exists legal_preservation_hold_targets_ref_idx
  on public.legal_preservation_hold_targets (target_type, target_ref)
  where target_ref is not null;
create index if not exists legal_disclosures_request_idx
  on public.legal_disclosures (request_id, status, updated_at desc);
create index if not exists legal_disclosure_items_disclosure_idx
  on public.legal_disclosure_items (disclosure_id, created_at asc);
create index if not exists legal_request_events_request_idx
  on public.legal_request_events (request_id, created_at asc);

create or replace function public.set_legal_operations_updated_at()
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

create or replace function public.normalize_legal_request_closure()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'closed' and old.status is distinct from 'closed' then
    new.closed_at := coalesce(new.closed_at, now());
    new.closed_by := coalesce(new.closed_by, new.updated_by);
  elsif new.status <> 'closed' and old.status = 'closed' then
    new.closed_at := null;
    new.closed_by := null;
  elsif new.status = 'closed' and old.status = 'closed' then
    new.closed_at := old.closed_at;
    new.closed_by := old.closed_by;
  end if;
  return new;
end;
$$;

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
      'assigned_to', new.assigned_to,
      'closed_at', new.closed_at
    )),
    new.updated_by
  );

  return new;
end;
$$;

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
  elsif new.status = 'released' and old.status is distinct from 'released' then
    event_name := 'hold_released';
    action_name := 'preservation_hold_released';
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
      'status', new.status,
      'starts_at', new.starts_at,
      'expires_at', new.expires_at,
      'next_review_at', new.next_review_at,
      'released_at', new.released_at
    )),
    coalesce(new.updated_by, new.created_by)
  );

  return new;
end;
$$;

create or replace function public.log_legal_disclosure_change()
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
    event_name := 'disclosure_created';
    action_name := 'legal_disclosure_created';
  elsif new.status = 'approved' and old.status is distinct from 'approved' then
    event_name := 'disclosure_approved';
    action_name := 'legal_disclosure_approved';
  elsif new.status = 'transmitted' and old.status is distinct from 'transmitted' then
    event_name := 'disclosure_transmitted';
    action_name := 'legal_disclosure_transmitted';
  else
    event_name := 'disclosure_updated';
    action_name := 'legal_disclosure_updated';
  end if;

  insert into public.legal_request_events (
    request_id, disclosure_id, event_type, action, purpose, details, actor_id
  ) values (
    new.request_id,
    new.id,
    event_name,
    action_name,
    'Record disclosure-control lifecycle state.',
    jsonb_strip_nulls(jsonb_build_object(
      'disclosure_type', new.disclosure_type,
      'status', new.status,
      'approved_at', new.approved_at,
      'transmitted_at', new.transmitted_at,
      'manifest_sha256', new.manifest_sha256
    )),
    new.updated_by
  );

  return new;
end;
$$;

create or replace function public.prevent_legal_operations_append_only_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Legal-operations append-only records cannot be updated or deleted.' using errcode = '42501';
end;
$$;

create or replace function public.legal_hold_applies(
  p_resource_key text default null,
  p_target_type text default null,
  p_target_ref text default null,
  p_subject_user_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    case
      when p_resource_key is null
       and p_target_type is null
       and p_target_ref is null
       and p_subject_user_id is null
      then false
      else exists (
        select 1
        from public.legal_preservation_holds hold_row
        join public.legal_preservation_hold_targets target_row
          on target_row.hold_id = hold_row.id
        where hold_row.status = 'active'
          and (hold_row.starts_at is null or hold_row.starts_at <= now())
          and (hold_row.expires_at is null or hold_row.expires_at > now())
          and (
            (p_subject_user_id is not null and target_row.subject_user_id = p_subject_user_id)
            or (
              p_target_type is not null
              and target_row.target_type = p_target_type
              and (p_target_ref is null or target_row.target_ref = p_target_ref)
            )
            or (p_resource_key is not null and target_row.resource_key = p_resource_key)
          )
      )
    end;
$$;

revoke all on function public.set_legal_operations_updated_at() from public;
revoke all on function public.normalize_legal_request_closure() from public;
revoke all on function public.log_legal_request_change() from public;
revoke all on function public.log_legal_hold_change() from public;
revoke all on function public.log_legal_disclosure_change() from public;
revoke all on function public.prevent_legal_operations_append_only_mutation() from public;
revoke all on function public.legal_hold_applies(text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.legal_hold_applies(text, text, text, uuid) to service_role;

drop trigger if exists legal_requests_normalize_closure on public.legal_requests;
create trigger legal_requests_normalize_closure
before update on public.legal_requests
for each row execute function public.normalize_legal_request_closure();

drop trigger if exists legal_requests_set_updated_at on public.legal_requests;
create trigger legal_requests_set_updated_at
before update on public.legal_requests
for each row execute function public.set_legal_operations_updated_at();

drop trigger if exists legal_requests_log_change on public.legal_requests;
create trigger legal_requests_log_change
after insert or update on public.legal_requests
for each row execute function public.log_legal_request_change();

drop trigger if exists legal_preservation_holds_set_updated_at on public.legal_preservation_holds;
create trigger legal_preservation_holds_set_updated_at
before update on public.legal_preservation_holds
for each row execute function public.set_legal_operations_updated_at();

drop trigger if exists legal_preservation_holds_log_change on public.legal_preservation_holds;
create trigger legal_preservation_holds_log_change
after insert or update on public.legal_preservation_holds
for each row execute function public.log_legal_hold_change();

drop trigger if exists legal_disclosures_set_updated_at on public.legal_disclosures;
create trigger legal_disclosures_set_updated_at
before update on public.legal_disclosures
for each row execute function public.set_legal_operations_updated_at();

drop trigger if exists legal_disclosures_log_change on public.legal_disclosures;
create trigger legal_disclosures_log_change
after insert or update on public.legal_disclosures
for each row execute function public.log_legal_disclosure_change();

drop trigger if exists legal_request_events_append_only on public.legal_request_events;
create trigger legal_request_events_append_only
before update or delete on public.legal_request_events
for each row execute function public.prevent_legal_operations_append_only_mutation();

drop trigger if exists legal_hold_targets_append_only on public.legal_preservation_hold_targets;
create trigger legal_hold_targets_append_only
before update or delete on public.legal_preservation_hold_targets
for each row execute function public.prevent_legal_operations_append_only_mutation();

drop trigger if exists legal_disclosure_items_append_only on public.legal_disclosure_items;
create trigger legal_disclosure_items_append_only
before update or delete on public.legal_disclosure_items
for each row execute function public.prevent_legal_operations_append_only_mutation();

alter table public.legal_operations_authorizations enable row level security;
alter table public.legal_requests enable row level security;
alter table public.legal_preservation_holds enable row level security;
alter table public.legal_preservation_hold_targets enable row level security;
alter table public.legal_disclosures enable row level security;
alter table public.legal_disclosure_items enable row level security;
alter table public.legal_request_events enable row level security;

revoke all on table public.legal_operations_authorizations from public, anon, authenticated;
revoke all on table public.legal_requests from public, anon, authenticated;
revoke all on table public.legal_preservation_holds from public, anon, authenticated;
revoke all on table public.legal_preservation_hold_targets from public, anon, authenticated;
revoke all on table public.legal_disclosures from public, anon, authenticated;
revoke all on table public.legal_disclosure_items from public, anon, authenticated;
revoke all on table public.legal_request_events from public, anon, authenticated;

revoke all on table public.legal_operations_authorizations from service_role;
revoke all on table public.legal_requests from service_role;
revoke all on table public.legal_preservation_holds from service_role;
revoke all on table public.legal_preservation_hold_targets from service_role;
revoke all on table public.legal_disclosures from service_role;
revoke all on table public.legal_disclosure_items from service_role;
revoke all on table public.legal_request_events from service_role;

grant select, insert, update on table public.legal_operations_authorizations to service_role;
grant select, insert, update on table public.legal_requests to service_role;
grant select, insert, update on table public.legal_preservation_holds to service_role;
grant select, insert on table public.legal_preservation_hold_targets to service_role;
grant select, insert, update on table public.legal_disclosures to service_role;
grant select, insert on table public.legal_disclosure_items to service_role;
grant select, insert on table public.legal_request_events to service_role;
grant usage, select on sequence public.legal_request_number_seq to service_role;

comment on table public.legal_operations_authorizations is
'Restricted legal-operations capability assignments. Not a public personnel directory.';
comment on table public.legal_requests is
'Restricted legal-request operational records. A row does not itself establish legal validity or disclosure authority.';
comment on table public.legal_preservation_holds is
'Restricted preservation-hold decisions. Active holds are preservation controls and do not change member-visible content or access by themselves.';
comment on table public.legal_preservation_hold_targets is
'Append-only references identifying the minimum resources covered by a preservation hold; no copied source payload is required.';
comment on table public.legal_disclosures is
'Restricted disclosure-control records and transmission metadata. Creating a row does not transmit data.';
comment on table public.legal_disclosure_items is
'Append-only least-data disclosure manifest entries. Stores metadata and integrity hashes, not the disclosed payload.';
comment on table public.legal_request_events is
'Append-only legal-request, preservation, review, disclosure, and handling audit history.';

notify pgrst, 'reload schema';

commit;
