-- Issue #667: restricted and auditable Trust and Safety case records.
-- This migration stores case metadata and evidence references only. It does not
-- create a raw-media evidence store or publish any member-facing policy.

begin;

create sequence if not exists public.trust_safety_case_number_seq;

create or replace function public.next_trust_safety_case_number()
returns text
language sql
volatile
security definer
set search_path = public
as $$
  select
    'TS-' || to_char(current_date, 'YYYY') || '-' ||
    lpad(nextval('public.trust_safety_case_number_seq')::text, 6, '0');
$$;

revoke all on function public.next_trust_safety_case_number() from public;
grant execute on function public.next_trust_safety_case_number() to service_role;

create table if not exists public.trust_safety_cases (
  id uuid primary key default gen_random_uuid(),
  case_number text not null default public.next_trust_safety_case_number(),
  source_type text not null default 'manual',
  source_id text,
  severity text not null default 'S4',
  primary_category text not null default 'other',
  secondary_categories text[] not null default '{}'::text[],
  status text not null default 'new',
  summary text not null,
  reported_risk text,
  observed_facts text,
  unresolved_facts text,
  reviewer_inference text,
  containment_summary text,
  decision text,
  decision_rationale text,
  external_escalation_status text,
  member_notice_decision text,
  preservation_status text,
  target_refs jsonb not null default '{}'::jsonb,
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  closed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint trust_safety_cases_case_number_unique unique (case_number),
  constraint trust_safety_cases_source_type_check check (
    source_type in (
      'report', 'room_moderation', 'security_email', 'privacy_email',
      'legal_email', 'support_email', 'system', 'manual', 'other'
    )
  ),
  constraint trust_safety_cases_source_id_length_check check (
    source_id is null or char_length(source_id) <= 500
  ),
  constraint trust_safety_cases_severity_check check (
    severity in ('S1', 'S2', 'S3', 'S4')
  ),
  constraint trust_safety_cases_primary_category_check check (
    primary_category in (
      'credible_threat', 'child_safety', 'sexual_exploitation',
      'intimate_image_abuse', 'sextortion', 'stalking', 'doxxing',
      'trafficking', 'dangerous_organization', 'self_harm', 'fraud',
      'account_security', 'harassment', 'impersonation', 'privacy',
      'room_safety', 'other'
    )
  ),
  constraint trust_safety_cases_secondary_categories_check check (
    cardinality(secondary_categories) <= 10
  ),
  constraint trust_safety_cases_status_check check (
    status in (
      'new', 'triage', 'contained', 'reviewing', 'awaiting_specialist',
      'awaiting_legal', 'monitoring', 'closed'
    )
  ),
  constraint trust_safety_cases_summary_length_check check (
    char_length(summary) between 10 and 4000
  ),
  constraint trust_safety_cases_reported_risk_length_check check (
    reported_risk is null or char_length(reported_risk) <= 10000
  ),
  constraint trust_safety_cases_observed_facts_length_check check (
    observed_facts is null or char_length(observed_facts) <= 12000
  ),
  constraint trust_safety_cases_unresolved_facts_length_check check (
    unresolved_facts is null or char_length(unresolved_facts) <= 12000
  ),
  constraint trust_safety_cases_reviewer_inference_length_check check (
    reviewer_inference is null or char_length(reviewer_inference) <= 10000
  ),
  constraint trust_safety_cases_containment_summary_length_check check (
    containment_summary is null or char_length(containment_summary) <= 10000
  ),
  constraint trust_safety_cases_decision_length_check check (
    decision is null or char_length(decision) <= 12000
  ),
  constraint trust_safety_cases_decision_rationale_length_check check (
    decision_rationale is null or char_length(decision_rationale) <= 12000
  ),
  constraint trust_safety_cases_external_escalation_length_check check (
    external_escalation_status is null or char_length(external_escalation_status) <= 4000
  ),
  constraint trust_safety_cases_member_notice_length_check check (
    member_notice_decision is null or char_length(member_notice_decision) <= 4000
  ),
  constraint trust_safety_cases_preservation_length_check check (
    preservation_status is null or char_length(preservation_status) <= 4000
  ),
  constraint trust_safety_cases_target_refs_object_check check (
    jsonb_typeof(target_refs) = 'object'
  ),
  constraint trust_safety_cases_target_refs_size_check check (
    octet_length(target_refs::text) <= 20000
  ),
  constraint trust_safety_cases_closed_state_check check (
    (status = 'closed' and closed_at is not null)
    or (status <> 'closed' and closed_at is null)
  )
);

create table if not exists public.trust_safety_case_evidence_refs (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.trust_safety_cases(id) on delete restrict,
  evidence_type text not null,
  source_system text not null,
  source_table text,
  source_record_id text,
  storage_reference text,
  existing_hash text,
  original_timestamp timestamptz,
  collection_purpose text not null,
  minimum_necessary_justification text not null,
  preservation_status text not null default 'referenced',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint trust_safety_case_evidence_type_length_check check (
    char_length(evidence_type) between 2 and 100
  ),
  constraint trust_safety_case_evidence_source_system_length_check check (
    char_length(source_system) between 2 and 100
  ),
  constraint trust_safety_case_evidence_source_table_length_check check (
    source_table is null or char_length(source_table) <= 160
  ),
  constraint trust_safety_case_evidence_source_record_length_check check (
    source_record_id is null or char_length(source_record_id) <= 500
  ),
  constraint trust_safety_case_evidence_storage_reference_length_check check (
    storage_reference is null or char_length(storage_reference) <= 2000
  ),
  constraint trust_safety_case_evidence_hash_length_check check (
    existing_hash is null or char_length(existing_hash) <= 512
  ),
  constraint trust_safety_case_evidence_purpose_length_check check (
    char_length(collection_purpose) between 5 and 2000
  ),
  constraint trust_safety_case_evidence_minimum_length_check check (
    char_length(minimum_necessary_justification) between 5 and 2000
  ),
  constraint trust_safety_case_evidence_preservation_length_check check (
    char_length(preservation_status) between 2 and 500
  ),
  constraint trust_safety_case_evidence_metadata_object_check check (
    jsonb_typeof(metadata) = 'object'
  ),
  constraint trust_safety_case_evidence_metadata_size_check check (
    octet_length(metadata::text) <= 20000
  )
);

create table if not exists public.trust_safety_case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.trust_safety_cases(id) on delete restrict,
  evidence_ref_id uuid references public.trust_safety_case_evidence_refs(id) on delete restrict,
  event_type text not null,
  action text not null,
  purpose text,
  previous_location text,
  new_location text,
  details jsonb not null default '{}'::jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint trust_safety_case_events_type_check check (
    event_type in (
      'case_created', 'case_updated', 'status_changed', 'closure',
      'evidence_added', 'handling', 'note', 'access', 'specialist_routing'
    )
  ),
  constraint trust_safety_case_events_action_length_check check (
    char_length(action) between 2 and 160
  ),
  constraint trust_safety_case_events_purpose_length_check check (
    purpose is null or char_length(purpose) <= 2000
  ),
  constraint trust_safety_case_events_previous_location_length_check check (
    previous_location is null or char_length(previous_location) <= 2000
  ),
  constraint trust_safety_case_events_new_location_length_check check (
    new_location is null or char_length(new_location) <= 2000
  ),
  constraint trust_safety_case_events_details_object_check check (
    jsonb_typeof(details) = 'object'
  ),
  constraint trust_safety_case_events_details_size_check check (
    octet_length(details::text) <= 20000
  )
);

create index if not exists trust_safety_cases_status_severity_idx
  on public.trust_safety_cases (status, severity, updated_at desc);
create index if not exists trust_safety_cases_category_idx
  on public.trust_safety_cases (primary_category, status, updated_at desc);
create index if not exists trust_safety_cases_assignment_idx
  on public.trust_safety_cases (assigned_to, status, updated_at desc);
create index if not exists trust_safety_cases_source_idx
  on public.trust_safety_cases (source_type, source_id);
create index if not exists trust_safety_case_evidence_case_idx
  on public.trust_safety_case_evidence_refs (case_id, created_at asc);
create index if not exists trust_safety_case_events_case_idx
  on public.trust_safety_case_events (case_id, created_at asc);
create index if not exists trust_safety_case_events_evidence_idx
  on public.trust_safety_case_events (evidence_ref_id, created_at asc)
  where evidence_ref_id is not null;

create or replace function public.set_trust_safety_case_updated_at()
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

create or replace function public.log_trust_safety_case_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  change_type text;
  action_name text;
begin
  if tg_op = 'INSERT' then
    insert into public.trust_safety_case_events (
      case_id,
      event_type,
      action,
      purpose,
      details,
      actor_id
    ) values (
      new.id,
      'case_created',
      'case_created',
      'Create restricted Trust and Safety case record.',
      jsonb_build_object(
        'case_number', new.case_number,
        'severity', new.severity,
        'status', new.status,
        'primary_category', new.primary_category,
        'source_type', new.source_type
      ),
      new.created_by
    );
    return new;
  end if;

  if new.status is distinct from old.status then
    change_type := case when new.status = 'closed' then 'closure' else 'status_changed' end;
    action_name := case when new.status = 'closed' then 'case_closed' else 'case_status_changed' end;
  else
    change_type := 'case_updated';
    action_name := 'case_updated';
  end if;

  insert into public.trust_safety_case_events (
    case_id,
    event_type,
    action,
    purpose,
    details,
    actor_id
  ) values (
    new.id,
    change_type,
    action_name,
    'Record an authorized case-state change.',
    jsonb_strip_nulls(jsonb_build_object(
      'previous_status', old.status,
      'status', new.status,
      'previous_severity', old.severity,
      'severity', new.severity,
      'previous_category', old.primary_category,
      'primary_category', new.primary_category,
      'previous_assigned_to', old.assigned_to,
      'assigned_to', new.assigned_to,
      'closed_at', new.closed_at
    )),
    new.updated_by
  );

  return new;
end;
$$;

create or replace function public.log_trust_safety_evidence_reference()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.trust_safety_case_events (
    case_id,
    evidence_ref_id,
    event_type,
    action,
    purpose,
    details,
    actor_id
  ) values (
    new.case_id,
    new.id,
    'evidence_added',
    'evidence_reference_added',
    new.collection_purpose,
    jsonb_strip_nulls(jsonb_build_object(
      'evidence_type', new.evidence_type,
      'source_system', new.source_system,
      'source_table', new.source_table,
      'source_record_id', new.source_record_id,
      'preservation_status', new.preservation_status
    )),
    new.created_by
  );
  return new;
end;
$$;

create or replace function public.prevent_trust_safety_event_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Trust and Safety case events are append-only.' using errcode = '42501';
end;
$$;

revoke all on function public.set_trust_safety_case_updated_at() from public;
revoke all on function public.log_trust_safety_case_change() from public;
revoke all on function public.log_trust_safety_evidence_reference() from public;
revoke all on function public.prevent_trust_safety_event_mutation() from public;

drop trigger if exists trust_safety_cases_set_updated_at on public.trust_safety_cases;
create trigger trust_safety_cases_set_updated_at
before update on public.trust_safety_cases
for each row execute function public.set_trust_safety_case_updated_at();

drop trigger if exists trust_safety_cases_log_change on public.trust_safety_cases;
create trigger trust_safety_cases_log_change
after insert or update on public.trust_safety_cases
for each row execute function public.log_trust_safety_case_change();

drop trigger if exists trust_safety_evidence_log_insert on public.trust_safety_case_evidence_refs;
create trigger trust_safety_evidence_log_insert
after insert on public.trust_safety_case_evidence_refs
for each row execute function public.log_trust_safety_evidence_reference();

drop trigger if exists trust_safety_events_append_only on public.trust_safety_case_events;
create trigger trust_safety_events_append_only
before update or delete on public.trust_safety_case_events
for each row execute function public.prevent_trust_safety_event_mutation();

alter table public.trust_safety_cases enable row level security;
alter table public.trust_safety_case_evidence_refs enable row level security;
alter table public.trust_safety_case_events enable row level security;

revoke all on table public.trust_safety_cases from public, anon, authenticated;
revoke all on table public.trust_safety_case_evidence_refs from public, anon, authenticated;
revoke all on table public.trust_safety_case_events from public, anon, authenticated;

revoke all on table public.trust_safety_cases from service_role;
revoke all on table public.trust_safety_case_evidence_refs from service_role;
revoke all on table public.trust_safety_case_events from service_role;

grant select, insert, update on table public.trust_safety_cases to service_role;
grant select, insert on table public.trust_safety_case_evidence_refs to service_role;
grant select, insert on table public.trust_safety_case_events to service_role;
grant usage, select on sequence public.trust_safety_case_number_seq to service_role;

notify pgrst, 'reload schema';

commit;
