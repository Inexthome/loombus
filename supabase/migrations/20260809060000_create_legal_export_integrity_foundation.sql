-- Issue #674: chain-of-custody and export-integrity foundation.
-- Metadata and control structure only. This migration does not retrieve source data,
-- generate an export, register a real artifact, approve a disclosure, send a notice,
-- transfer custody externally, or enable export authority.

begin;

alter table public.legal_operations_authorizations
  add column if not exists can_review_export_integrity boolean not null default false;

comment on column public.legal_operations_authorizations.can_review_export_integrity is
'Allows restricted review of export-integrity and chain-of-custody metadata only. It does not grant can_export, can_disclose, emergency approval, source collection, or external transmission authority.';

create table if not exists public.legal_export_packages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.legal_requests(id) on delete restrict,
  disclosure_id uuid not null references public.legal_disclosures(id) on delete restrict,
  status text not null default 'planned',
  package_label text not null,
  manifest_item_count integer not null default 0,
  artifact_count integer not null default 0,
  total_bytes bigint not null default 0,
  manifest_sha256 text,
  package_sha256 text,
  generated_by uuid references auth.users(id) on delete restrict,
  generated_at timestamptz,
  verified_by uuid references auth.users(id) on delete restrict,
  verified_at timestamptz,
  sealed_by uuid references auth.users(id) on delete restrict,
  sealed_at timestamptz,
  voided_by uuid references auth.users(id) on delete restrict,
  voided_at timestamptz,
  void_reason text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint legal_export_packages_status_check check (
    status in ('planned', 'generated', 'verified', 'sealed', 'voided')
  ),
  constraint legal_export_packages_label_length_check check (
    char_length(package_label) between 2 and 500
  ),
  constraint legal_export_packages_counts_check check (
    manifest_item_count >= 0 and artifact_count >= 0 and total_bytes >= 0
  ),
  constraint legal_export_packages_manifest_hash_check check (
    manifest_sha256 is null or manifest_sha256 ~ '^[0-9a-fA-F]{64}$'
  ),
  constraint legal_export_packages_package_hash_check check (
    package_sha256 is null or package_sha256 ~ '^[0-9a-fA-F]{64}$'
  ),
  constraint legal_export_packages_generated_state_check check (
    status not in ('generated', 'verified', 'sealed')
    or (generated_by is not null and generated_at is not null)
  ),
  constraint legal_export_packages_verified_state_check check (
    status not in ('verified', 'sealed')
    or (
      verified_by is not null
      and verified_at is not null
      and manifest_sha256 is not null
      and package_sha256 is not null
    )
  ),
  constraint legal_export_packages_sealed_state_check check (
    status <> 'sealed' or (sealed_by is not null and sealed_at is not null)
  ),
  constraint legal_export_packages_voided_state_check check (
    status <> 'voided'
    or (
      voided_by is not null
      and voided_at is not null
      and char_length(trim(coalesce(void_reason, ''))) between 5 and 4000
    )
  ),
  constraint legal_export_packages_void_reason_length_check check (
    void_reason is null or char_length(void_reason) <= 4000
  )
);

create table if not exists public.legal_export_artifacts (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.legal_export_packages(id) on delete restrict,
  disclosure_item_id uuid references public.legal_disclosure_items(id) on delete restrict,
  artifact_role text not null,
  file_name text not null,
  media_type text,
  byte_size bigint not null,
  sha256 text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint legal_export_artifacts_role_check check (
    artifact_role in ('manifest', 'data', 'attachment', 'readme', 'index', 'other')
  ),
  constraint legal_export_artifacts_file_name_length_check check (
    char_length(file_name) between 1 and 1000
  ),
  constraint legal_export_artifacts_media_type_length_check check (
    media_type is null or char_length(media_type) <= 300
  ),
  constraint legal_export_artifacts_byte_size_check check (byte_size >= 0),
  constraint legal_export_artifacts_hash_check check (
    sha256 ~ '^[0-9a-fA-F]{64}$'
  ),
  constraint legal_export_artifacts_unique_file unique (package_id, file_name)
);

create table if not exists public.legal_export_verifications (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.legal_export_packages(id) on delete restrict,
  verification_type text not null,
  result text not null,
  expected_digest text,
  observed_digest text,
  expected_count bigint,
  observed_count bigint,
  verification_note text,
  verified_by uuid not null references auth.users(id) on delete restrict,
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint legal_export_verifications_type_check check (
    verification_type in (
      'manifest_hash', 'package_hash', 'artifact_hashes', 'manifest_item_coverage',
      'artifact_count', 'byte_count', 'field_scope', 'custody_continuity'
    )
  ),
  constraint legal_export_verifications_result_check check (
    result in ('pass', 'fail')
  ),
  constraint legal_export_verifications_expected_digest_check check (
    expected_digest is null or expected_digest ~ '^[0-9a-fA-F]{64}$'
  ),
  constraint legal_export_verifications_observed_digest_check check (
    observed_digest is null or observed_digest ~ '^[0-9a-fA-F]{64}$'
  ),
  constraint legal_export_verifications_counts_check check (
    (expected_count is null or expected_count >= 0)
    and (observed_count is null or observed_count >= 0)
  ),
  constraint legal_export_verifications_note_length_check check (
    verification_note is null or char_length(verification_note) <= 4000
  )
);

create table if not exists public.legal_chain_of_custody_events (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.legal_export_packages(id) on delete restrict,
  event_type text not null,
  actor_id uuid references auth.users(id) on delete restrict,
  custody_location_ref text,
  counterparty_reference text,
  event_summary text not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint legal_chain_of_custody_events_type_check check (
    event_type in (
      'package_registered', 'artifact_registered', 'verification_recorded',
      'sealed', 'internal_handoff', 'external_transfer', 'external_receipt',
      'access', 'voided', 'destroyed'
    )
  ),
  constraint legal_chain_of_custody_events_location_length_check check (
    custody_location_ref is null or char_length(custody_location_ref) <= 1000
  ),
  constraint legal_chain_of_custody_events_counterparty_length_check check (
    counterparty_reference is null or char_length(counterparty_reference) <= 1000
  ),
  constraint legal_chain_of_custody_events_summary_length_check check (
    char_length(event_summary) between 5 and 4000
  ),
  constraint legal_chain_of_custody_events_external_counterparty_check check (
    event_type not in ('external_transfer', 'external_receipt')
    or counterparty_reference is not null
  )
);

create or replace function public.legal_enforce_export_package_request_consistency()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.legal_disclosures disclosure
    where disclosure.id = new.disclosure_id
      and disclosure.request_id = new.request_id
  ) then
    raise exception 'Export package disclosure does not belong to the legal request.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.legal_enforce_export_package_request_consistency()
  from public, anon, authenticated;

drop trigger if exists legal_export_package_request_consistency on public.legal_export_packages;
create trigger legal_export_package_request_consistency
before insert or update on public.legal_export_packages
for each row execute function public.legal_enforce_export_package_request_consistency();

create index if not exists legal_export_packages_request_created_idx
  on public.legal_export_packages(request_id, created_at);
create index if not exists legal_export_packages_disclosure_created_idx
  on public.legal_export_packages(disclosure_id, created_at);
create index if not exists legal_export_artifacts_package_created_idx
  on public.legal_export_artifacts(package_id, created_at);
create index if not exists legal_export_verifications_package_created_idx
  on public.legal_export_verifications(package_id, created_at);
create index if not exists legal_chain_of_custody_package_occurred_idx
  on public.legal_chain_of_custody_events(package_id, occurred_at, created_at);

-- Future approved write RPCs may append artifacts, verification records, or custody
-- events, but those evidentiary rows must never be rewritten in place.
drop trigger if exists legal_export_artifacts_append_only on public.legal_export_artifacts;
create trigger legal_export_artifacts_append_only
before update or delete on public.legal_export_artifacts
for each row execute function public.prevent_legal_operations_append_only_mutation();

drop trigger if exists legal_export_verifications_append_only on public.legal_export_verifications;
create trigger legal_export_verifications_append_only
before update or delete on public.legal_export_verifications
for each row execute function public.prevent_legal_operations_append_only_mutation();

drop trigger if exists legal_chain_of_custody_events_append_only on public.legal_chain_of_custody_events;
create trigger legal_chain_of_custody_events_append_only
before update or delete on public.legal_chain_of_custody_events
for each row execute function public.prevent_legal_operations_append_only_mutation();

alter table public.legal_export_packages enable row level security;
alter table public.legal_export_artifacts enable row level security;
alter table public.legal_export_verifications enable row level security;
alter table public.legal_chain_of_custody_events enable row level security;

-- No browser policies are created. Registry and custody metadata remain accessible
-- only through the restricted server-side Legal Operations boundary.
revoke all on table public.legal_export_packages from public, anon, authenticated, service_role;
revoke all on table public.legal_export_artifacts from public, anon, authenticated, service_role;
revoke all on table public.legal_export_verifications from public, anon, authenticated, service_role;
revoke all on table public.legal_chain_of_custody_events from public, anon, authenticated, service_role;

grant select on table public.legal_export_packages to service_role;
grant select on table public.legal_export_artifacts to service_role;
grant select on table public.legal_export_verifications to service_role;
grant select on table public.legal_chain_of_custody_events to service_role;

comment on function public.legal_enforce_export_package_request_consistency() is
'Issue #674 integrity guard. Prevents a package from linking a disclosure to the wrong legal request.';
comment on table public.legal_export_packages is
'Issue #674 export-integrity package control metadata. No export-generation write path is enabled by this foundation.';
comment on table public.legal_export_artifacts is
'Issue #674 append-only artifact integrity metadata. Stores file metadata and digests only, never export payload bytes.';
comment on table public.legal_export_verifications is
'Issue #674 append-only integrity verification results. Does not authorize export creation or disclosure.';
comment on table public.legal_chain_of_custody_events is
'Issue #674 append-only custody-event metadata. External transfer remains disabled until a separately approved operational phase.';

commit;
