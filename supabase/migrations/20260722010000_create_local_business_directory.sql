-- Local Business and Services Directory core data, ownership, verification, and moderation.

begin;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  slug text not null unique,
  name text not null,
  description text not null default '',
  category text not null,
  phone text,
  contact_email text,
  website_url text,
  booking_url text,
  logo_url text,
  cover_image_url text,
  address_line_1 text,
  address_line_2 text,
  city text,
  region text,
  postal_code text,
  country_code text not null default 'US',
  service_area_mode text not null default 'storefront',
  service_radius_miles integer,
  service_areas text[] not null default '{}'::text[],
  show_exact_address boolean not null default false,
  verification_status text not null default 'unverified',
  status text not null default 'pending',
  moderation_reason text,
  claimed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint businesses_slug_length_check
    check (char_length(slug) between 1 and 100),
  constraint businesses_name_length_check
    check (char_length(name) between 1 and 200),
  constraint businesses_description_length_check
    check (char_length(description) <= 5000),
  constraint businesses_category_length_check
    check (char_length(category) between 1 and 100),
  constraint businesses_country_code_check
    check (char_length(country_code) = 2),
  constraint businesses_service_area_mode_check
    check (service_area_mode in ('storefront', 'mobile', 'online', 'hybrid')),
  constraint businesses_service_radius_check
    check (
      service_radius_miles is null
      or service_radius_miles between 1 and 1000
    ),
  constraint businesses_verification_status_check
    check (verification_status in ('unverified', 'pending', 'verified', 'denied')),
  constraint businesses_status_check
    check (status in ('draft', 'pending', 'published', 'rejected', 'suspended'))
);

create table if not exists public.business_services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  name text not null,
  description text not null default '',
  category text,
  price_text text,
  booking_url text,
  service_area text,
  status text not null default 'active',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_services_name_length_check
    check (char_length(name) between 1 and 160),
  constraint business_services_description_length_check
    check (char_length(description) <= 3000),
  constraint business_services_status_check
    check (status in ('active', 'paused', 'archived')),
  constraint business_services_sort_order_check
    check (sort_order between 0 and 1000)
);

create table if not exists public.business_claims (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  claimant_id uuid not null references auth.users(id) on delete cascade,
  contact_email text not null,
  evidence text not null,
  status text not null default 'pending',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_claims_email_length_check
    check (char_length(contact_email) between 3 and 254),
  constraint business_claims_evidence_length_check
    check (char_length(evidence) between 20 and 5000),
  constraint business_claims_status_check
    check (status in ('pending', 'approved', 'rejected'))
);

create table if not exists public.business_reports (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  details text not null,
  status text not null default 'open',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_reports_reason_length_check
    check (char_length(reason) between 1 and 120),
  constraint business_reports_details_length_check
    check (char_length(details) between 10 and 3000),
  constraint business_reports_status_check
    check (status in ('open', 'resolved', 'dismissed'))
);

create index if not exists businesses_public_directory_idx
  on public.businesses (status, verification_status, published_at desc);

create index if not exists businesses_owner_updated_idx
  on public.businesses (owner_id, updated_at desc)
  where owner_id is not null;

create index if not exists businesses_location_idx
  on public.businesses (city, region, category);

create index if not exists business_services_business_sort_idx
  on public.business_services (business_id, status, sort_order);

create index if not exists business_claims_review_idx
  on public.business_claims (status, created_at);

create unique index if not exists business_claims_one_pending_per_claimant_idx
  on public.business_claims (business_id, claimant_id)
  where status = 'pending';

create index if not exists business_reports_review_idx
  on public.business_reports (status, created_at);

create index if not exists business_reports_reporter_rate_idx
  on public.business_reports (reporter_id, created_at desc);

create or replace function public.touch_business_directory_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_businesses_updated_at on public.businesses;
create trigger touch_businesses_updated_at
before update on public.businesses
for each row execute function public.touch_business_directory_updated_at();

drop trigger if exists touch_business_services_updated_at on public.business_services;
create trigger touch_business_services_updated_at
before update on public.business_services
for each row execute function public.touch_business_directory_updated_at();

drop trigger if exists touch_business_claims_updated_at on public.business_claims;
create trigger touch_business_claims_updated_at
before update on public.business_claims
for each row execute function public.touch_business_directory_updated_at();

drop trigger if exists touch_business_reports_updated_at on public.business_reports;
create trigger touch_business_reports_updated_at
before update on public.business_reports
for each row execute function public.touch_business_directory_updated_at();

create or replace function public.review_local_business_claim(
  target_claim_id uuid,
  reviewer_user_id uuid,
  approve_claim boolean,
  review_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  claim_row public.business_claims%rowtype;
  reviewer_is_admin boolean := false;
begin
  select coalesce(profile.is_admin, false)
  into reviewer_is_admin
  from public.profiles profile
  where profile.id = reviewer_user_id;

  if not reviewer_is_admin then
    raise exception 'Administrator access is required.';
  end if;

  select *
  into claim_row
  from public.business_claims claim
  where claim.id = target_claim_id
  for update;

  if claim_row.id is null then
    raise exception 'Business claim not found.';
  end if;

  if claim_row.status <> 'pending' then
    raise exception 'Business claim has already been reviewed.';
  end if;

  update public.business_claims
  set
    status = case when approve_claim then 'approved' else 'rejected' end,
    reviewed_by = reviewer_user_id,
    reviewed_at = now(),
    decision_note = nullif(left(coalesce(review_note, ''), 2000), '')
  where id = claim_row.id;

  if approve_claim then
    update public.businesses
    set
      owner_id = claim_row.claimant_id,
      claimed_at = now(),
      moderation_reason = null
    where id = claim_row.business_id;

    update public.business_claims
    set
      status = 'rejected',
      reviewed_by = reviewer_user_id,
      reviewed_at = now(),
      decision_note = 'Another ownership claim was approved.'
    where business_id = claim_row.business_id
      and id <> claim_row.id
      and status = 'pending';
  end if;

  return jsonb_build_object(
    'updated', true,
    'approved', approve_claim,
    'businessId', claim_row.business_id,
    'claimantId', claim_row.claimant_id
  );
end;
$$;

create or replace function public.replace_local_business_services(
  target_business_id uuid,
  actor_user_id uuid,
  services_payload jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  business_owner_id uuid;
  actor_is_admin boolean := false;
  service_item jsonb;
  service_position integer := 0;
  service_status text;
  service_sort_order integer;
begin
  if jsonb_typeof(coalesce(services_payload, '[]'::jsonb)) <> 'array' then
    raise exception 'Services payload must be an array.';
  end if;

  if jsonb_array_length(coalesce(services_payload, '[]'::jsonb)) > 20 then
    raise exception 'A business may publish at most 20 services.';
  end if;

  select business.owner_id
  into business_owner_id
  from public.businesses business
  where business.id = target_business_id
  for update;

  if not found then
    raise exception 'Business not found.';
  end if;

  select coalesce(profile.is_admin, false)
  into actor_is_admin
  from public.profiles profile
  where profile.id = actor_user_id;

  if not actor_is_admin
    and business_owner_id is distinct from actor_user_id
  then
    raise exception 'Business control is required.';
  end if;

  delete from public.business_services
  where business_id = target_business_id;

  for service_item in
    select value
    from jsonb_array_elements(coalesce(services_payload, '[]'::jsonb))
  loop
    if char_length(trim(coalesce(service_item ->> 'name', ''))) < 2 then
      raise exception 'Each service requires a name.';
    end if;

    service_status := lower(coalesce(nullif(trim(service_item ->> 'status'), ''), 'active'));
    if service_status not in ('active', 'paused', 'archived') then
      service_status := 'active';
    end if;

    service_sort_order := case
      when coalesce(service_item ->> 'sort_order', '') ~ '^[0-9]+$'
        then least(greatest((service_item ->> 'sort_order')::integer, 0), 1000)
      else service_position
    end;

    insert into public.business_services (
      business_id,
      created_by,
      name,
      description,
      category,
      price_text,
      booking_url,
      service_area,
      status,
      sort_order
    )
    values (
      target_business_id,
      actor_user_id,
      left(trim(service_item ->> 'name'), 160),
      left(coalesce(service_item ->> 'description', ''), 3000),
      nullif(left(trim(coalesce(service_item ->> 'category', '')), 100), ''),
      nullif(left(trim(coalesce(service_item ->> 'price_text', '')), 120), ''),
      nullif(left(trim(coalesce(service_item ->> 'booking_url', '')), 2000), ''),
      nullif(left(trim(coalesce(service_item ->> 'service_area', '')), 300), ''),
      service_status,
      service_sort_order
    );

    service_position := service_position + 1;
  end loop;
end;
$$;

alter table public.businesses enable row level security;
alter table public.business_services enable row level security;
alter table public.business_claims enable row level security;
alter table public.business_reports enable row level security;

revoke all on table public.businesses
  from public, anon, authenticated;
revoke all on table public.business_services
  from public, anon, authenticated;
revoke all on table public.business_claims
  from public, anon, authenticated;
revoke all on table public.business_reports
  from public, anon, authenticated;

revoke all on function public.touch_business_directory_updated_at()
  from public, anon, authenticated;
revoke all on function public.replace_local_business_services(uuid, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.review_local_business_claim(uuid, uuid, boolean, text)
  from public, anon, authenticated;

grant execute on function public.replace_local_business_services(uuid, uuid, jsonb)
  to service_role;
grant execute on function public.review_local_business_claim(uuid, uuid, boolean, text)
  to service_role;

notify pgrst, 'reload schema';

commit;
