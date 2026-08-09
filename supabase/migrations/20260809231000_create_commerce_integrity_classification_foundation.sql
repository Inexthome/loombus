-- Issue #670: restricted commerce-integrity classification ledger foundation.
--
-- This migration creates an additive, versioned, append-only classification history.
-- It does not change member reports, source-record lifecycle, moderation actions,
-- enforcement decisions, Trust and Safety cases, legal preservation, member notice,
-- public policy, or external reporting/disclosure behavior.
--
-- Source and report references are validated at classification time but are not
-- foreign-keyed. This is deliberate: current commerce report/source records may be
-- deleted under their own approved lifecycles, while classification history must not
-- silently cascade away or create a new source-deletion blocker.

begin;

create or replace function public.commerce_integrity_text_array_is_unique(
  p_values text[]
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    not exists (
      select 1
      from unnest(coalesce(p_values, '{}'::text[])) as item(value)
      where item.value is null or btrim(item.value) = ''
    )
    and cardinality(coalesce(p_values, '{}'::text[])) = (
      select count(distinct item.value)::integer
      from unnest(coalesce(p_values, '{}'::text[])) as item(value)
    );
$$;

create or replace function public.commerce_integrity_text_arrays_disjoint(
  p_left text[],
  p_right text[]
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select not exists (
    select 1
    from unnest(coalesce(p_left, '{}'::text[])) as left_item(value)
    join unnest(coalesce(p_right, '{}'::text[])) as right_item(value)
      on right_item.value = left_item.value
  );
$$;

create or replace function public.commerce_integrity_context_modifiers_valid(
  p_values text[]
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    public.commerce_integrity_text_array_is_unique(p_values)
    and cardinality(coalesce(p_values, '{}'::text[])) <= 20
    and not exists (
      select 1
      from unnest(coalesce(p_values, '{}'::text[])) as item(value)
      where item.value not in (
        'CTX.DOCUMENTARY',
        'CTX.EDUCATIONAL',
        'CTX.SCIENTIFIC',
        'CTX.ARTISTIC',
        'CTX.JOURNALISTIC',
        'CTX.HISTORICAL',
        'CTX.LEGAL',
        'CTX.COUNTERSPEECH',
        'CTX.HELP_SEEKING',
        'CTX.PREVENTION',
        'CTX.SATIRE_OR_PARODY',
        'CTX.SELF_REFERENCE',
        'CTX.RECLAIMED_LANGUAGE',
        'CTX.PUBLIC_FIGURE',
        'CTX.MINOR_TARGET',
        'CTX.VULNERABLE_TARGET',
        'CTX.OFF_PLATFORM_RISK'
      )
    );
$$;

create table if not exists public.commerce_integrity_taxonomy_versions (
  taxonomy_family text not null,
  taxonomy_version text primary key,
  active_for_new_classification boolean not null default false,
  source_of_truth text not null,
  created_at timestamptz not null default now(),
  constraint commerce_integrity_taxonomy_family_check check (
    taxonomy_family = 'commerce_integrity'
  ),
  constraint commerce_integrity_taxonomy_version_length_check check (
    char_length(taxonomy_version) between 5 and 120
  ),
  constraint commerce_integrity_taxonomy_source_length_check check (
    char_length(source_of_truth) between 5 and 1000
  )
);

create table if not exists public.commerce_integrity_source_module_registry (
  taxonomy_version text not null references public.commerce_integrity_taxonomy_versions(taxonomy_version) on delete restrict,
  source_module text not null,
  source_mode text not null,
  classification_write_enabled boolean not null default false,
  allowed_record_types text[] not null,
  allowed_report_types text[] not null default '{}'::text[],
  notes text not null,
  created_at timestamptz not null default now(),
  primary key (taxonomy_version, source_module),
  constraint commerce_integrity_source_module_check check (
    source_module in (
      'marketplace', 'businesses', 'services', 'requests', 'jobs',
      'events', 'appointments', 'rooms', 'local', 'messages'
    )
  ),
  constraint commerce_integrity_source_mode_check check (
    source_mode in ('direct', 'conditional', 'restricted', 'inherited_only')
  ),
  constraint commerce_integrity_source_record_types_check check (
    cardinality(allowed_record_types) between 1 and 4
    and public.commerce_integrity_text_array_is_unique(allowed_record_types)
  ),
  constraint commerce_integrity_source_report_types_check check (
    cardinality(allowed_report_types) <= 4
    and public.commerce_integrity_text_array_is_unique(allowed_report_types)
  ),
  constraint commerce_integrity_source_write_boundary_check check (
    classification_write_enabled = true
    or source_mode in ('restricted', 'inherited_only')
    or source_mode in ('direct', 'conditional')
  ),
  constraint commerce_integrity_source_notes_length_check check (
    char_length(notes) between 5 and 4000
  )
);

create table if not exists public.commerce_integrity_taxonomy_categories (
  taxonomy_version text not null references public.commerce_integrity_taxonomy_versions(taxonomy_version) on delete restrict,
  category_id text not null,
  title text not null,
  internal_label text not null,
  primary_modules text[] not null,
  secondary_modules text[] not null,
  safety_reason_codes text[] not null,
  created_at timestamptz not null default now(),
  primary key (taxonomy_version, category_id),
  constraint commerce_integrity_category_id_check check (
    category_id in (
      'COM-01','COM-02','COM-03','COM-04','COM-05',
      'COM-06','COM-07','COM-08','COM-09','COM-10',
      'COM-11','COM-12','COM-13','COM-14','COM-15'
    )
  ),
  constraint commerce_integrity_category_title_length_check check (
    char_length(title) between 5 and 500
  ),
  constraint commerce_integrity_category_label_length_check check (
    char_length(internal_label) between 5 and 300
  ),
  constraint commerce_integrity_category_primary_modules_check check (
    cardinality(primary_modules) >= 1
    and public.commerce_integrity_text_array_is_unique(primary_modules)
  ),
  constraint commerce_integrity_category_secondary_modules_check check (
    public.commerce_integrity_text_array_is_unique(secondary_modules)
  ),
  constraint commerce_integrity_category_module_overlap_check check (
    public.commerce_integrity_text_arrays_disjoint(primary_modules, secondary_modules)
  ),
  constraint commerce_integrity_category_reason_codes_check check (
    cardinality(safety_reason_codes) >= 1
    and public.commerce_integrity_text_array_is_unique(safety_reason_codes)
    and cardinality(safety_reason_codes) <= 24
  )
);

insert into public.commerce_integrity_taxonomy_versions (
  taxonomy_family,
  taxonomy_version,
  active_for_new_classification,
  source_of_truth
)
values (
  'commerce_integrity',
  'commerce_integrity.v1',
  true,
  'src/lib/commerce-integrity-taxonomy.ts and docs/trust-safety/commerce/issue-670-canonical-commerce-and-professional-integrity-taxonomy.md'
)
on conflict (taxonomy_version) do update set
  taxonomy_family = excluded.taxonomy_family,
  active_for_new_classification = excluded.active_for_new_classification,
  source_of_truth = excluded.source_of_truth;

insert into public.commerce_integrity_source_module_registry (
  taxonomy_version,
  source_module,
  source_mode,
  classification_write_enabled,
  allowed_record_types,
  allowed_report_types,
  notes
)
values
  ('commerce_integrity.v1', 'marketplace', 'direct', true,
    array['marketplace_listing'], array['marketplace_report'],
    'Direct source classification is permitted through a future authorized server workflow. Original Marketplace report text remains separate.'),
  ('commerce_integrity.v1', 'businesses', 'direct', true,
    array['business'], array['business_report'],
    'Business ownership and verification remain separate from commerce-integrity classification.'),
  ('commerce_integrity.v1', 'services', 'direct', true,
    array['provider_service'], array['service_report'],
    'Professional and Service classifications must not imply an unreviewed licensing or legal conclusion.'),
  ('commerce_integrity.v1', 'requests', 'direct', true,
    array['service_request'], array['request_report'],
    'Request lifecycle and fulfillment remain separate from policy classification.'),
  ('commerce_integrity.v1', 'jobs', 'direct', true,
    array['job_posting'], array['job_report'],
    'Employment classification remains separate from employer publication and application lifecycle.'),
  ('commerce_integrity.v1', 'events', 'direct', true,
    array['public_event'], array['event_report'],
    'Event publication and report resolution remain separate from policy classification.'),
  ('commerce_integrity.v1', 'appointments', 'conditional', true,
    array['appointment_request'], '{}'::text[],
    'Routine cancellation and scheduling reasons are operational. Classify only reviewed covered conduct.'),
  ('commerce_integrity.v1', 'rooms', 'restricted', false,
    array['room'], array['room_report'],
    'Phase C does not enable Room classification writes. A later restricted workflow must preserve private Room evidence boundaries.'),
  ('commerce_integrity.v1', 'local', 'inherited_only', false,
    array['local_projection'], '{}'::text[],
    'Local is an aggregation layer. Direct classification writes remain disabled; classification must attach to the underlying source record.'),
  ('commerce_integrity.v1', 'messages', 'restricted', false,
    array['private_message','private_conversation'], array['general_report'],
    'Phase C does not enable private-message classification writes. A later restricted workflow must retain the existing bounded evidence authorization path.')
on conflict (taxonomy_version, source_module) do update set
  source_mode = excluded.source_mode,
  classification_write_enabled = excluded.classification_write_enabled,
  allowed_record_types = excluded.allowed_record_types,
  allowed_report_types = excluded.allowed_report_types,
  notes = excluded.notes;

insert into public.commerce_integrity_taxonomy_categories (
  taxonomy_version,
  category_id,
  title,
  internal_label,
  primary_modules,
  secondary_modules,
  safety_reason_codes
)
values
(
  'commerce_integrity.v1','COM-01',
  'Weapons, ammunition, explosives, and dangerous items',
  'Weapons and dangerous items',
  array['marketplace','services','requests','messages'],
  array['businesses','jobs','events','appointments','rooms','local'],
  array['GOODS.WEAPON_OR_EXPLOSIVE','VIOLENCE.WEAPON_WRONGDOING','VIOLENCE.OPERATIONAL_FACILITATION']
),
(
  'commerce_integrity.v1','COM-02',
  'Drugs, medicines, intoxicants, and age-restricted products',
  'Drugs, medicines, and age-restricted products',
  array['marketplace','services','requests','messages'],
  array['businesses','jobs','events','appointments','rooms','local'],
  array['GOODS.DRUG_OR_CONTROLLED_PRODUCT','GOODS.PRESCRIPTION_OR_REGULATED_MEDICAL','GOODS.AGE_RESTRICTED_PRODUCT','FRAUD.PAYMENT_SCAM']
),
(
  'commerce_integrity.v1','COM-03',
  'Stolen, counterfeit, forged, recalled, unsafe, and infringing goods',
  'Stolen, counterfeit, unsafe, or infringing goods',
  array['marketplace','messages'],
  array['businesses','services','requests','jobs','events','rooms','local'],
  array['GOODS.STOLEN_PROPERTY','GOODS.COUNTERFEIT_OR_FORGED','GOODS.RECALLED_OR_UNSAFE_PRODUCT','IP.COPYRIGHT','IP.TRADEMARK','IP.COUNTERFEIT','FRAUD.IMPERSONATION']
),
(
  'commerce_integrity.v1','COM-04',
  'Hazardous, environmental, wildlife, and biological materials',
  'Hazardous, environmental, wildlife, or biological materials',
  array['marketplace','services','requests','messages'],
  array['businesses','jobs','events','appointments','rooms','local'],
  array['GOODS.HAZARDOUS_MATERIAL','GOODS.WILDLIFE_OR_ENVIRONMENTAL_CONTRABAND','GOODS.RECALLED_OR_UNSAFE_PRODUCT']
),
(
  'commerce_integrity.v1','COM-05',
  'Sexual exploitation, sexual services, trafficking, and coercive labor',
  'Exploitation, trafficking, or coercive labor',
  array['services','requests','jobs','rooms','messages'],
  array['marketplace','businesses','events','appointments','local'],
  array['CHILD.SEXUAL_EXPLOITATION_MATERIAL','CHILD.GROOMING','CHILD.SEXUAL_SOLICITATION','CHILD.SEXTORTION','INTIMATE.NONCONSENSUAL_DISTRIBUTION','INTIMATE.SEXTORTION','FRAUD.EMPLOYMENT_SCAM']
),
(
  'commerce_integrity.v1','COM-06',
  'Security, account access, personal data, malware, hacking, and surveillance abuse',
  'Security, account-access, data, or surveillance abuse',
  array['marketplace','services','requests','jobs','messages'],
  array['businesses','events','appointments','rooms','local'],
  array['SECURITY.PHISHING','SECURITY.MALWARE','SECURITY.CREDENTIAL_THEFT','SECURITY.ACCOUNT_COMPROMISE','SECURITY.UNAUTHORIZED_SURVEILLANCE','SECURITY.EXPLOIT_OR_BYPASS','GOODS.PERSONAL_DATA_OR_ACCOUNT_ACCESS','PRIVACY.AUTHENTICATION_SECRET','PRIVACY.UNAUTHORIZED_DIRECTORY_OR_EXPORT']
),
(
  'commerce_integrity.v1','COM-07',
  'Gambling, financial schemes, investment promotions, and money-mule activity',
  'Gambling, financial schemes, or money-movement abuse',
  array['marketplace','services','requests','jobs','events','messages'],
  array['businesses','appointments','rooms','local'],
  array['FRAUD.INVESTMENT_OR_FINANCIAL_SCHEME','FRAUD.MONEY_MULE_OR_RESHIPPING','FRAUD.PAYMENT_SCAM','JOBS.MONEY_MULE_OR_RESHIPPING','SERVICE.DECEPTIVE_LEGAL_OR_FINANCIAL_CLAIM']
),
(
  'commerce_integrity.v1','COM-08',
  'Government documents, public benefits, permits, licenses, and credentials',
  'Government documents, benefits, permits, or credentials',
  array['marketplace','services','requests','jobs','messages'],
  array['businesses','rooms','local'],
  array['GOODS.GOVERNMENT_DOCUMENT_OR_BENEFIT','SERVICE.FALSE_CREDENTIAL','FRAUD.IMPERSONATION','PRIVACY.GOVERNMENT_IDENTIFIER']
),
(
  'commerce_integrity.v1','COM-09',
  'Live animals, food, cosmetics, medical devices, and other conditionally allowed categories',
  'Conditionally allowed high-risk products',
  array['marketplace','businesses','local'],
  array['services','requests','events','rooms','messages'],
  array['GOODS.UNAPPROVED_LIVE_ANIMAL_OR_FOOD','GOODS.RECALLED_OR_UNSAFE_PRODUCT','GOODS.PRESCRIPTION_OR_REGULATED_MEDICAL','FRAUD.PAYMENT_SCAM']
),
(
  'commerce_integrity.v1','COM-10',
  'Illegal, dangerous, or unsafe services',
  'Illegal or dangerous services',
  array['services','requests','jobs','appointments','rooms','messages'],
  array['marketplace','businesses','events','local'],
  array['SERVICE.ILLEGAL_OR_DANGEROUS_WORK','VIOLENCE.OPERATIONAL_FACILITATION','SECURITY.EXPLOIT_OR_BYPASS','ROOM.ILLEGAL_OR_SEVERE_HARM_PURPOSE']
),
(
  'commerce_integrity.v1','COM-11',
  'Professional credentials, licensing, and scope-of-practice integrity',
  'Professional credential or scope-of-practice integrity',
  array['businesses','services','jobs','appointments','local'],
  array['marketplace','requests','events','rooms','messages'],
  array['SERVICE.FALSE_CREDENTIAL','SERVICE.UNLICENSED_OR_OUT_OF_SCOPE','FRAUD.IMPERSONATION','JOBS.FAKE_EMPLOYER_OR_AUTHORITY']
),
(
  'commerce_integrity.v1','COM-12',
  'Employment integrity, discrimination, recruitment scams, and unsafe opportunities',
  'Employment integrity or recruiting abuse',
  array['jobs','messages'],
  array['businesses','services','requests','events','rooms','local'],
  array['JOBS.FAKE_EMPLOYER_OR_AUTHORITY','JOBS.NONEXISTENT_OR_MISREPRESENTED_ROLE','JOBS.APPLICATION_FEE_OR_PAYMENT_SCAM','JOBS.MONEY_MULE_OR_RESHIPPING','JOBS.DISCRIMINATION','JOBS.MISLEADING_COMPENSATION','JOBS.SENSITIVE_INFORMATION_ABUSE','JOBS.UNSAFE_TEEN_OPPORTUNITY','JOBS.EXTERNAL_APPLICATION_DECEPTION','JOBS.DUPLICATE_OR_STALE_POSTING']
),
(
  'commerce_integrity.v1','COM-13',
  'Commercial claims, pricing, fees, endorsements, testimonials, and AI representations',
  'Commercial claims, pricing, testimonials, or AI representations',
  array['marketplace','businesses','services','requests','jobs','events','appointments','local','messages'],
  array['rooms'],
  array['SERVICE.DECEPTIVE_PRICE_OR_FEE','SERVICE.FALSE_RESULT_OR_PORTFOLIO','FRAUD.FALSE_TESTIMONIAL_OR_ENDORSEMENT','AI_MEDIA.FALSE_COMMERCIAL_REPRESENTATION','JOBS.MISLEADING_COMPENSATION','INTEGRITY.FAKE_ENGAGEMENT']
),
(
  'commerce_integrity.v1','COM-14',
  'Duplicate, evasive, manipulative, and off-platform transaction abuse',
  'Duplicate, evasive, or manipulative commerce abuse',
  array['marketplace','businesses','services','requests','jobs','events','local','messages'],
  array['appointments','rooms'],
  array['INTEGRITY.DUPLICATE_OR_EVASIVE_REPOSTING','INTEGRITY.SIGNAL_OR_RANKING_MANIPULATION','INTEGRITY.FAKE_ENGAGEMENT','INTEGRITY.BAN_OR_RESTRICTION_EVASION','INTEGRITY.ACCOUNT_NETWORK','ABUSE.REPORT_MISUSE']
),
(
  'commerce_integrity.v1','COM-15',
  'Sensitive-data, inquiry, appointment, and professional-intake abuse',
  'Sensitive-data or professional-intake abuse',
  array['services','requests','jobs','appointments','messages'],
  array['marketplace','businesses','events','rooms','local'],
  array['SERVICE.PRIVACY_OR_INTAKE_ABUSE','SERVICE.APPOINTMENT_OR_INQUIRY_MISUSE','JOBS.SENSITIVE_INFORMATION_ABUSE','PRIVACY.GOVERNMENT_IDENTIFIER','PRIVACY.FINANCIAL_INFORMATION','PRIVACY.AUTHENTICATION_SECRET','PRIVACY.MEDICAL_OR_VULNERABILITY_INFORMATION']
)
on conflict (taxonomy_version, category_id) do update set
  title = excluded.title,
  internal_label = excluded.internal_label,
  primary_modules = excluded.primary_modules,
  secondary_modules = excluded.secondary_modules,
  safety_reason_codes = excluded.safety_reason_codes;

create table if not exists public.commerce_integrity_classifications (
  id uuid primary key default gen_random_uuid(),
  taxonomy_family text not null default 'commerce_integrity',
  taxonomy_version text not null,
  source_module text not null,
  source_record_type text not null,
  source_record_id uuid not null,
  source_report_type text,
  source_report_id uuid,
  commerce_category_id text not null,
  primary_safety_reason_code text not null,
  secondary_safety_reason_codes text[] not null default '{}'::text[],
  context_modifiers text[] not null default '{}'::text[],
  policy_severity_code text,
  triage_severity_code text,
  record_state text not null default 'confirmed',
  classification_source text not null default 'human_review',
  basis_note text not null,
  classified_by uuid not null,
  classified_at timestamptz not null default now(),
  supersedes_classification_id uuid references public.commerce_integrity_classifications(id) on delete restrict,
  enforcement_decision_id uuid,
  trust_safety_case_id uuid,
  created_at timestamptz not null default now(),
  constraint commerce_integrity_classification_taxonomy_family_check check (
    taxonomy_family = 'commerce_integrity'
  ),
  constraint commerce_integrity_classification_category_fk
    foreign key (taxonomy_version, commerce_category_id)
    references public.commerce_integrity_taxonomy_categories(taxonomy_version, category_id)
    on delete restrict,
  constraint commerce_integrity_classification_source_module_fk
    foreign key (taxonomy_version, source_module)
    references public.commerce_integrity_source_module_registry(taxonomy_version, source_module)
    on delete restrict,
  constraint commerce_integrity_classification_source_record_type_length_check check (
    char_length(source_record_type) between 2 and 120
  ),
  constraint commerce_integrity_classification_report_pair_check check (
    (source_report_type is null and source_report_id is null)
    or (source_report_type is not null and source_report_id is not null)
  ),
  constraint commerce_integrity_classification_report_type_length_check check (
    source_report_type is null or char_length(source_report_type) between 2 and 120
  ),
  constraint commerce_integrity_classification_primary_reason_length_check check (
    char_length(primary_safety_reason_code) between 3 and 160
  ),
  constraint commerce_integrity_classification_secondary_reasons_check check (
    cardinality(secondary_safety_reason_codes) <= 20
    and public.commerce_integrity_text_array_is_unique(secondary_safety_reason_codes)
    and not (primary_safety_reason_code = any(secondary_safety_reason_codes))
  ),
  constraint commerce_integrity_classification_context_check check (
    public.commerce_integrity_context_modifiers_valid(context_modifiers)
  ),
  constraint commerce_integrity_classification_policy_severity_check check (
    policy_severity_code is null
    or policy_severity_code in (
      'POLICY.S0','POLICY.S1','POLICY.S2','POLICY.S3','POLICY.S4','POLICY.S5'
    )
  ),
  constraint commerce_integrity_classification_triage_severity_check check (
    triage_severity_code is null
    or triage_severity_code in (
      'TS.S1_CRITICAL','TS.S2_HIGH','TS.S3_ELEVATED','TS.S4_STANDARD'
    )
  ),
  constraint commerce_integrity_classification_triage_case_check check (
    triage_severity_code is null or trust_safety_case_id is not null
  ),
  constraint commerce_integrity_classification_severe_case_check check (
    record_state <> 'confirmed'
    or policy_severity_code not in ('POLICY.S4','POLICY.S5')
    or trust_safety_case_id is not null
  ),
  constraint commerce_integrity_classification_state_check check (
    record_state in ('proposed','confirmed','void')
  ),
  constraint commerce_integrity_classification_void_supersedes_check check (
    record_state <> 'void' or supersedes_classification_id is not null
  ),
  constraint commerce_integrity_classification_source_check check (
    classification_source in ('human_review','exact_legacy_mapping')
  ),
  constraint commerce_integrity_classification_exact_mapping_state_check check (
    classification_source <> 'exact_legacy_mapping' or record_state = 'confirmed'
  ),
  constraint commerce_integrity_classification_basis_length_check check (
    char_length(basis_note) between 5 and 6000
  ),
  constraint commerce_integrity_classification_self_supersession_check check (
    supersedes_classification_id is null or supersedes_classification_id <> id
  )
);

create unique index if not exists commerce_integrity_classification_one_successor_idx
  on public.commerce_integrity_classifications (supersedes_classification_id)
  where supersedes_classification_id is not null;

create index if not exists commerce_integrity_classification_source_history_idx
  on public.commerce_integrity_classifications (
    source_module,
    source_record_type,
    source_record_id,
    classified_at desc
  );

create index if not exists commerce_integrity_classification_category_recent_idx
  on public.commerce_integrity_classifications (
    taxonomy_version,
    commerce_category_id,
    classified_at desc
  );

create index if not exists commerce_integrity_classification_enforcement_idx
  on public.commerce_integrity_classifications (enforcement_decision_id)
  where enforcement_decision_id is not null;

create index if not exists commerce_integrity_classification_ts_case_idx
  on public.commerce_integrity_classifications (trust_safety_case_id)
  where trust_safety_case_id is not null;

create table if not exists public.commerce_integrity_classification_events (
  id bigint generated by default as identity primary key,
  classification_id uuid not null references public.commerce_integrity_classifications(id) on delete restrict,
  event_type text not null,
  actor_user_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint commerce_integrity_classification_events_type_check check (
    event_type in ('classification_created','classification_superseded','classification_voided')
  ),
  constraint commerce_integrity_classification_events_metadata_object_check check (
    jsonb_typeof(metadata) = 'object'
  ),
  constraint commerce_integrity_classification_events_metadata_size_check check (
    octet_length(metadata::text) <= 20000
  )
);

create index if not exists commerce_integrity_classification_events_history_idx
  on public.commerce_integrity_classification_events (
    classification_id,
    created_at asc,
    id asc
  );

create or replace function public.prevent_commerce_integrity_history_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Commerce-integrity classification history is append-only.'
    using errcode = '55000';
end;
$$;

drop trigger if exists prevent_commerce_integrity_classification_update_delete
  on public.commerce_integrity_classifications;
create trigger prevent_commerce_integrity_classification_update_delete
before update or delete on public.commerce_integrity_classifications
for each row execute function public.prevent_commerce_integrity_history_mutation();

drop trigger if exists prevent_commerce_integrity_event_update_delete
  on public.commerce_integrity_classification_events;
create trigger prevent_commerce_integrity_event_update_delete
before update or delete on public.commerce_integrity_classification_events
for each row execute function public.prevent_commerce_integrity_history_mutation();

create or replace function public.commerce_integrity_source_exists(
  p_source_module text,
  p_source_record_type text,
  p_source_record_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_source_record_id is null then
    return false;
  end if;

  case p_source_module
    when 'marketplace' then
      return p_source_record_type = 'marketplace_listing'
        and exists (
          select 1 from public.marketplace_listings row_data
          where row_data.id = p_source_record_id
        );
    when 'businesses' then
      return p_source_record_type = 'business'
        and exists (
          select 1 from public.businesses row_data
          where row_data.id = p_source_record_id
        );
    when 'services' then
      return p_source_record_type = 'provider_service'
        and exists (
          select 1 from public.provider_services row_data
          where row_data.id = p_source_record_id
        );
    when 'requests' then
      return p_source_record_type = 'service_request'
        and exists (
          select 1 from public.service_requests row_data
          where row_data.id = p_source_record_id
        );
    when 'jobs' then
      return p_source_record_type = 'job_posting'
        and exists (
          select 1 from public.job_postings row_data
          where row_data.id = p_source_record_id
        );
    when 'events' then
      return p_source_record_type = 'public_event'
        and exists (
          select 1 from public.public_events row_data
          where row_data.id = p_source_record_id
        );
    when 'appointments' then
      return p_source_record_type = 'appointment_request'
        and exists (
          select 1 from public.business_appointment_requests row_data
          where row_data.id = p_source_record_id
        );
    when 'rooms' then
      return p_source_record_type = 'room'
        and exists (
          select 1 from public.rooms row_data
          where row_data.id = p_source_record_id
        );
    when 'messages' then
      if p_source_record_type = 'private_message' then
        return exists (
          select 1 from public.private_messages row_data
          where row_data.id = p_source_record_id
        );
      elsif p_source_record_type = 'private_conversation' then
        return exists (
          select 1 from public.private_conversations row_data
          where row_data.id = p_source_record_id
        );
      end if;
      return false;
    when 'local' then
      return false;
    else
      return false;
  end case;
end;
$$;

create or replace function public.commerce_integrity_message_report_matches_source(
  p_report_id uuid,
  p_source_record_type text,
  p_source_record_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  raw_metadata text;
  parsed_metadata jsonb;
begin
  select report_row.resolution_note
  into raw_metadata
  from public.reports report_row
  where report_row.id = p_report_id;

  if not found or raw_metadata is null then
    return false;
  end if;

  begin
    parsed_metadata := raw_metadata::jsonb;
  exception when others then
    return false;
  end;

  if parsed_metadata ->> 'type' not in ('private_message','private_conversation') then
    return false;
  end if;

  if p_source_record_type = 'private_message' then
    return parsed_metadata ->> 'message_id' = p_source_record_id::text;
  elsif p_source_record_type = 'private_conversation' then
    return parsed_metadata ->> 'conversation_id' = p_source_record_id::text;
  end if;

  return false;
end;
$$;

create or replace function public.commerce_integrity_report_matches_source(
  p_source_module text,
  p_source_record_type text,
  p_source_record_id uuid,
  p_source_report_type text,
  p_source_report_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_source_report_type is null and p_source_report_id is null then
    return true;
  end if;

  if p_source_report_type is null or p_source_report_id is null then
    return false;
  end if;

  case p_source_module
    when 'marketplace' then
      return p_source_report_type = 'marketplace_report'
        and exists (
          select 1 from public.marketplace_reports report_row
          where report_row.id = p_source_report_id
            and report_row.listing_id = p_source_record_id
        );
    when 'businesses' then
      return p_source_report_type = 'business_report'
        and exists (
          select 1 from public.business_reports report_row
          where report_row.id = p_source_report_id
            and report_row.business_id = p_source_record_id
        );
    when 'services' then
      return p_source_report_type = 'service_report'
        and exists (
          select 1 from public.provider_service_reports report_row
          where report_row.id = p_source_report_id
            and report_row.service_id = p_source_record_id
        );
    when 'requests' then
      return p_source_report_type = 'request_report'
        and exists (
          select 1 from public.service_request_reports report_row
          where report_row.id = p_source_report_id
            and report_row.request_id = p_source_record_id
        );
    when 'jobs' then
      return p_source_report_type = 'job_report'
        and exists (
          select 1 from public.job_reports report_row
          where report_row.id = p_source_report_id
            and report_row.job_id = p_source_record_id
        );
    when 'events' then
      return p_source_report_type = 'event_report'
        and exists (
          select 1 from public.public_event_reports report_row
          where report_row.id = p_source_report_id
            and report_row.event_id = p_source_record_id
        );
    when 'rooms' then
      return p_source_report_type = 'room_report'
        and exists (
          select 1 from public.room_moderation_reports report_row
          where report_row.id = p_source_report_id
            and report_row.room_id = p_source_record_id
        );
    when 'messages' then
      return p_source_report_type = 'general_report'
        and public.commerce_integrity_message_report_matches_source(
          p_source_report_id,
          p_source_record_type,
          p_source_record_id
        );
    else
      return false;
  end case;
end;
$$;

create or replace function public.commerce_integrity_classification_hold_applies(
  p_classification_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_classification_id is null then false
    else exists (
      select 1
      from public.legal_preservation_holds hold_row
      join public.legal_preservation_hold_targets target_row
        on target_row.hold_id = hold_row.id
      where hold_row.status = 'active'
        and (hold_row.starts_at is null or hold_row.starts_at <= now())
        and (hold_row.expires_at is null or hold_row.expires_at > now())
        and target_row.target_type = 'other'
        and target_row.resource_key = 'commerce_integrity_classifications'
        and target_row.target_ref = p_classification_id::text
    )
  end;
$$;

create or replace function public.create_commerce_integrity_classification(
  p_actor_user_id uuid,
  p_taxonomy_version text,
  p_source_module text,
  p_source_record_type text,
  p_source_record_id uuid,
  p_commerce_category_id text,
  p_primary_safety_reason_code text,
  p_basis_note text,
  p_secondary_safety_reason_codes text[] default '{}'::text[],
  p_context_modifiers text[] default '{}'::text[],
  p_policy_severity_code text default null,
  p_triage_severity_code text default null,
  p_record_state text default 'confirmed',
  p_classification_source text default 'human_review',
  p_source_report_type text default null,
  p_source_report_id uuid default null,
  p_supersedes_classification_id uuid default null,
  p_enforcement_decision_id uuid default null,
  p_trust_safety_case_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_is_admin boolean := false;
  version_is_active boolean := false;
  source_registry public.commerce_integrity_source_module_registry%rowtype;
  category_registry public.commerce_integrity_taxonomy_categories%rowtype;
  head_ids uuid[];
  head_count integer := 0;
  new_classification_id uuid;
  secondary_reason text;
  expected_report_type_allowed boolean := true;
begin
  select coalesce(profile.is_admin, false)
  into actor_is_admin
  from public.profiles profile
  where profile.id = p_actor_user_id;

  if not actor_is_admin then
    raise exception 'Administrator authorization is required for commerce-integrity classification.'
      using errcode = '42501';
  end if;

  select version_row.active_for_new_classification
  into version_is_active
  from public.commerce_integrity_taxonomy_versions version_row
  where version_row.taxonomy_version = p_taxonomy_version
    and version_row.taxonomy_family = 'commerce_integrity';

  if not found or not version_is_active then
    raise exception 'Unknown or inactive commerce-integrity taxonomy version.'
      using errcode = '22023';
  end if;

  select *
  into source_registry
  from public.commerce_integrity_source_module_registry source_row
  where source_row.taxonomy_version = p_taxonomy_version
    and source_row.source_module = p_source_module;

  if not found then
    raise exception 'Unsupported commerce-integrity source module.'
      using errcode = '22023';
  end if;

  if not source_registry.classification_write_enabled then
    raise exception 'Commerce-integrity classification writes are not enabled for this source module in Phase C.'
      using errcode = '42501';
  end if;

  if not (p_source_record_type = any(source_registry.allowed_record_types)) then
    raise exception 'Unsupported source record type for this commerce-integrity module.'
      using errcode = '22023';
  end if;

  if p_source_report_type is not null then
    expected_report_type_allowed := p_source_report_type = any(source_registry.allowed_report_types);
  end if;

  if not expected_report_type_allowed then
    raise exception 'Unsupported source report type for this commerce-integrity module.'
      using errcode = '22023';
  end if;

  select *
  into category_registry
  from public.commerce_integrity_taxonomy_categories category_row
  where category_row.taxonomy_version = p_taxonomy_version
    and category_row.category_id = p_commerce_category_id;

  if not found then
    raise exception 'Unknown commerce-integrity category.'
      using errcode = '22023';
  end if;

  if not (
    p_source_module = any(category_registry.primary_modules)
    or p_source_module = any(category_registry.secondary_modules)
  ) then
    raise exception 'This commerce-integrity category is not applicable to the selected source module.'
      using errcode = '22023';
  end if;

  if not (p_primary_safety_reason_code = any(category_registry.safety_reason_codes)) then
    raise exception 'Primary safety reason is incompatible with the selected commerce category.'
      using errcode = '22023';
  end if;

  if not public.commerce_integrity_text_array_is_unique(p_secondary_safety_reason_codes)
     or cardinality(coalesce(p_secondary_safety_reason_codes, '{}'::text[])) > 20
  then
    raise exception 'Secondary safety reasons must be unique, non-empty canonical values.'
      using errcode = '22023';
  end if;

  if p_primary_safety_reason_code = any(coalesce(p_secondary_safety_reason_codes, '{}'::text[])) then
    raise exception 'Primary safety reason must not be repeated as a secondary reason.'
      using errcode = '22023';
  end if;

  foreach secondary_reason in array coalesce(p_secondary_safety_reason_codes, '{}'::text[])
  loop
    if not (secondary_reason = any(category_registry.safety_reason_codes)) then
      raise exception 'Secondary safety reason is incompatible with the selected commerce category.'
        using errcode = '22023';
    end if;
  end loop;

  if not public.commerce_integrity_context_modifiers_valid(p_context_modifiers) then
    raise exception 'Invalid commerce-integrity context modifier set.'
      using errcode = '22023';
  end if;

  if p_policy_severity_code is not null
     and p_policy_severity_code not in (
       'POLICY.S0','POLICY.S1','POLICY.S2','POLICY.S3','POLICY.S4','POLICY.S5'
     )
  then
    raise exception 'Policy severity must use the POLICY.S0 through POLICY.S5 namespace.'
      using errcode = '22023';
  end if;

  if p_triage_severity_code is not null
     and p_triage_severity_code not in (
       'TS.S1_CRITICAL','TS.S2_HIGH','TS.S3_ELEVATED','TS.S4_STANDARD'
     )
  then
    raise exception 'Trust and Safety triage severity must use the TS namespace.'
      using errcode = '22023';
  end if;

  if p_record_state not in ('proposed','confirmed','void') then
    raise exception 'Invalid commerce-integrity classification state.'
      using errcode = '22023';
  end if;

  if p_classification_source not in ('human_review','exact_legacy_mapping') then
    raise exception 'Unsupported commerce-integrity classification source.'
      using errcode = '22023';
  end if;

  if p_classification_source = 'exact_legacy_mapping' and p_record_state <> 'confirmed' then
    raise exception 'Exact legacy mapping may create only a confirmed classification.'
      using errcode = '22023';
  end if;

  if char_length(btrim(coalesce(p_basis_note, ''))) < 5 then
    raise exception 'A minimum classification basis note is required.'
      using errcode = '22023';
  end if;

  if p_source_report_type is null and p_source_report_id is not null
     or p_source_report_type is not null and p_source_report_id is null
  then
    raise exception 'Source report type and source report id must be supplied together.'
      using errcode = '22023';
  end if;

  if not public.commerce_integrity_source_exists(
    p_source_module,
    p_source_record_type,
    p_source_record_id
  ) then
    raise exception 'Commerce-integrity source record was not found or does not match the declared source type.'
      using errcode = 'P0002';
  end if;

  if not public.commerce_integrity_report_matches_source(
    p_source_module,
    p_source_record_type,
    p_source_record_id,
    p_source_report_type,
    p_source_report_id
  ) then
    raise exception 'Source report was not found or does not belong to the declared source record.'
      using errcode = '22023';
  end if;

  if p_enforcement_decision_id is not null
     and not exists (
       select 1
       from public.enforcement_decisions decision_row
       where decision_row.id = p_enforcement_decision_id
     )
  then
    raise exception 'Related enforcement decision was not found.'
      using errcode = 'P0002';
  end if;

  if p_trust_safety_case_id is not null
     and not exists (
       select 1
       from public.trust_safety_cases case_row
       where case_row.id = p_trust_safety_case_id
     )
  then
    raise exception 'Related Trust and Safety case was not found.'
      using errcode = 'P0002';
  end if;

  if p_triage_severity_code is not null and p_trust_safety_case_id is null then
    raise exception 'Trust and Safety triage severity requires an existing Trust and Safety case link.'
      using errcode = '22023';
  end if;

  if p_record_state = 'confirmed'
     and p_policy_severity_code in ('POLICY.S4','POLICY.S5')
     and p_trust_safety_case_id is null
  then
    raise exception 'Confirmed severe or critical policy classification requires a linked Trust and Safety case.'
      using errcode = '22023';
  end if;

  if p_record_state = 'void' and p_supersedes_classification_id is null then
    raise exception 'A void classification must supersede the current classification.'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'commerce_integrity|' || p_source_module || '|' || p_source_record_type || '|' || p_source_record_id::text,
      0
    )
  );

  select array_agg(head_row.id order by head_row.classified_at asc, head_row.id asc)
  into head_ids
  from public.commerce_integrity_classifications head_row
  where head_row.taxonomy_family = 'commerce_integrity'
    and head_row.source_module = p_source_module
    and head_row.source_record_type = p_source_record_type
    and head_row.source_record_id = p_source_record_id
    and not exists (
      select 1
      from public.commerce_integrity_classifications successor_row
      where successor_row.supersedes_classification_id = head_row.id
    );

  head_count := coalesce(cardinality(head_ids), 0);

  if p_supersedes_classification_id is null then
    if head_count <> 0 then
      raise exception 'A current commerce-integrity classification already exists. Supersede the current classification instead of creating a parallel head.'
        using errcode = '23505';
    end if;
  else
    if head_count <> 1 or head_ids[1] is distinct from p_supersedes_classification_id then
      raise exception 'Supersession target is not the single current classification for this source record.'
        using errcode = '40001';
    end if;
  end if;

  insert into public.commerce_integrity_classifications (
    taxonomy_family,
    taxonomy_version,
    source_module,
    source_record_type,
    source_record_id,
    source_report_type,
    source_report_id,
    commerce_category_id,
    primary_safety_reason_code,
    secondary_safety_reason_codes,
    context_modifiers,
    policy_severity_code,
    triage_severity_code,
    record_state,
    classification_source,
    basis_note,
    classified_by,
    classified_at,
    supersedes_classification_id,
    enforcement_decision_id,
    trust_safety_case_id
  )
  values (
    'commerce_integrity',
    p_taxonomy_version,
    p_source_module,
    p_source_record_type,
    p_source_record_id,
    p_source_report_type,
    p_source_report_id,
    p_commerce_category_id,
    p_primary_safety_reason_code,
    coalesce(p_secondary_safety_reason_codes, '{}'::text[]),
    coalesce(p_context_modifiers, '{}'::text[]),
    p_policy_severity_code,
    p_triage_severity_code,
    p_record_state,
    p_classification_source,
    btrim(p_basis_note),
    p_actor_user_id,
    now(),
    p_supersedes_classification_id,
    p_enforcement_decision_id,
    p_trust_safety_case_id
  )
  returning id into new_classification_id;

  insert into public.commerce_integrity_classification_events (
    classification_id,
    event_type,
    actor_user_id,
    metadata
  )
  values (
    new_classification_id,
    case when p_record_state = 'void' then 'classification_voided' else 'classification_created' end,
    p_actor_user_id,
    jsonb_build_object(
      'taxonomy_version', p_taxonomy_version,
      'category_id', p_commerce_category_id,
      'record_state', p_record_state,
      'supersedes_classification_id', p_supersedes_classification_id,
      'source_module', p_source_module,
      'source_record_type', p_source_record_type,
      'source_record_id', p_source_record_id
    )
  );

  if p_supersedes_classification_id is not null then
    insert into public.commerce_integrity_classification_events (
      classification_id,
      event_type,
      actor_user_id,
      metadata
    )
    values (
      p_supersedes_classification_id,
      'classification_superseded',
      p_actor_user_id,
      jsonb_build_object(
        'successor_classification_id', new_classification_id,
        'successor_taxonomy_version', p_taxonomy_version,
        'successor_category_id', p_commerce_category_id,
        'successor_record_state', p_record_state
      )
    );
  end if;

  return new_classification_id;
end;
$$;

comment on table public.commerce_integrity_taxonomy_versions is
'Issue #670 migration-managed taxonomy version registry. It contains no member data and does not authorize public policy publication.';

comment on table public.commerce_integrity_source_module_registry is
'Issue #670 source-module contract. Restricted and inherited-only sources remain write-disabled until a later reviewed workflow preserves their authorization boundaries.';

comment on table public.commerce_integrity_taxonomy_categories is
'Database mirror of the versioned Issue #670 application taxonomy used only for fail-closed classification validation.';

comment on table public.commerce_integrity_classifications is
'Append-only Issue #670 reviewer classification history. Source/report identifiers are non-cascading references validated at creation time; raw report text, private message bodies, and protected evidence do not belong in this table.';

comment on column public.commerce_integrity_classifications.policy_severity_code is
'Canonical policy severity using the POLICY.S0 through POLICY.S5 namespace. It is distinct from Trust and Safety operational triage.';

comment on column public.commerce_integrity_classifications.triage_severity_code is
'Optional Issue #667 operational triage severity using the TS namespace. It requires a linked Trust and Safety case and does not replace policy severity.';

comment on column public.commerce_integrity_classifications.supersedes_classification_id is
'Material corrections are recorded as a new row that supersedes the current row. Existing history is not updated in place.';

comment on table public.commerce_integrity_classification_events is
'Append-only Issue #670 classification history events. These events do not create moderation, enforcement, legal, notice, or external-reporting side effects.';

alter table public.commerce_integrity_taxonomy_versions enable row level security;
alter table public.commerce_integrity_source_module_registry enable row level security;
alter table public.commerce_integrity_taxonomy_categories enable row level security;
alter table public.commerce_integrity_classifications enable row level security;
alter table public.commerce_integrity_classification_events enable row level security;

revoke all on table public.commerce_integrity_taxonomy_versions
  from public, anon, authenticated, service_role;
revoke all on table public.commerce_integrity_source_module_registry
  from public, anon, authenticated, service_role;
revoke all on table public.commerce_integrity_taxonomy_categories
  from public, anon, authenticated, service_role;
revoke all on table public.commerce_integrity_classifications
  from public, anon, authenticated, service_role;
revoke all on table public.commerce_integrity_classification_events
  from public, anon, authenticated, service_role;

grant select on table public.commerce_integrity_taxonomy_versions to service_role;
grant select on table public.commerce_integrity_source_module_registry to service_role;
grant select on table public.commerce_integrity_taxonomy_categories to service_role;
grant select on table public.commerce_integrity_classifications to service_role;
grant select on table public.commerce_integrity_classification_events to service_role;

revoke all on function public.commerce_integrity_text_array_is_unique(text[]) from public, anon, authenticated;
revoke all on function public.commerce_integrity_text_arrays_disjoint(text[], text[]) from public, anon, authenticated;
revoke all on function public.commerce_integrity_context_modifiers_valid(text[]) from public, anon, authenticated;
revoke all on function public.prevent_commerce_integrity_history_mutation() from public, anon, authenticated;
revoke all on function public.commerce_integrity_source_exists(text, text, uuid) from public, anon, authenticated;
revoke all on function public.commerce_integrity_message_report_matches_source(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.commerce_integrity_report_matches_source(text, text, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.commerce_integrity_classification_hold_applies(uuid) from public, anon, authenticated;
revoke all on function public.create_commerce_integrity_classification(
  uuid, text, text, text, uuid, text, text, text,
  text[], text[], text, text, text, text, text, uuid, uuid, uuid, uuid
) from public, anon, authenticated;

grant execute on function public.commerce_integrity_source_exists(text, text, uuid) to service_role;
grant execute on function public.commerce_integrity_message_report_matches_source(uuid, text, uuid) to service_role;
grant execute on function public.commerce_integrity_report_matches_source(text, text, uuid, text, uuid) to service_role;
grant execute on function public.commerce_integrity_classification_hold_applies(uuid) to service_role;
grant execute on function public.create_commerce_integrity_classification(
  uuid, text, text, text, uuid, text, text, text,
  text[], text[], text, text, text, text, text, uuid, uuid, uuid, uuid
) to service_role;

-- No DELETE, UPDATE, or direct INSERT privilege is granted to service_role on the
-- classification or event tables. New rows can be created only through the guarded
-- service-role function above; material corrections use append-only supersession.
--
-- Phase C intentionally creates no classification rows and no classification events.
-- It also creates no source-record deletion/disposition path. Before any future
-- classification disposition is implemented, Issue #668 resource/disposition rules
-- and the exact Issue #674 hold interaction must be separately reviewed and tested.

notify pgrst, 'reload schema';

commit;
