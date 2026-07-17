-- Public Marketplace listings, attributable sellers, lifecycle, moderation, reporting, and photos.

begin;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null,
  business_id uuid references public.businesses(id) on delete set null,
  slug text not null unique,
  title text not null,
  description text not null,
  category text not null,
  item_condition text not null default 'good',
  price numeric(14, 2) not null default 0,
  currency text not null default 'USD',
  is_free boolean not null default false,
  is_negotiable boolean not null default false,
  city text,
  region text,
  postal_code text,
  country_code text not null default 'US',
  pickup_available boolean not null default false,
  local_delivery_available boolean not null default false,
  shipping_available boolean not null default false,
  tags text[] not null default '{}'::text[],
  attributes jsonb not null default '{}'::jsonb,
  photo_urls text[] not null default '{}'::text[],
  photo_paths text[] not null default '{}'::text[],
  expires_at timestamptz,
  status text not null default 'pending',
  moderation_reason text,
  published_at timestamptz,
  sold_at timestamptz,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_listings_seller_id_fkey
    foreign key (seller_id) references public.profiles(id) on delete cascade,
  constraint marketplace_listings_slug_length_check
    check (char_length(slug) between 1 and 100),
  constraint marketplace_listings_title_length_check
    check (char_length(title) between 3 and 200),
  constraint marketplace_listings_description_length_check
    check (char_length(description) between 30 and 16000),
  constraint marketplace_listings_category_length_check
    check (char_length(category) between 1 and 120),
  constraint marketplace_listings_condition_check
    check (
      item_condition in (
        'new',
        'like_new',
        'good',
        'fair',
        'for_parts',
        'not_applicable'
      )
    ),
  constraint marketplace_listings_price_check
    check (price >= 0),
  constraint marketplace_listings_free_price_check
    check (not is_free or price = 0),
  constraint marketplace_listings_negotiable_check
    check (not is_free or not is_negotiable),
  constraint marketplace_listings_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint marketplace_listings_country_code_check
    check (char_length(country_code) = 2),
  constraint marketplace_listings_fulfillment_check
    check (pickup_available or local_delivery_available or shipping_available),
  constraint marketplace_listings_local_location_check
    check (
      not (pickup_available or local_delivery_available)
      or nullif(trim(coalesce(city, '')), '') is not null
      or nullif(trim(coalesce(region, '')), '') is not null
    ),
  constraint marketplace_listings_attributes_object_check
    check (jsonb_typeof(attributes) = 'object'),
  constraint marketplace_listings_photo_arrays_check
    check (cardinality(photo_urls) = cardinality(photo_paths)),
  constraint marketplace_listings_status_check
    check (
      status in (
        'draft',
        'pending',
        'published',
        'rejected',
        'suspended',
        'sold',
        'expired',
        'removed'
      )
    )
);

create table if not exists public.marketplace_reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  details text not null,
  status text not null default 'open',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_reports_reason_length_check
    check (char_length(reason) between 1 and 120),
  constraint marketplace_reports_details_length_check
    check (char_length(details) between 10 and 3000),
  constraint marketplace_reports_status_check
    check (status in ('open', 'resolved', 'dismissed'))
);

create index if not exists marketplace_listings_public_idx
  on public.marketplace_listings (status, published_at desc);

create index if not exists marketplace_listings_seller_idx
  on public.marketplace_listings (seller_id, status, updated_at desc);

create index if not exists marketplace_listings_business_idx
  on public.marketplace_listings (business_id, status, updated_at desc)
  where business_id is not null;

create index if not exists marketplace_listings_location_idx
  on public.marketplace_listings (city, region, category, item_condition);

create index if not exists marketplace_listings_expiration_idx
  on public.marketplace_listings (status, expires_at)
  where status = 'published';

create index if not exists marketplace_reports_review_idx
  on public.marketplace_reports (status, created_at);

create index if not exists marketplace_reports_rate_idx
  on public.marketplace_reports (reporter_id, created_at desc);

create or replace function public.touch_marketplace_updated_at()
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

drop trigger if exists touch_marketplace_listings_updated_at
  on public.marketplace_listings;
create trigger touch_marketplace_listings_updated_at
before update on public.marketplace_listings
for each row execute function public.touch_marketplace_updated_at();

drop trigger if exists touch_marketplace_reports_updated_at
  on public.marketplace_reports;
create trigger touch_marketplace_reports_updated_at
before update on public.marketplace_reports
for each row execute function public.touch_marketplace_updated_at();

create or replace function public.expire_marketplace_listings()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  expired_count integer := 0;
begin
  update public.marketplace_listings
  set
    status = 'expired',
    moderation_reason = coalesce(
      moderation_reason,
      'Automatically expired after the seller-selected availability date.'
    )
  where status = 'published'
    and expires_at is not null
    and expires_at <= now();

  get diagnostics expired_count = row_count;
  return expired_count;
end;
$$;

create or replace function public.search_public_marketplace(
  search_text text default null,
  category_filter text default null,
  condition_filter text default null,
  city_filter text default null,
  fulfillment_filter text default null,
  minimum_price numeric default null,
  maximum_price numeric default null,
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
  clean_search text := trim(coalesce(search_text, ''));
  clean_category text := trim(coalesce(category_filter, ''));
  clean_condition text := trim(coalesce(condition_filter, ''));
  clean_city text := trim(coalesce(city_filter, ''));
  clean_fulfillment text := trim(coalesce(fulfillment_filter, ''));
  clean_page integer := greatest(coalesce(page_number, 1), 1);
  clean_size integer := least(greatest(coalesce(page_size, 24), 1), 48);
  result jsonb;
begin
  with filtered as (
    select
      listing.id,
      listing.seller_id,
      profile.full_name as seller_name,
      profile.username as seller_username,
      profile.avatar_url as seller_avatar_url,
      listing.business_id,
      business.name as business_name,
      business.slug as business_slug,
      business.logo_url as business_logo_url,
      business.verification_status as business_verification_status,
      business.status as business_status,
      listing.slug,
      listing.title,
      listing.description,
      listing.category,
      listing.item_condition,
      listing.price,
      listing.currency,
      listing.is_free,
      listing.is_negotiable,
      listing.city,
      listing.region,
      listing.postal_code,
      listing.country_code,
      listing.pickup_available,
      listing.local_delivery_available,
      listing.shipping_available,
      listing.tags,
      listing.attributes,
      listing.photo_urls,
      listing.photo_paths,
      listing.expires_at,
      listing.status,
      listing.moderation_reason,
      listing.published_at,
      listing.sold_at,
      listing.removed_at,
      listing.created_at,
      listing.updated_at
    from public.marketplace_listings listing
    join public.profiles profile
      on profile.id = listing.seller_id
    left join public.businesses business
      on business.id = listing.business_id
    where listing.status = 'published'
      and (listing.expires_at is null or listing.expires_at > now())
      and (
        coalesce(profile.account_status, 'active') in ('active', 'warned')
        or (
          profile.account_status = 'suspended'
          and profile.suspended_until is not null
          and profile.suspended_until <= now()
        )
      )
      and (
        listing.business_id is null
        or (
          business.status = 'published'
          and business.owner_id = listing.seller_id
        )
      )
      and (
        clean_category = ''
        or lower(listing.category) = lower(clean_category)
      )
      and (
        clean_condition = ''
        or listing.item_condition = clean_condition
      )
      and (
        clean_city = ''
        or listing.city ilike '%' || clean_city || '%'
        or listing.region ilike '%' || clean_city || '%'
        or listing.postal_code ilike '%' || clean_city || '%'
      )
      and (
        clean_fulfillment = ''
        or (clean_fulfillment = 'pickup' and listing.pickup_available)
        or (clean_fulfillment = 'delivery' and listing.local_delivery_available)
        or (clean_fulfillment = 'shipping' and listing.shipping_available)
      )
      and (minimum_price is null or listing.price >= minimum_price)
      and (maximum_price is null or listing.price <= maximum_price)
      and (
        clean_search = ''
        or listing.title ilike '%' || clean_search || '%'
        or listing.description ilike '%' || clean_search || '%'
        or listing.category ilike '%' || clean_search || '%'
        or profile.full_name ilike '%' || clean_search || '%'
        or profile.username ilike '%' || clean_search || '%'
        or business.name ilike '%' || clean_search || '%'
        or array_to_string(listing.tags, ' ') ilike '%' || clean_search || '%'
        or listing.attributes::text ilike '%' || clean_search || '%'
      )
  ),
  paged as (
    select *
    from filtered
    order by published_at desc nulls last, created_at desc
    offset (clean_page - 1) * clean_size
    limit clean_size
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'listings', coalesce(
      (
        select jsonb_agg(
          to_jsonb(page_row)
          order by page_row.published_at desc nulls last,
            page_row.created_at desc
        )
        from paged page_row
      ),
      '[]'::jsonb
    )
  )
  into result;

  return coalesce(
    result,
    jsonb_build_object('total', 0, 'listings', '[]'::jsonb)
  );
end;
$$;

alter table public.marketplace_listings enable row level security;
alter table public.marketplace_reports enable row level security;

revoke all on table public.marketplace_listings
  from public, anon, authenticated;
revoke all on table public.marketplace_reports
  from public, anon, authenticated;

revoke all on function public.touch_marketplace_updated_at()
  from public, anon, authenticated;
revoke all on function public.expire_marketplace_listings()
  from public, anon, authenticated;
revoke all on function public.search_public_marketplace(
  text,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  integer,
  integer
)
  from public, anon, authenticated;

grant execute on function public.expire_marketplace_listings()
  to service_role;
grant execute on function public.search_public_marketplace(
  text,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  integer,
  integer
)
  to service_role;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'marketplace-images',
  'marketplace-images',
  true,
  12582912,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id)
do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

notify pgrst, 'reload schema';

commit;
