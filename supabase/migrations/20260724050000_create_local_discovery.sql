-- Loombus Local Discovery: standardized public location fields, privacy-safe
-- location anchors, business inheritance, and unified distance-aware search.

begin;

create extension if not exists pgcrypto with schema extensions;

alter table public.loombus_search_documents
  add column if not exists local_city text,
  add column if not exists local_region text,
  add column if not exists local_postal_code text,
  add column if not exists local_country_code text,
  add column if not exists local_mode text,
  add column if not exists local_location_text text,
  add column if not exists local_business_id uuid,
  add column if not exists local_remote_available boolean not null default false,
  add column if not exists local_remote_only boolean not null default false,
  add column if not exists local_starts_at timestamptz,
  add column if not exists local_ends_at timestamptz,
  add column if not exists local_price_text text,
  add column if not exists local_attribution text,
  add column if not exists local_image_url text;

create index if not exists loombus_search_documents_local_source_idx
  on public.loombus_search_documents (source_table, status, source_updated_at desc);
create index if not exists loombus_search_documents_local_place_idx
  on public.loombus_search_documents (
    local_country_code,
    local_region,
    local_city,
    local_postal_code
  );
create index if not exists loombus_search_documents_local_business_idx
  on public.loombus_search_documents (local_business_id)
  where local_business_id is not null;
create index if not exists loombus_search_documents_local_event_time_idx
  on public.loombus_search_documents (local_starts_at)
  where source_table = 'public_events';

create table if not exists public.loombus_local_locations (
  id uuid primary key default gen_random_uuid(),
  source_table text not null,
  entity_id uuid not null,
  owner_id uuid references public.profiles(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  location_precision text not null default 'approximate',
  city text,
  region text,
  postal_code text,
  country_code text not null default 'US',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint loombus_local_locations_source_check check (
    source_table in (
      'businesses',
      'job_postings',
      'marketplace_listings',
      'public_events',
      'service_requests',
      'provider_services'
    )
  ),
  constraint loombus_local_locations_latitude_check
    check (latitude between -90 and 90),
  constraint loombus_local_locations_longitude_check
    check (longitude between -180 and 180),
  constraint loombus_local_locations_precision_check
    check (location_precision in ('approximate', 'city', 'postal', 'exact')),
  constraint loombus_local_locations_country_check
    check (country_code ~ '^[A-Z]{2}$'),
  constraint loombus_local_locations_unique unique (source_table, entity_id)
);

create index if not exists loombus_local_locations_owner_updated_idx
  on public.loombus_local_locations (owner_id, updated_at desc)
  where owner_id is not null;
create index if not exists loombus_local_locations_created_by_idx
  on public.loombus_local_locations (created_by, updated_at desc);
create index if not exists loombus_local_locations_coordinate_idx
  on public.loombus_local_locations (latitude, longitude);

create or replace function public.touch_loombus_local_location()
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

drop trigger if exists touch_loombus_local_location_trigger
  on public.loombus_local_locations;
create trigger touch_loombus_local_location_trigger
before update on public.loombus_local_locations
for each row execute function public.touch_loombus_local_location();

create or replace function public.loombus_distance_miles(
  first_latitude double precision,
  first_longitude double precision,
  second_latitude double precision,
  second_longitude double precision
)
returns double precision
language sql
immutable
strict
parallel safe
as $$
  select 3958.7613 * 2 * asin(
    sqrt(
      least(
        1.0,
        power(sin(radians((second_latitude - first_latitude) / 2)), 2)
        + cos(radians(first_latitude))
          * cos(radians(second_latitude))
          * power(sin(radians((second_longitude - first_longitude) / 2)), 2)
      )
    )
  );
$$;

create or replace function public.resolve_loombus_local_source(
  target_source_table text,
  target_entity_id uuid
)
returns table (
  source_found boolean,
  source_owner_id uuid,
  source_business_id uuid,
  source_city text,
  source_region text,
  source_postal_code text,
  source_country_code text,
  exact_location_allowed boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  source_found := false;
  source_owner_id := null;
  source_business_id := null;
  source_city := null;
  source_region := null;
  source_postal_code := null;
  source_country_code := 'US';
  exact_location_allowed := false;

  case target_source_table
    when 'businesses' then
      select
        true,
        business.owner_id,
        business.id,
        business.city,
        business.region,
        business.postal_code,
        business.country_code,
        business.show_exact_address
      into
        source_found,
        source_owner_id,
        source_business_id,
        source_city,
        source_region,
        source_postal_code,
        source_country_code,
        exact_location_allowed
      from public.businesses business
      where business.id = target_entity_id;

    when 'job_postings' then
      select
        true,
        business.owner_id,
        job.business_id,
        job.city,
        job.region,
        job.postal_code,
        job.country_code,
        false
      into
        source_found,
        source_owner_id,
        source_business_id,
        source_city,
        source_region,
        source_postal_code,
        source_country_code,
        exact_location_allowed
      from public.job_postings job
      join public.businesses business on business.id = job.business_id
      where job.id = target_entity_id;

    when 'marketplace_listings' then
      select
        true,
        listing.seller_id,
        listing.business_id,
        listing.city,
        listing.region,
        listing.postal_code,
        listing.country_code,
        false
      into
        source_found,
        source_owner_id,
        source_business_id,
        source_city,
        source_region,
        source_postal_code,
        source_country_code,
        exact_location_allowed
      from public.marketplace_listings listing
      where listing.id = target_entity_id;

    when 'public_events' then
      select
        true,
        event.organizer_id,
        event.business_id,
        event.city,
        event.region,
        event.postal_code,
        event.country_code,
        true
      into
        source_found,
        source_owner_id,
        source_business_id,
        source_city,
        source_region,
        source_postal_code,
        source_country_code,
        exact_location_allowed
      from public.public_events event
      where event.id = target_entity_id;

    when 'service_requests' then
      select
        true,
        request.requester_id,
        request.business_id,
        request.city,
        request.region,
        request.postal_code,
        request.country_code,
        false
      into
        source_found,
        source_owner_id,
        source_business_id,
        source_city,
        source_region,
        source_postal_code,
        source_country_code,
        exact_location_allowed
      from public.service_requests request
      where request.id = target_entity_id;

    when 'provider_services' then
      select
        true,
        service.provider_id,
        service.business_id,
        service.city,
        service.region,
        service.postal_code,
        service.country_code,
        false
      into
        source_found,
        source_owner_id,
        source_business_id,
        source_city,
        source_region,
        source_postal_code,
        source_country_code,
        exact_location_allowed
      from public.provider_services service
      where service.id = target_entity_id;

    else
      source_found := false;
  end case;

  return next;
end;
$$;

create or replace function public.set_loombus_local_location(
  target_source_table text,
  target_entity_id uuid,
  target_user_id uuid,
  target_latitude double precision,
  target_longitude double precision,
  target_precision text default 'approximate',
  target_city text default null,
  target_region text default null,
  target_postal_code text default null,
  target_country_code text default 'US'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  source_record record;
  user_is_admin boolean := false;
  clean_precision text := 'approximate';
  clean_latitude double precision;
  clean_longitude double precision;
  clean_country text;
  effective_owner uuid;
begin
  if target_latitude is null
    or target_longitude is null
    or target_latitude not between -90 and 90
    or target_longitude not between -180 and 180 then
    raise exception 'LOCAL_LOCATION_INVALID';
  end if;

  select coalesce(profile.is_admin, false)
  into user_is_admin
  from public.profiles profile
  where profile.id = target_user_id;

  select *
  into source_record
  from public.resolve_loombus_local_source(
    target_source_table,
    target_entity_id
  );

  if not coalesce(source_record.source_found, false) then
    raise exception 'LOCAL_LOCATION_NOT_FOUND';
  end if;

  if not user_is_admin
    and source_record.source_owner_id is distinct from target_user_id then
    raise exception 'LOCAL_LOCATION_FORBIDDEN';
  end if;

  if target_precision = 'exact'
    and coalesce(source_record.exact_location_allowed, false) then
    clean_precision := 'exact';
    clean_latitude := round(target_latitude::numeric, 6)::double precision;
    clean_longitude := round(target_longitude::numeric, 6)::double precision;
  else
    clean_precision := 'approximate';
    clean_latitude := round(target_latitude::numeric, 2)::double precision;
    clean_longitude := round(target_longitude::numeric, 2)::double precision;
  end if;

  clean_country := upper(left(coalesce(nullif(trim(target_country_code), ''), source_record.source_country_code, 'US'), 2));
  if clean_country !~ '^[A-Z]{2}$' then
    clean_country := 'US';
  end if;
  effective_owner := coalesce(source_record.source_owner_id, target_user_id);

  insert into public.loombus_local_locations (
    source_table,
    entity_id,
    owner_id,
    created_by,
    latitude,
    longitude,
    location_precision,
    city,
    region,
    postal_code,
    country_code
  ) values (
    target_source_table,
    target_entity_id,
    effective_owner,
    target_user_id,
    clean_latitude,
    clean_longitude,
    clean_precision,
    nullif(left(trim(coalesce(target_city, source_record.source_city, '')), 100), ''),
    nullif(left(trim(coalesce(target_region, source_record.source_region, '')), 100), ''),
    nullif(left(trim(coalesce(target_postal_code, source_record.source_postal_code, '')), 30), ''),
    clean_country
  )
  on conflict (source_table, entity_id)
  do update set
    owner_id = excluded.owner_id,
    created_by = excluded.created_by,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    location_precision = excluded.location_precision,
    city = excluded.city,
    region = excluded.region,
    postal_code = excluded.postal_code,
    country_code = excluded.country_code;

  return jsonb_strip_nulls(jsonb_build_object(
    'saved', true,
    'precision', clean_precision,
    'city', nullif(left(trim(coalesce(target_city, source_record.source_city, '')), 100), ''),
    'region', nullif(left(trim(coalesce(target_region, source_record.source_region, '')), 100), ''),
    'postalCode', nullif(left(trim(coalesce(target_postal_code, source_record.source_postal_code, '')), 30), ''),
    'countryCode', clean_country
  ));
end;
$$;

create or replace function public.clear_loombus_local_location(
  target_source_table text,
  target_entity_id uuid,
  target_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  source_record record;
  user_is_admin boolean := false;
begin
  select coalesce(profile.is_admin, false)
  into user_is_admin
  from public.profiles profile
  where profile.id = target_user_id;

  select *
  into source_record
  from public.resolve_loombus_local_source(
    target_source_table,
    target_entity_id
  );

  if not coalesce(source_record.source_found, false) then
    delete from public.loombus_local_locations location
    where location.source_table = target_source_table
      and location.entity_id = target_entity_id
      and (
        location.owner_id = target_user_id
        or location.created_by = target_user_id
        or user_is_admin
      );
    return true;
  end if;

  if not user_is_admin
    and source_record.source_owner_id is distinct from target_user_id then
    raise exception 'LOCAL_LOCATION_FORBIDDEN';
  end if;

  delete from public.loombus_local_locations location
  where location.source_table = target_source_table
    and location.entity_id = target_entity_id;
  return true;
end;
$$;

create or replace function public.populate_loombus_search_local_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  source_owner uuid;
  source_business uuid;
  source_city text;
  source_region text;
  source_postal text;
  source_country text;
  source_mode text;
  source_remote_available boolean := false;
  source_remote_only boolean := false;
  source_starts timestamptz;
  source_ends timestamptz;
  source_price text;
  source_attribution text;
  source_image text;
begin
  if new.source_table not in (
    'businesses',
    'business_services',
    'job_postings',
    'marketplace_listings',
    'public_events',
    'service_requests',
    'provider_services'
  ) then
    return new;
  end if;

  case new.source_table
    when 'businesses' then
      select
        business.owner_id,
        business.id,
        business.city,
        business.region,
        business.postal_code,
        business.country_code,
        business.service_area_mode,
        business.service_area_mode in ('online', 'hybrid'),
        business.service_area_mode = 'online',
        null::timestamptz,
        null::timestamptz,
        null::text,
        business.name,
        business.logo_url
      into
        source_owner,
        source_business,
        source_city,
        source_region,
        source_postal,
        source_country,
        source_mode,
        source_remote_available,
        source_remote_only,
        source_starts,
        source_ends,
        source_price,
        source_attribution,
        source_image
      from public.businesses business
      where business.id = new.entity_id;

    when 'business_services' then
      select
        business.owner_id,
        business.id,
        business.city,
        business.region,
        business.postal_code,
        business.country_code,
        business.service_area_mode,
        business.service_area_mode in ('online', 'hybrid'),
        business.service_area_mode = 'online',
        null::timestamptz,
        null::timestamptz,
        service.price_text,
        business.name,
        business.logo_url
      into
        source_owner,
        source_business,
        source_city,
        source_region,
        source_postal,
        source_country,
        source_mode,
        source_remote_available,
        source_remote_only,
        source_starts,
        source_ends,
        source_price,
        source_attribution,
        source_image
      from public.business_services service
      join public.businesses business on business.id = service.business_id
      where service.id = new.entity_id;

    when 'job_postings' then
      select
        business.owner_id,
        business.id,
        job.city,
        job.region,
        job.postal_code,
        job.country_code,
        job.workplace_type,
        job.workplace_type in ('remote', 'hybrid'),
        job.workplace_type = 'remote',
        job.published_at,
        least(
          coalesce(job.expires_at, 'infinity'::timestamptz),
          coalesce((job.application_deadline + 1)::timestamptz, 'infinity'::timestamptz)
        ),
        case
          when not job.show_compensation then null
          when job.compensation_min is null and job.compensation_max is null then null
          when job.compensation_min is not null and job.compensation_max is not null
            and job.compensation_min <> job.compensation_max
            then concat(job.compensation_currency, ' ', job.compensation_min, ' - ', job.compensation_max, ' per ', job.compensation_period)
          else concat(job.compensation_currency, ' ', coalesce(job.compensation_min, job.compensation_max), ' per ', job.compensation_period)
        end,
        business.name,
        business.logo_url
      into
        source_owner,
        source_business,
        source_city,
        source_region,
        source_postal,
        source_country,
        source_mode,
        source_remote_available,
        source_remote_only,
        source_starts,
        source_ends,
        source_price,
        source_attribution,
        source_image
      from public.job_postings job
      join public.businesses business on business.id = job.business_id
      where job.id = new.entity_id;

    when 'marketplace_listings' then
      select
        listing.seller_id,
        listing.business_id,
        listing.city,
        listing.region,
        listing.postal_code,
        listing.country_code,
        concat_ws(
          '_',
          case when listing.pickup_available then 'pickup' end,
          case when listing.local_delivery_available then 'delivery' end,
          case when listing.shipping_available then 'shipping' end
        ),
        listing.shipping_available,
        listing.shipping_available
          and not listing.pickup_available
          and not listing.local_delivery_available,
        listing.published_at,
        listing.expires_at,
        case
          when listing.is_free then 'Free'
          else concat(listing.currency, ' ', listing.price, case when listing.is_negotiable then ' negotiable' else '' end)
        end,
        coalesce(business.name, profile.full_name, profile.username),
        coalesce(business.logo_url, listing.photo_urls[1], profile.avatar_url)
      into
        source_owner,
        source_business,
        source_city,
        source_region,
        source_postal,
        source_country,
        source_mode,
        source_remote_available,
        source_remote_only,
        source_starts,
        source_ends,
        source_price,
        source_attribution,
        source_image
      from public.marketplace_listings listing
      left join public.businesses business on business.id = listing.business_id
      left join public.profiles profile on profile.id = listing.seller_id
      where listing.id = new.entity_id;

    when 'public_events' then
      select
        event.organizer_id,
        event.business_id,
        event.city,
        event.region,
        event.postal_code,
        event.country_code,
        event.event_format,
        event.event_format in ('online', 'hybrid'),
        event.event_format = 'online',
        event.starts_at,
        event.ends_at,
        case when event.is_free then 'Free' else event.price_text end,
        coalesce(business.name, profile.full_name, profile.username),
        coalesce(business.logo_url, profile.avatar_url)
      into
        source_owner,
        source_business,
        source_city,
        source_region,
        source_postal,
        source_country,
        source_mode,
        source_remote_available,
        source_remote_only,
        source_starts,
        source_ends,
        source_price,
        source_attribution,
        source_image
      from public.public_events event
      left join public.businesses business on business.id = event.business_id
      left join public.profiles profile on profile.id = event.organizer_id
      where event.id = new.entity_id;

    when 'service_requests' then
      select
        request.requester_id,
        request.business_id,
        request.city,
        request.region,
        request.postal_code,
        request.country_code,
        request.service_mode,
        request.service_mode in ('remote', 'flexible'),
        request.service_mode = 'remote',
        request.preferred_start,
        request.deadline,
        case
          when request.budget_min is null and request.budget_max is null then null
          when request.budget_min is not null and request.budget_max is not null
            then concat(request.currency, ' ', request.budget_min, ' - ', request.budget_max, case when request.budget_type = 'hourly' then ' per hour' else '' end)
          when request.budget_min is not null
            then concat('From ', request.currency, ' ', request.budget_min, case when request.budget_type = 'hourly' then ' per hour' else '' end)
          else concat('Up to ', request.currency, ' ', request.budget_max, case when request.budget_type = 'hourly' then ' per hour' else '' end)
        end,
        coalesce(business.name, profile.full_name, profile.username),
        coalesce(business.logo_url, profile.avatar_url)
      into
        source_owner,
        source_business,
        source_city,
        source_region,
        source_postal,
        source_country,
        source_mode,
        source_remote_available,
        source_remote_only,
        source_starts,
        source_ends,
        source_price,
        source_attribution,
        source_image
      from public.service_requests request
      left join public.businesses business on business.id = request.business_id
      left join public.profiles profile on profile.id = request.requester_id
      where request.id = new.entity_id;

    when 'provider_services' then
      select
        service.provider_id,
        service.business_id,
        service.city,
        service.region,
        service.postal_code,
        service.country_code,
        service.service_mode,
        service.service_mode in ('remote', 'flexible'),
        service.service_mode = 'remote',
        service.published_at,
        null::timestamptz,
        case
          when service.price_type = 'contact' then 'Contact for pricing'
          when service.price_type = 'fixed' and service.price_min is not null
            then concat(service.currency, ' ', service.price_min)
          when service.price_min is not null and service.price_max is not null
            then concat(service.currency, ' ', service.price_min, ' - ', service.price_max, case when service.price_type = 'hourly' then ' per hour' else '' end)
          when service.price_min is not null
            then concat('From ', service.currency, ' ', service.price_min, case when service.price_type = 'hourly' then ' per hour' else '' end)
          when service.price_max is not null
            then concat('Up to ', service.currency, ' ', service.price_max, case when service.price_type = 'hourly' then ' per hour' else '' end)
          else 'Contact for pricing'
        end,
        coalesce(business.name, profile.full_name, profile.username),
        coalesce(
          business.logo_url,
          case when service.attachment_types[1] like 'image/%' then service.attachment_urls[1] end,
          profile.avatar_url
        )
      into
        source_owner,
        source_business,
        source_city,
        source_region,
        source_postal,
        source_country,
        source_mode,
        source_remote_available,
        source_remote_only,
        source_starts,
        source_ends,
        source_price,
        source_attribution,
        source_image
      from public.provider_services service
      left join public.businesses business on business.id = service.business_id
      left join public.profiles profile on profile.id = service.provider_id
      where service.id = new.entity_id;
  end case;

  new.local_city := nullif(left(trim(coalesce(source_city, '')), 100), '');
  new.local_region := nullif(left(trim(coalesce(source_region, '')), 100), '');
  new.local_postal_code := nullif(left(trim(coalesce(source_postal, '')), 30), '');
  new.local_country_code := upper(left(coalesce(nullif(trim(source_country), ''), 'US'), 2));
  new.local_mode := nullif(left(trim(coalesce(source_mode, '')), 80), '');
  new.local_location_text := nullif(
    left(
      concat_ws(
        ', ',
        nullif(trim(coalesce(source_city, '')), ''),
        nullif(trim(coalesce(source_region, '')), ''),
        nullif(trim(coalesce(source_postal, '')), ''),
        nullif(trim(coalesce(source_country, '')), '')
      ),
      500
    ),
    ''
  );
  new.local_business_id := source_business;
  new.local_remote_available := coalesce(source_remote_available, false);
  new.local_remote_only := coalesce(source_remote_only, false);
  new.local_starts_at := source_starts;
  new.local_ends_at := case when source_ends = 'infinity'::timestamptz then null else source_ends end;
  new.local_price_text := nullif(left(trim(coalesce(source_price, '')), 300), '');
  new.local_attribution := nullif(left(trim(coalesce(source_attribution, '')), 300), '');
  new.local_image_url := nullif(left(trim(coalesce(source_image, '')), 1200), '');

  if source_owner is not null then
    new.owner_id := source_owner;
  end if;
  if new.source_table <> 'businesses' and source_business is not null then
    new.parent_id := source_business;
  end if;

  return new;
end;
$$;

drop trigger if exists populate_loombus_search_local_fields_trigger
  on public.loombus_search_documents;
create trigger populate_loombus_search_local_fields_trigger
before insert or update on public.loombus_search_documents
for each row execute function public.populate_loombus_search_local_fields();

create or replace function public.cleanup_loombus_local_location()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.loombus_local_locations location
  where location.source_table = tg_table_name
    and location.entity_id = old.id;
  return old;
end;
$$;

drop trigger if exists cleanup_business_local_location on public.businesses;
create trigger cleanup_business_local_location
after delete on public.businesses
for each row execute function public.cleanup_loombus_local_location();

drop trigger if exists cleanup_job_local_location on public.job_postings;
create trigger cleanup_job_local_location
after delete on public.job_postings
for each row execute function public.cleanup_loombus_local_location();

drop trigger if exists cleanup_marketplace_local_location on public.marketplace_listings;
create trigger cleanup_marketplace_local_location
after delete on public.marketplace_listings
for each row execute function public.cleanup_loombus_local_location();

drop trigger if exists cleanup_event_local_location on public.public_events;
create trigger cleanup_event_local_location
after delete on public.public_events
for each row execute function public.cleanup_loombus_local_location();

drop trigger if exists cleanup_request_local_location on public.service_requests;
create trigger cleanup_request_local_location
after delete on public.service_requests
for each row execute function public.cleanup_loombus_local_location();

drop trigger if exists cleanup_provider_service_local_location on public.provider_services;
create trigger cleanup_provider_service_local_location
after delete on public.provider_services
for each row execute function public.cleanup_loombus_local_location();

create or replace function public.search_loombus_local(
  search_text text default null,
  entity_filters text[] default null,
  location_filter text default null,
  center_latitude double precision default null,
  center_longitude double precision default null,
  radius_miles double precision default null,
  include_remote boolean default true,
  date_from timestamptz default null,
  date_to timestamptz default null,
  page_number integer default 1,
  page_size integer default 24
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  clean_query text := trim(coalesce(search_text, ''));
  clean_location text := trim(coalesce(location_filter, ''));
  clean_filters text[] := coalesce(entity_filters, '{}'::text[]);
  clean_page integer := greatest(coalesce(page_number, 1), 1);
  clean_size integer := least(greatest(coalesce(page_size, 24), 1), 48);
  clean_radius double precision := least(greatest(coalesce(radius_miles, 25), 1), 250);
  query_filter tsquery;
  center_valid boolean := center_latitude is not null
    and center_longitude is not null
    and center_latitude between -90 and 90
    and center_longitude between -180 and 180;
  result jsonb;
begin
  if clean_query <> '' then
    query_filter := websearch_to_tsquery('simple', clean_query);
  end if;

  with normalized as (
    select
      document.*,
      case
        when document.source_table = 'businesses' then 'business'
        when document.source_table in ('business_services', 'provider_services') then 'service'
        when document.source_table = 'public_events' then 'event'
        when document.source_table = 'job_postings' then 'job'
        when document.source_table = 'marketplace_listings' then 'marketplace'
        else 'request'
      end as local_entity_type,
      coalesce(direct_location.latitude, business_location.latitude) as search_latitude,
      coalesce(direct_location.longitude, business_location.longitude) as search_longitude,
      coalesce(direct_location.location_precision, business_location.location_precision) as search_precision,
      coalesce(direct_location.city, business_location.city, document.local_city) as search_city,
      coalesce(direct_location.region, business_location.region, document.local_region) as search_region,
      coalesce(direct_location.postal_code, business_location.postal_code, document.local_postal_code) as search_postal_code,
      coalesce(direct_location.country_code, business_location.country_code, document.local_country_code) as search_country_code
    from public.loombus_search_documents document
    left join public.loombus_local_locations direct_location
      on direct_location.source_table = document.source_table
      and direct_location.entity_id = document.entity_id
    left join public.loombus_local_locations business_location
      on business_location.source_table = 'businesses'
      and business_location.entity_id = document.local_business_id
    where document.visibility = 'public'
      and document.status = 'active'
      and document.source_table in (
        'businesses',
        'business_services',
        'job_postings',
        'marketplace_listings',
        'public_events',
        'service_requests',
        'provider_services'
      )
  ),
  scored as (
    select
      normalized.*,
      case
        when center_valid
          and normalized.search_latitude is not null
          and normalized.search_longitude is not null
        then public.loombus_distance_miles(
          center_latitude,
          center_longitude,
          normalized.search_latitude,
          normalized.search_longitude
        )
        else null
      end as distance_miles,
      case
        when query_filter is null then 0::real
        else ts_rank_cd(normalized.search_vector, query_filter)
          + case when lower(normalized.title) like '%' || lower(clean_query) || '%' then 2 else 0 end
      end as relevance_score
    from normalized
  ),
  filtered as (
    select *
    from scored
    where (
        query_filter is null
        or scored.search_vector @@ query_filter
        or scored.title ilike '%' || clean_query || '%'
        or scored.summary ilike '%' || clean_query || '%'
      )
      and (
        cardinality(clean_filters) = 0
        or scored.local_entity_type = any(clean_filters)
      )
      and (
        include_remote
        or not scored.local_remote_only
      )
      and (
        clean_location = ''
        or concat_ws(
          ' ',
          scored.search_city,
          scored.search_region,
          scored.search_postal_code,
          scored.search_country_code,
          scored.local_location_text
        ) ilike '%' || clean_location || '%'
        or (include_remote and scored.local_remote_available)
      )
      and (
        not center_valid
        or (
          scored.distance_miles is not null
          and scored.distance_miles <= clean_radius
        )
        or (include_remote and scored.local_remote_available)
        or (
          clean_location <> ''
          and scored.distance_miles is null
          and concat_ws(
            ' ',
            scored.search_city,
            scored.search_region,
            scored.search_postal_code,
            scored.search_country_code,
            scored.local_location_text
          ) ilike '%' || clean_location || '%'
        )
      )
      and (
        scored.source_table <> 'public_events'
        or scored.local_starts_at is null
        or scored.local_starts_at >= now()
      )
      and (
        scored.source_table not in ('job_postings', 'marketplace_listings', 'service_requests')
        or scored.local_ends_at is null
        or scored.local_ends_at > now()
      )
      and (
        date_from is null
        or scored.source_table <> 'public_events'
        or scored.local_starts_at >= date_from
      )
      and (
        date_to is null
        or scored.source_table <> 'public_events'
        or scored.local_starts_at <= date_to
      )
  ),
  paged as (
    select *
    from filtered
    order by
      relevance_score desc,
      case when center_valid then distance_miles end asc nulls last,
      case when source_table = 'public_events' then local_starts_at end asc nulls last,
      coalesce(source_updated_at, updated_at) desc
    offset (clean_page - 1) * clean_size
    limit clean_size
  ),
  type_counts as (
    select local_entity_type, count(*)::integer as amount
    from filtered
    group by local_entity_type
  )
  select jsonb_build_object(
    'results', coalesce((
      select jsonb_agg(
        jsonb_strip_nulls(jsonb_build_object(
          'id', paged.entity_id,
          'entityType', paged.local_entity_type,
          'sourceTable', paged.source_table,
          'title', paged.title,
          'summary', paged.summary,
          'href', paged.href,
          'category', coalesce(
            paged.metadata ->> 'event_category',
            paged.metadata ->> 'request_category',
            paged.metadata ->> 'service_category',
            paged.metadata ->> 'category'
          ),
          'city', paged.search_city,
          'region', paged.search_region,
          'postalCode', paged.search_postal_code,
          'countryCode', paged.search_country_code,
          'locationMode', paged.local_mode,
          'remoteAvailable', paged.local_remote_available,
          'distanceMiles', case
            when paged.distance_miles is null then null
            else round(paged.distance_miles::numeric, 1)
          end,
          'startsAt', paged.local_starts_at,
          'endsAt', paged.local_ends_at,
          'priceText', paged.local_price_text,
          'attribution', paged.local_attribution,
          'imageUrl', paged.local_image_url,
          'locationPrecision', paged.search_precision,
          'updatedAt', coalesce(paged.source_updated_at, paged.updated_at)
        ))
        order by
          paged.relevance_score desc,
          case when center_valid then paged.distance_miles end asc nulls last,
          case when paged.source_table = 'public_events' then paged.local_starts_at end asc nulls last,
          coalesce(paged.source_updated_at, paged.updated_at) desc
      )
      from paged
    ), '[]'::jsonb),
    'total', (select count(*) from filtered),
    'page', clean_page,
    'pageSize', clean_size,
    'counts', coalesce((
      select jsonb_object_agg(type_counts.local_entity_type, type_counts.amount)
      from type_counts
    ), '{}'::jsonb),
    'anchoredTotal', (
      select count(*)
      from filtered
      where filtered.search_latitude is not null
        and filtered.search_longitude is not null
    )
  ) into result;

  return result;
end;
$$;

alter table public.loombus_local_locations enable row level security;

revoke all on table public.loombus_local_locations
  from public, anon, authenticated;
grant all on table public.loombus_local_locations to service_role;

revoke all on function public.touch_loombus_local_location()
  from public, anon, authenticated;
revoke all on function public.loombus_distance_miles(double precision, double precision, double precision, double precision)
  from public, anon, authenticated;
revoke all on function public.resolve_loombus_local_source(text, uuid)
  from public, anon, authenticated;
revoke all on function public.set_loombus_local_location(text, uuid, uuid, double precision, double precision, text, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.clear_loombus_local_location(text, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.populate_loombus_search_local_fields()
  from public, anon, authenticated;
revoke all on function public.cleanup_loombus_local_location()
  from public, anon, authenticated;
revoke all on function public.search_loombus_local(text, text[], text, double precision, double precision, double precision, boolean, timestamptz, timestamptz, integer, integer)
  from public, anon, authenticated;

grant execute on function public.touch_loombus_local_location() to service_role;
grant execute on function public.loombus_distance_miles(double precision, double precision, double precision, double precision) to service_role;
grant execute on function public.resolve_loombus_local_source(text, uuid) to service_role;
grant execute on function public.set_loombus_local_location(text, uuid, uuid, double precision, double precision, text, text, text, text, text) to service_role;
grant execute on function public.clear_loombus_local_location(text, uuid, uuid) to service_role;
grant execute on function public.populate_loombus_search_local_fields() to service_role;
grant execute on function public.cleanup_loombus_local_location() to service_role;
grant execute on function public.search_loombus_local(text, text[], text, double precision, double precision, double precision, boolean, timestamptz, timestamptz, integer, integer) to service_role;

-- Backfill the standardized Local Discovery fields through the shared trigger.
update public.loombus_search_documents
set source_updated_at = source_updated_at
where source_table in (
  'businesses',
  'business_services',
  'job_postings',
  'marketplace_listings',
  'public_events',
  'service_requests',
  'provider_services'
);

notify pgrst, 'reload schema';

commit;
