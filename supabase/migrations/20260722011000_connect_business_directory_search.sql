-- Connect approved Local Business and Services listings to Everything Search.

begin;

create or replace function public.index_local_business_search(
  target_business_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  business_row public.businesses%rowtype;
  service_row public.business_services%rowtype;
  location_summary text;
  business_keywords text[];
begin
  select *
  into business_row
  from public.businesses business
  where business.id = target_business_id;

  if business_row.id is null or business_row.status <> 'published' then
    delete from public.loombus_search_documents document
    where (
      document.source_table = 'businesses'
      and document.entity_id = target_business_id
    )
    or (
      document.source_table = 'business_services'
      and document.parent_id = target_business_id
    );
    return;
  end if;

  location_summary := concat_ws(
    ', ',
    nullif(business_row.city, ''),
    nullif(business_row.region, ''),
    nullif(business_row.postal_code, '')
  );

  business_keywords := array_remove(
    array[
      business_row.name,
      business_row.category,
      business_row.city,
      business_row.region,
      business_row.postal_code,
      business_row.country_code,
      business_row.service_area_mode,
      'local business',
      'company',
      'service'
    ] || coalesce(business_row.service_areas, '{}'::text[]),
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
    'businesses',
    'company',
    business_row.id,
    null,
    null,
    business_row.owner_id,
    left(business_row.name, 300),
    left(
      concat_ws(
        ' · ',
        business_row.category,
        nullif(location_summary, ''),
        case
          when business_row.verification_status = 'verified'
            then 'Verified business'
          else null
        end
      ),
      2000
    ),
    left(coalesce(business_row.description, ''), 20000),
    business_keywords,
    '/businesses/' || business_row.slug,
    'public',
    'active',
    case when business_row.verification_status = 'verified' then 10 else 0 end,
    jsonb_strip_nulls(jsonb_build_object(
      'businessId', business_row.id,
      'slug', business_row.slug,
      'category', business_row.category,
      'city', business_row.city,
      'region', business_row.region,
      'postalCode', business_row.postal_code,
      'countryCode', business_row.country_code,
      'serviceAreaMode', business_row.service_area_mode,
      'serviceRadiusMiles', business_row.service_radius_miles,
      'serviceAreas', business_row.service_areas,
      'verificationStatus', business_row.verification_status
    )),
    business_row.created_at,
    business_row.updated_at
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

  delete from public.loombus_search_documents document
  where document.source_table = 'business_services'
    and document.parent_id = business_row.id
    and not exists (
      select 1
      from public.business_services service
      where service.id = document.entity_id
        and service.business_id = business_row.id
        and service.status = 'active'
    );

  for service_row in
    select *
    from public.business_services service
    where service.business_id = business_row.id
      and service.status = 'active'
    order by service.sort_order, service.created_at
  loop
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
      'business_services',
      'service',
      service_row.id,
      business_row.id,
      null,
      business_row.owner_id,
      left(service_row.name, 300),
      left(
        concat_ws(
          ' · ',
          business_row.name,
          nullif(service_row.category, ''),
          business_row.category,
          nullif(location_summary, ''),
          nullif(service_row.service_area, ''),
          nullif(service_row.price_text, '')
        ),
        2000
      ),
      left(
        concat_ws(
          E'\n\n',
          nullif(service_row.description, ''),
          nullif(business_row.description, '')
        ),
        20000
      ),
      array_remove(
        array[
          service_row.name,
          service_row.category,
          service_row.service_area,
          business_row.name,
          business_row.category,
          business_row.city,
          business_row.region,
          business_row.postal_code,
          'local service',
          'business service'
        ] || coalesce(business_row.service_areas, '{}'::text[]),
        null
      ),
      '/businesses/' || business_row.slug,
      'public',
      'active',
      case when business_row.verification_status = 'verified' then 10 else 0 end,
      jsonb_strip_nulls(jsonb_build_object(
        'businessId', business_row.id,
        'businessName', business_row.name,
        'businessSlug', business_row.slug,
        'serviceId', service_row.id,
        'serviceCategory', service_row.category,
        'businessCategory', business_row.category,
        'priceText', service_row.price_text,
        'serviceArea', service_row.service_area,
        'city', business_row.city,
        'region', business_row.region,
        'postalCode', business_row.postal_code,
        'verificationStatus', business_row.verification_status
      )),
      service_row.created_at,
      greatest(service_row.updated_at, business_row.updated_at)
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
  end loop;
end;
$$;

create or replace function public.sync_local_business_search()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_business_id uuid;
begin
  if tg_table_name = 'businesses' then
    target_business_id := case
      when tg_op = 'DELETE' then old.id
      else new.id
    end;
  else
    target_business_id := case
      when tg_op = 'DELETE' then old.business_id
      else new.business_id
    end;
  end if;

  perform public.index_local_business_search(target_business_id);

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_local_business_search_businesses
  on public.businesses;
create trigger sync_local_business_search_businesses
after insert or update or delete on public.businesses
for each row execute function public.sync_local_business_search();

drop trigger if exists sync_local_business_search_services
  on public.business_services;
create trigger sync_local_business_search_services
after insert or update or delete on public.business_services
for each row execute function public.sync_local_business_search();

do $$
declare
  business_id uuid;
begin
  for business_id in
    select business.id
    from public.businesses business
  loop
    perform public.index_local_business_search(business_id);
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
  'b8511c1e-3bb9-4d63-b5f2-c7b6b5f9ab22'::uuid,
  'Local Business and Services',
  'Browse approved local businesses, service areas, and current offerings.',
  'A signal-first Loombus directory with ownership claims, verification, service listings, and reporting.',
  array[
    'business directory',
    'local business',
    'services',
    'companies',
    'contractors',
    'dentists',
    'roofing',
    'business profiles'
  ],
  '/businesses',
  'public',
  'active',
  0,
  jsonb_build_object('category', 'Real-world action'),
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

revoke all on function public.index_local_business_search(uuid)
  from public, anon, authenticated;
revoke all on function public.sync_local_business_search()
  from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
