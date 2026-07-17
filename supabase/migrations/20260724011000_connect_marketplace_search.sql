-- Connect available Marketplace listings to Everything Search without sponsored ranking.

begin;

create or replace function public.index_marketplace_listing_search(
  target_listing_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  listing_row public.marketplace_listings%rowtype;
  seller_row public.profiles%rowtype;
  business_row public.businesses%rowtype;
  seller_available boolean := false;
  location_summary text;
  fulfillment_summary text;
  price_summary text;
  attribute_summary text;
  attribute_keys text[] := '{}'::text[];
  attribute_values text[] := '{}'::text[];
  listing_keywords text[];
begin
  select *
  into listing_row
  from public.marketplace_listings listing
  where listing.id = target_listing_id;

  if listing_row.id is null then
    delete from public.loombus_search_documents document
    where document.source_table = 'marketplace_listings'
      and document.entity_id = target_listing_id;
    return;
  end if;

  select *
  into seller_row
  from public.profiles profile
  where profile.id = listing_row.seller_id;

  seller_available := seller_row.id is not null
    and (
      coalesce(seller_row.account_status, 'active') in ('active', 'warned')
      or (
        seller_row.account_status = 'suspended'
        and seller_row.suspended_until is not null
        and seller_row.suspended_until <= now()
      )
    );

  if listing_row.business_id is not null then
    select *
    into business_row
    from public.businesses business
    where business.id = listing_row.business_id;
  end if;

  if not seller_available
    or listing_row.status <> 'published'
    or (
      listing_row.expires_at is not null
      and listing_row.expires_at <= now()
    )
    or (
      listing_row.business_id is not null
      and (
        business_row.id is null
        or business_row.status <> 'published'
        or business_row.owner_id <> listing_row.seller_id
      )
    )
  then
    delete from public.loombus_search_documents document
    where document.source_table = 'marketplace_listings'
      and document.entity_id = target_listing_id;
    return;
  end if;

  location_summary := concat_ws(
    ', ',
    nullif(listing_row.city, ''),
    nullif(listing_row.region, ''),
    nullif(listing_row.postal_code, '')
  );

  fulfillment_summary := concat_ws(
    ', ',
    case when listing_row.pickup_available then 'Pickup' end,
    case when listing_row.local_delivery_available then 'Local delivery' end,
    case when listing_row.shipping_available then 'Shipping' end
  );

  price_summary := case
    when listing_row.is_free then 'Free'
    else concat(
      listing_row.currency,
      ' ',
      listing_row.price,
      case when listing_row.is_negotiable then ' negotiable' else '' end
    )
  end;

  select
    coalesce(string_agg(entry.key || ': ' || entry.value, ', '), ''),
    coalesce(array_agg(entry.key), '{}'::text[]),
    coalesce(array_agg(entry.value), '{}'::text[])
  into attribute_summary, attribute_keys, attribute_values
  from jsonb_each_text(listing_row.attributes) entry;

  listing_keywords := array_remove(
    array[
      listing_row.title,
      listing_row.category,
      listing_row.item_condition,
      listing_row.city,
      listing_row.region,
      listing_row.postal_code,
      listing_row.country_code,
      seller_row.full_name,
      seller_row.username,
      business_row.name,
      'marketplace',
      'listing',
      'item',
      'for sale',
      case when listing_row.is_free then 'free' else 'price' end,
      case when listing_row.pickup_available then 'pickup' end,
      case when listing_row.local_delivery_available then 'delivery' end,
      case when listing_row.shipping_available then 'shipping' end
    ]
      || coalesce(listing_row.tags, '{}'::text[])
      || attribute_keys
      || attribute_values,
    null
  );

  insert into public.loombus_search_documents (
    source_table,
    entity_type,
    entity_id,
    parent_id,
    room_id,
    owner_id,
    title,
    summary,
    body,
    keywords,
    href,
    visibility,
    status,
    signal_score,
    metadata,
    source_created_at,
    source_updated_at
  )
  values (
    'marketplace_listings',
    'marketplace',
    listing_row.id,
    listing_row.business_id,
    null,
    listing_row.seller_id,
    left(listing_row.title, 300),
    left(
      concat_ws(
        ' · ',
        price_summary,
        listing_row.category,
        replace(listing_row.item_condition, '_', ' '),
        nullif(location_summary, ''),
        nullif(fulfillment_summary, ''),
        nullif(business_row.name, ''),
        coalesce(
          nullif(seller_row.full_name, ''),
          nullif(seller_row.username, '')
        )
      ),
      2000
    ),
    left(
      concat_ws(
        E'\n\n',
        nullif(listing_row.description, ''),
        case
          when cardinality(listing_row.tags) > 0
            then 'Tags: ' || array_to_string(listing_row.tags, ', ')
        end,
        nullif(attribute_summary, '')
      ),
      20000
    ),
    listing_keywords,
    '/marketplace/' || listing_row.slug,
    'public',
    'active',
    0,
    jsonb_strip_nulls(jsonb_build_object(
      'listingId', listing_row.id,
      'listingSlug', listing_row.slug,
      'sellerId', listing_row.seller_id,
      'sellerName', coalesce(seller_row.full_name, seller_row.username),
      'sellerUsername', seller_row.username,
      'sellerAvatarUrl', seller_row.avatar_url,
      'businessId', listing_row.business_id,
      'businessName', business_row.name,
      'businessSlug', business_row.slug,
      'businessLogoUrl', business_row.logo_url,
      'businessVerificationStatus', business_row.verification_status,
      'category', listing_row.category,
      'condition', listing_row.item_condition,
      'price', listing_row.price,
      'currency', listing_row.currency,
      'isFree', listing_row.is_free,
      'isNegotiable', listing_row.is_negotiable,
      'city', listing_row.city,
      'region', listing_row.region,
      'postalCode', listing_row.postal_code,
      'countryCode', listing_row.country_code,
      'pickupAvailable', listing_row.pickup_available,
      'localDeliveryAvailable', listing_row.local_delivery_available,
      'shippingAvailable', listing_row.shipping_available,
      'tags', listing_row.tags,
      'attributes', listing_row.attributes,
      'photoUrls', listing_row.photo_urls,
      'expiresAt', listing_row.expires_at
    )),
    listing_row.created_at,
    listing_row.updated_at
  )
  on conflict (source_table, entity_id)
  do update set
    entity_type = excluded.entity_type,
    parent_id = excluded.parent_id,
    room_id = excluded.room_id,
    owner_id = excluded.owner_id,
    title = excluded.title,
    summary = excluded.summary,
    body = excluded.body,
    keywords = excluded.keywords,
    href = excluded.href,
    visibility = excluded.visibility,
    status = excluded.status,
    signal_score = excluded.signal_score,
    metadata = excluded.metadata,
    source_created_at = excluded.source_created_at,
    source_updated_at = excluded.source_updated_at,
    updated_at = now();
end;
$$;

create or replace function public.sync_marketplace_listing_search()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_listing_id uuid;
begin
  target_listing_id := case
    when tg_op = 'DELETE' then old.id
    else new.id
  end;

  perform public.index_marketplace_listing_search(target_listing_id);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.sync_marketplace_seller_search()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  listing_id uuid;
begin
  for listing_id in
    select listing.id
    from public.marketplace_listings listing
    where listing.seller_id = new.id
  loop
    perform public.index_marketplace_listing_search(listing_id);
  end loop;
  return new;
end;
$$;

create or replace function public.sync_marketplace_business_search()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  listing_id uuid;
begin
  for listing_id in
    select listing.id
    from public.marketplace_listings listing
    where listing.business_id = new.id
  loop
    perform public.index_marketplace_listing_search(listing_id);
  end loop;
  return new;
end;
$$;

drop trigger if exists sync_marketplace_listing_search_rows
  on public.marketplace_listings;
create trigger sync_marketplace_listing_search_rows
after insert or update or delete on public.marketplace_listings
for each row execute function public.sync_marketplace_listing_search();

drop trigger if exists sync_marketplace_seller_search_profiles
  on public.profiles;
create trigger sync_marketplace_seller_search_profiles
after update of
  full_name,
  username,
  avatar_url,
  account_status,
  suspended_until
on public.profiles
for each row execute function public.sync_marketplace_seller_search();

drop trigger if exists sync_marketplace_business_search_businesses
  on public.businesses;
create trigger sync_marketplace_business_search_businesses
after update of
  owner_id,
  name,
  slug,
  logo_url,
  verification_status,
  status
on public.businesses
for each row execute function public.sync_marketplace_business_search();

do $$
declare
  listing_id uuid;
begin
  perform public.expire_marketplace_listings();

  for listing_id in
    select listing.id
    from public.marketplace_listings listing
  loop
    perform public.index_marketplace_listing_search(listing_id);
  end loop;
end;
$$;

insert into public.loombus_search_documents (
  source_table,
  entity_type,
  entity_id,
  title,
  summary,
  body,
  keywords,
  href,
  visibility,
  status,
  signal_score,
  metadata,
  source_created_at,
  source_updated_at
)
values (
  'platform_pages',
  'page',
  '168edb72-8a0f-44d4-a6b2-36214764db95'::uuid,
  'Loombus Marketplace',
  'Browse approved items from attributable personal sellers and approved businesses.',
  'Find Marketplace listings by item, category, condition, price, location, pickup, local delivery, shipping, tags, attributes, and seller identity.',
  array[
    'marketplace',
    'items for sale',
    'buy and sell',
    'local pickup',
    'local delivery',
    'shipping',
    'free items',
    'seller listings'
  ],
  '/marketplace',
  'public',
  'active',
  0,
  jsonb_build_object('category', 'Commerce'),
  now(),
  now()
)
on conflict (source_table, entity_id)
do update set
  title = excluded.title,
  summary = excluded.summary,
  body = excluded.body,
  keywords = excluded.keywords,
  href = excluded.href,
  visibility = excluded.visibility,
  status = excluded.status,
  metadata = excluded.metadata,
  source_updated_at = now(),
  updated_at = now();

create or replace function public.search_loombus_documents(
  search_text text,
  viewer_user_id uuid default null,
  viewer_has_premium boolean default false,
  result_limit integer default 60
)
returns table (
  document_id uuid,
  entity_type text,
  entity_id uuid,
  parent_id uuid,
  room_id uuid,
  owner_id uuid,
  title text,
  snippet text,
  href text,
  visibility text,
  signal_score numeric,
  source_created_at timestamptz,
  metadata jsonb,
  rank real
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  clean_query text := trim(coalesce(search_text, ''));
  capped_limit integer := least(greatest(coalesce(result_limit, 60), 1), 100);
  query_tree tsquery;
begin
  if char_length(clean_query) < 2 then
    return;
  end if;

  query_tree := websearch_to_tsquery('simple', clean_query);

  return query
  with accessible as (
    select
      document.*,
      ts_rank_cd(document.search_vector, query_tree)::real as lexical_rank,
      case
        when lower(document.title) = lower(clean_query) then 0.75
        when lower(document.title) like lower(clean_query) || '%' then 0.5
        when document.title ilike '%' || clean_query || '%' then 0.3
        else 0
      end::real as title_boost,
      greatest(
        0,
        0.12 - (
          extract(
            epoch from (
              now() - coalesce(document.source_created_at, document.created_at)
            )
          ) / 315576000
        )
      )::real as recency_boost
    from public.loombus_search_documents document
    where document.status = 'active'
      and (
        document.entity_type <> 'job'
        or (
          (
            nullif(document.metadata ->> 'expiresAt', '') is null
            or nullif(document.metadata ->> 'expiresAt', '')::timestamptz > now()
          )
          and (
            nullif(document.metadata ->> 'applicationDeadline', '') is null
            or nullif(document.metadata ->> 'applicationDeadline', '')::date >= current_date
          )
        )
      )
      and (
        document.entity_type <> 'marketplace'
        or nullif(document.metadata ->> 'expiresAt', '') is null
        or nullif(document.metadata ->> 'expiresAt', '')::timestamptz > now()
      )
      and (
        document.visibility = 'public'
        or (
          viewer_user_id is not null
          and document.visibility = 'authenticated'
        )
        or (
          viewer_user_id is not null
          and viewer_has_premium
          and document.visibility = 'premium'
        )
        or (
          viewer_user_id is not null
          and document.visibility = 'private'
          and document.owner_id = viewer_user_id
        )
        or (
          viewer_user_id is not null
          and document.visibility = 'member'
          and document.room_id is not null
          and (
            exists (
              select 1
              from public.rooms room
              where room.id = document.room_id
                and (
                  room.owner_id = viewer_user_id
                  or room.created_by = viewer_user_id
                )
            )
            or exists (
              select 1
              from public.room_members member
              where member.room_id = document.room_id
                and member.user_id = viewer_user_id
                and coalesce(member.status, 'active')
                  not in ('blocked', 'removed', 'inactive')
                and (
                  member.suspended_until is null
                  or member.suspended_until <= now()
                )
            )
          )
        )
      )
      and (
        document.source_table not in (
          'replies',
          'discussion_summaries',
          'discussion_attachments'
        )
        or exists (
          select 1
          from public.discussions parent_discussion
          where parent_discussion.id = document.parent_id
            and parent_discussion.deleted_at is null
        )
      )
      and (
        document.search_vector @@ query_tree
        or document.title ilike '%' || clean_query || '%'
        or document.summary ilike '%' || clean_query || '%'
        or document.body ilike '%' || clean_query || '%'
      )
  )
  select
    accessible.id,
    accessible.entity_type,
    accessible.entity_id,
    accessible.parent_id,
    accessible.room_id,
    accessible.owner_id,
    accessible.title,
    left(
      coalesce(
        nullif(accessible.summary, ''),
        nullif(accessible.body, ''),
        ''
      ),
      700
    ),
    accessible.href,
    accessible.visibility,
    accessible.signal_score,
    accessible.source_created_at,
    accessible.metadata,
    (
      accessible.lexical_rank
      + accessible.title_boost
      + accessible.recency_boost
      + least(greatest(accessible.signal_score, 0) / 400, 0.25)
    )::real
  from accessible
  order by
    (
      accessible.lexical_rank
      + accessible.title_boost
      + accessible.recency_boost
      + least(greatest(accessible.signal_score, 0) / 400, 0.25)
    ) desc,
    accessible.source_created_at desc nulls last
  limit capped_limit;
end;
$$;

revoke all on function public.index_marketplace_listing_search(uuid)
  from public, anon, authenticated;
revoke all on function public.sync_marketplace_listing_search()
  from public, anon, authenticated;
revoke all on function public.sync_marketplace_seller_search()
  from public, anon, authenticated;
revoke all on function public.sync_marketplace_business_search()
  from public, anon, authenticated;
revoke all on function public.search_loombus_documents(
  text,
  uuid,
  boolean,
  integer
)
  from public, anon, authenticated;

grant execute on function public.index_marketplace_listing_search(uuid)
  to service_role;
grant execute on function public.search_loombus_documents(
  text,
  uuid,
  boolean,
  integer
)
  to service_role;

notify pgrst, 'reload schema';

commit;
