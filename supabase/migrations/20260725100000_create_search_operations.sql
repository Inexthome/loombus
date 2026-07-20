-- Search Operations and Index Health: protected diagnostics and source-owned repair controls.

begin;

create or replace function public.index_public_event_search_document(
  target_event_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  event_row public.public_events%rowtype;
begin
  select * into event_row
  from public.public_events event
  where event.id = target_event_id;

  if event_row.id is null or event_row.status <> 'published' then
    delete from public.loombus_search_documents
    where source_table = 'public_events'
      and entity_id = target_event_id;
    return;
  end if;

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
  ) values (
    'public_events',
    'event',
    event_row.id,
    event_row.title,
    left(event_row.description, 500),
    event_row.description,
    array_remove(array[
      event_row.category,
      replace(event_row.event_format, '_', ' '),
      event_row.venue_name,
      event_row.city,
      event_row.region,
      'events',
      'calendar'
    ], null),
    '/events/' || event_row.slug,
    'public',
    'active',
    0,
    jsonb_build_object(
      'category', 'Events',
      'event_category', event_row.category,
      'event_format', event_row.event_format,
      'starts_at', event_row.starts_at,
      'city', event_row.city,
      'region', event_row.region,
      'business_id', event_row.business_id
    ),
    event_row.created_at,
    event_row.updated_at
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
    signal_score = 0,
    metadata = excluded.metadata,
    source_created_at = excluded.source_created_at,
    source_updated_at = excluded.source_updated_at,
    updated_at = now();
end;
$$;

create or replace function public.sync_public_event_search_document()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.index_public_event_search_document(
    case when tg_op = 'DELETE' then old.id else new.id end
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.index_service_request_search_document(
  target_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row public.service_requests%rowtype;
  requester_profile public.profiles%rowtype;
  requester_sensitive public.profile_sensitive%rowtype;
  attributed_business public.businesses%rowtype;
  requester_allowed boolean := false;
begin
  select * into request_row
  from public.service_requests request
  where request.id = target_request_id;

  if request_row.id is null then
    delete from public.loombus_search_documents
    where source_table = 'service_requests'
      and entity_id = target_request_id;
    return;
  end if;

  select * into requester_profile
  from public.profiles
  where id = request_row.requester_id;

  select * into requester_sensitive
  from public.profile_sensitive
  where id = request_row.requester_id;

  requester_allowed := requester_profile.id is not null
    and coalesce(requester_profile.account_status, 'active') not in ('suspended', 'banned', 'deleted')
    and coalesce(requester_sensitive.age_band, 'unknown') not in ('unknown', 'under_13')
    and coalesce(requester_sensitive.guardian_required, false) = false;

  if request_row.business_id is not null then
    select * into attributed_business
    from public.businesses
    where id = request_row.business_id;
    requester_allowed := requester_allowed
      and attributed_business.id is not null
      and attributed_business.status = 'published'
      and attributed_business.owner_id = request_row.requester_id;
  end if;

  if request_row.status = 'open'
    and requester_allowed
    and (request_row.deadline is null or request_row.deadline > now()) then
    insert into public.loombus_search_documents (
      source_table,
      entity_type,
      entity_id,
      title,
      summary,
      body,
      keywords,
      href,
      owner_id,
      visibility,
      status,
      signal_score,
      metadata,
      source_created_at,
      source_updated_at
    ) values (
      'service_requests',
      'request',
      request_row.id,
      request_row.title,
      left(request_row.description, 500),
      request_row.description,
      array_remove(array[
        request_row.request_type,
        replace(request_row.request_type, '_', ' '),
        request_row.category,
        request_row.urgency,
        replace(request_row.service_mode, '_', ' '),
        request_row.city,
        request_row.region,
        request_row.postal_code,
        'requests',
        'services'
      ], null) || coalesce(request_row.tags, '{}'),
      '/requests/' || request_row.slug,
      request_row.requester_id,
      'public',
      'active',
      0,
      jsonb_build_object(
        'category', 'Requests',
        'request_type', request_row.request_type,
        'request_category', request_row.category,
        'urgency', request_row.urgency,
        'service_mode', request_row.service_mode,
        'city', request_row.city,
        'region', request_row.region,
        'business_id', request_row.business_id,
        'deadline', request_row.deadline
      ),
      request_row.created_at,
      request_row.updated_at
    )
    on conflict (source_table, entity_id)
    do update set
      title = excluded.title,
      summary = excluded.summary,
      body = excluded.body,
      keywords = excluded.keywords,
      href = excluded.href,
      owner_id = excluded.owner_id,
      visibility = excluded.visibility,
      status = excluded.status,
      signal_score = 0,
      metadata = excluded.metadata,
      source_created_at = excluded.source_created_at,
      source_updated_at = excluded.source_updated_at,
      updated_at = now();
  else
    delete from public.loombus_search_documents
    where source_table = 'service_requests'
      and entity_id = request_row.id;
  end if;
end;
$$;

create or replace function public.sync_service_request_search_document()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.index_service_request_search_document(
    case when tg_op = 'DELETE' then old.id else new.id end
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.index_provider_service_search_document(
  target_service_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  service_row public.provider_services%rowtype;
  provider_profile public.profiles%rowtype;
  provider_sensitive public.profile_sensitive%rowtype;
  attributed_business public.businesses%rowtype;
  appointment_service public.business_appointment_services%rowtype;
  provider_allowed boolean := false;
begin
  select * into service_row
  from public.provider_services service
  where service.id = target_service_id;

  if service_row.id is null then
    delete from public.loombus_search_documents
    where source_table = 'provider_services'
      and entity_id = target_service_id;
    return;
  end if;

  select * into provider_profile
  from public.profiles
  where id = service_row.provider_id;

  select * into provider_sensitive
  from public.profile_sensitive
  where id = service_row.provider_id;

  provider_allowed := provider_profile.id is not null
    and coalesce(provider_profile.account_status, 'active') not in ('suspended', 'banned', 'deleted')
    and coalesce(provider_sensitive.age_band, 'unknown') not in ('unknown', 'under_13')
    and coalesce(provider_sensitive.guardian_required, false) = false;

  if service_row.business_id is not null then
    select * into attributed_business
    from public.businesses
    where id = service_row.business_id;
    provider_allowed := provider_allowed
      and attributed_business.id is not null
      and attributed_business.status = 'published'
      and attributed_business.owner_id = service_row.provider_id;
  end if;

  if service_row.appointment_service_id is not null then
    select * into appointment_service
    from public.business_appointment_services
    where id = service_row.appointment_service_id;
    provider_allowed := provider_allowed
      and appointment_service.id is not null
      and appointment_service.status = 'active'
      and appointment_service.owner_id = service_row.provider_id
      and service_row.business_id is not null
      and appointment_service.business_id = service_row.business_id;
  end if;

  if service_row.status = 'published' and provider_allowed then
    insert into public.loombus_search_documents (
      source_table,
      entity_type,
      entity_id,
      title,
      summary,
      body,
      keywords,
      href,
      owner_id,
      visibility,
      status,
      signal_score,
      metadata,
      source_created_at,
      source_updated_at
    ) values (
      'provider_services',
      'service',
      service_row.id,
      service_row.title,
      left(service_row.description, 500),
      service_row.description,
      array_remove(array[
        service_row.category,
        replace(service_row.service_mode, '_', ' '),
        replace(service_row.price_type, '_', ' '),
        service_row.city,
        service_row.region,
        service_row.postal_code,
        'services',
        'provider',
        'appointments',
        'requests'
      ], null) || coalesce(service_row.specialties, '{}'),
      '/services/' || service_row.slug,
      service_row.provider_id,
      'public',
      'active',
      0,
      jsonb_build_object(
        'category', 'Services',
        'service_category', service_row.category,
        'service_mode', service_row.service_mode,
        'price_type', service_row.price_type,
        'city', service_row.city,
        'region', service_row.region,
        'business_id', service_row.business_id,
        'appointment_service_id', service_row.appointment_service_id
      ),
      service_row.created_at,
      service_row.updated_at
    )
    on conflict (source_table, entity_id)
    do update set
      title = excluded.title,
      summary = excluded.summary,
      body = excluded.body,
      keywords = excluded.keywords,
      href = excluded.href,
      owner_id = excluded.owner_id,
      visibility = excluded.visibility,
      status = excluded.status,
      signal_score = 0,
      metadata = excluded.metadata,
      source_created_at = excluded.source_created_at,
      source_updated_at = excluded.source_updated_at,
      updated_at = now();
  else
    delete from public.loombus_search_documents
    where source_table = 'provider_services'
      and entity_id = service_row.id;
  end if;
end;
$$;

create or replace function public.sync_provider_service_search_document()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.index_provider_service_search_document(
    case when tg_op = 'DELETE' then old.id else new.id end
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.admin_rebuild_loombus_search_source(
  target_source_table text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_source text := lower(trim(coalesce(target_source_table, '')));
  payload jsonb;
  target_id uuid;
  processed_count integer := 0;
  removed_count integer := 0;
  before_count integer := 0;
  after_count integer := 0;
  row_count_value integer := 0;
  foundation_sources constant text[] := array[
    'discussions',
    'replies',
    'discussion_summaries',
    'discussion_attachments',
    'profiles',
    'rooms',
    'room_posts',
    'room_announcements',
    'room_events',
    'room_module_records',
    'room_resources'
  ];
begin
  if normalized_source = '' or normalized_source = 'platform_pages' then
    raise exception 'This Search source cannot be rebuilt from an owning table.';
  end if;

  if not (
    normalized_source = any(foundation_sources)
    or normalized_source in (
      'businesses',
      'business_services',
      'job_postings',
      'marketplace_listings',
      'public_events',
      'service_requests',
      'provider_services'
    )
  ) then
    raise exception 'Unsupported Search source: %', normalized_source;
  end if;

  perform pg_advisory_xact_lock(hashtext('loombus-search-rebuild:' || normalized_source));

  if normalized_source in ('businesses', 'business_services') then
    select count(*) into before_count
    from public.loombus_search_documents
    where source_table in ('businesses', 'business_services');
  else
    select count(*) into before_count
    from public.loombus_search_documents
    where source_table = normalized_source;
  end if;

  if normalized_source = any(foundation_sources) then
    for payload in execute format(
      'select to_jsonb(source) from public.%I source',
      normalized_source
    ) loop
      perform public.index_loombus_search_payload(normalized_source, payload);
      processed_count := processed_count + 1;
    end loop;

    execute format(
      'delete from public.loombus_search_documents document
       where document.source_table = %L
         and not exists (
           select 1 from public.%I source where source.id = document.entity_id
         )',
      normalized_source,
      normalized_source
    );
    get diagnostics removed_count = row_count;

  elsif normalized_source in ('businesses', 'business_services') then
    for target_id in select business.id from public.businesses business loop
      perform public.index_local_business_search(target_id);
      processed_count := processed_count + 1;
    end loop;

    delete from public.loombus_search_documents document
    where document.source_table = 'businesses'
      and not exists (
        select 1 from public.businesses business where business.id = document.entity_id
      );
    get diagnostics row_count_value = row_count;
    removed_count := removed_count + row_count_value;

    delete from public.loombus_search_documents document
    where document.source_table = 'business_services'
      and not exists (
        select 1 from public.business_services service where service.id = document.entity_id
      );
    get diagnostics row_count_value = row_count;
    removed_count := removed_count + row_count_value;

  elsif normalized_source = 'job_postings' then
    for target_id in select job.id from public.job_postings job loop
      perform public.index_local_job_search(target_id);
      processed_count := processed_count + 1;
    end loop;
    delete from public.loombus_search_documents document
    where document.source_table = normalized_source
      and not exists (
        select 1 from public.job_postings source where source.id = document.entity_id
      );
    get diagnostics removed_count = row_count;

  elsif normalized_source = 'marketplace_listings' then
    for target_id in select listing.id from public.marketplace_listings listing loop
      perform public.index_marketplace_listing_search(target_id);
      processed_count := processed_count + 1;
    end loop;
    delete from public.loombus_search_documents document
    where document.source_table = normalized_source
      and not exists (
        select 1 from public.marketplace_listings source where source.id = document.entity_id
      );
    get diagnostics removed_count = row_count;

  elsif normalized_source = 'public_events' then
    for target_id in select event.id from public.public_events event loop
      perform public.index_public_event_search_document(target_id);
      processed_count := processed_count + 1;
    end loop;
    delete from public.loombus_search_documents document
    where document.source_table = normalized_source
      and not exists (
        select 1 from public.public_events source where source.id = document.entity_id
      );
    get diagnostics removed_count = row_count;

  elsif normalized_source = 'service_requests' then
    for target_id in select request.id from public.service_requests request loop
      perform public.index_service_request_search_document(target_id);
      processed_count := processed_count + 1;
    end loop;
    delete from public.loombus_search_documents document
    where document.source_table = normalized_source
      and not exists (
        select 1 from public.service_requests source where source.id = document.entity_id
      );
    get diagnostics removed_count = row_count;

  elsif normalized_source = 'provider_services' then
    for target_id in select service.id from public.provider_services service loop
      perform public.index_provider_service_search_document(target_id);
      processed_count := processed_count + 1;
    end loop;
    delete from public.loombus_search_documents document
    where document.source_table = normalized_source
      and not exists (
        select 1 from public.provider_services source where source.id = document.entity_id
      );
    get diagnostics removed_count = row_count;
  end if;

  if normalized_source in ('businesses', 'business_services') then
    select count(*) into after_count
    from public.loombus_search_documents
    where source_table in ('businesses', 'business_services');
  else
    select count(*) into after_count
    from public.loombus_search_documents
    where source_table = normalized_source;
  end if;

  return jsonb_build_object(
    'sourceTable', normalized_source,
    'processed', processed_count,
    'removedOrphans', removed_count,
    'beforeCount', before_count,
    'afterCount', after_count,
    'completedAt', now()
  );
end;
$$;

create or replace function public.admin_repair_loombus_search_document(
  target_source_table text,
  target_entity_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_source text := lower(trim(coalesce(target_source_table, '')));
  payload jsonb;
  parent_business_id uuid;
  indexed boolean := false;
  foundation_sources constant text[] := array[
    'discussions',
    'replies',
    'discussion_summaries',
    'discussion_attachments',
    'profiles',
    'rooms',
    'room_posts',
    'room_announcements',
    'room_events',
    'room_module_records',
    'room_resources'
  ];
begin
  if target_entity_id is null then
    raise exception 'A Search entity id is required.';
  end if;

  if normalized_source = '' or normalized_source = 'platform_pages' then
    raise exception 'This Search record cannot be repaired from an owning table.';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('loombus-search-repair:' || normalized_source || ':' || target_entity_id::text)
  );

  if normalized_source = any(foundation_sources) then
    execute format(
      'select to_jsonb(source) from public.%I source where source.id = $1',
      normalized_source
    ) into payload using target_entity_id;

    if payload is null then
      delete from public.loombus_search_documents
      where source_table = normalized_source
        and entity_id = target_entity_id;
    else
      perform public.index_loombus_search_payload(normalized_source, payload);
    end if;

  elsif normalized_source = 'businesses' then
    perform public.index_local_business_search(target_entity_id);

  elsif normalized_source = 'business_services' then
    select service.business_id into parent_business_id
    from public.business_services service
    where service.id = target_entity_id;

    if parent_business_id is null then
      delete from public.loombus_search_documents
      where source_table = normalized_source
        and entity_id = target_entity_id;
    else
      perform public.index_local_business_search(parent_business_id);
    end if;

  elsif normalized_source = 'job_postings' then
    perform public.index_local_job_search(target_entity_id);

  elsif normalized_source = 'marketplace_listings' then
    perform public.index_marketplace_listing_search(target_entity_id);

  elsif normalized_source = 'public_events' then
    perform public.index_public_event_search_document(target_entity_id);

  elsif normalized_source = 'service_requests' then
    perform public.index_service_request_search_document(target_entity_id);

  elsif normalized_source = 'provider_services' then
    perform public.index_provider_service_search_document(target_entity_id);

  else
    raise exception 'Unsupported Search source: %', normalized_source;
  end if;

  select exists(
    select 1
    from public.loombus_search_documents document
    where document.source_table = normalized_source
      and document.entity_id = target_entity_id
  ) into indexed;

  return jsonb_build_object(
    'sourceTable', normalized_source,
    'entityId', target_entity_id,
    'result', case when indexed then 'indexed' else 'removed' end,
    'completedAt', now()
  );
end;
$$;

create or replace function public.admin_loombus_search_health()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with known_sources(source_table, repair_available) as (
  values
    ('discussions', true),
    ('replies', true),
    ('discussion_summaries', true),
    ('discussion_attachments', true),
    ('profiles', true),
    ('rooms', true),
    ('room_posts', true),
    ('room_announcements', true),
    ('room_events', true),
    ('room_module_records', true),
    ('room_resources', true),
    ('businesses', true),
    ('business_services', true),
    ('job_postings', true),
    ('marketplace_listings', true),
    ('public_events', true),
    ('service_requests', true),
    ('provider_services', true),
    ('platform_pages', false)
),
source_entities(source_table, entity_id) as (
  select 'discussions', id from public.discussions
  union all select 'replies', id from public.replies
  union all select 'discussion_summaries', id from public.discussion_summaries
  union all select 'discussion_attachments', id from public.discussion_attachments
  union all select 'profiles', id from public.profiles
  union all select 'rooms', id from public.rooms
  union all select 'room_posts', id from public.room_posts
  union all select 'room_announcements', id from public.room_announcements
  union all select 'room_events', id from public.room_events
  union all select 'room_module_records', id from public.room_module_records
  union all select 'room_resources', id from public.room_resources
  union all select 'businesses', id from public.businesses
  union all select 'business_services', id from public.business_services
  union all select 'job_postings', id from public.job_postings
  union all select 'marketplace_listings', id from public.marketplace_listings
  union all select 'public_events', id from public.public_events
  union all select 'service_requests', id from public.service_requests
  union all select 'provider_services', id from public.provider_services
  union all
    select 'platform_pages', entity_id
    from public.loombus_search_documents
    where source_table = 'platform_pages'
),
flagged as (
  select
    document.id,
    document.source_table,
    document.entity_type,
    document.entity_id,
    document.visibility,
    document.status,
    document.href,
    document.source_updated_at,
    document.updated_at,
    coalesce(known.repair_available, false) as repair_available,
    known.source_table is null as unregistered_source,
    known.source_table is not null
      and document.source_table <> 'platform_pages'
      and source.entity_id is null as orphaned,
    document.source_updated_at is null as source_timestamp_missing,
    document.source_updated_at is not null
      and document.updated_at + interval '5 minutes' < document.source_updated_at as index_lagging,
    document.href !~ '^/' as invalid_href,
    document.search_vector = ''::tsvector as empty_vector,
    coalesce(document.source_updated_at, document.updated_at) < now() - interval '30 days'
      as stale_30_days
  from public.loombus_search_documents document
  left join known_sources known
    on known.source_table = document.source_table
  left join source_entities source
    on source.source_table = document.source_table
   and source.entity_id = document.entity_id
),
with_attention as (
  select
    flagged.*,
    (
      flagged.unregistered_source
      or flagged.orphaned
      or flagged.source_timestamp_missing
      or flagged.index_lagging
      or flagged.invalid_href
      or flagged.empty_vector
    ) as attention
  from flagged
),
source_stats as (
  select
    source_table,
    count(*)::integer as total,
    count(*) filter (where visibility = 'public' and status = 'active')::integer as active_public,
    count(*) filter (where visibility <> 'public')::integer as restricted,
    count(*) filter (where status = 'archived')::integer as archived,
    count(*) filter (where attention)::integer as attention,
    count(*) filter (where stale_30_days)::integer as stale_30_days,
    count(*) filter (where orphaned)::integer as orphaned,
    count(*) filter (where index_lagging)::integer as index_lagging,
    count(*) filter (where source_timestamp_missing)::integer as missing_source_timestamp,
    count(*) filter (where invalid_href)::integer as invalid_href,
    count(*) filter (where empty_vector)::integer as empty_vector,
    bool_or(repair_available) as repair_available,
    max(source_updated_at) as last_source_updated_at,
    max(updated_at) as last_indexed_at
  from with_attention
  group by source_table
),
issue_rows as (
  select *
  from with_attention
  where attention
  order by updated_at asc, source_table, entity_id
  limit 200
)
select jsonb_build_object(
  'generatedAt', now(),
  'metrics', jsonb_build_object(
    'totalDocuments', (select count(*) from with_attention),
    'activePublic', (select count(*) from with_attention where visibility = 'public' and status = 'active'),
    'restrictedDocuments', (select count(*) from with_attention where visibility <> 'public'),
    'sourceCount', (select count(distinct source_table) from with_attention),
    'attentionTotal', (select count(*) from with_attention where attention),
    'orphaned', (select count(*) from with_attention where orphaned),
    'indexLagging', (select count(*) from with_attention where index_lagging),
    'missingSourceTimestamp', (select count(*) from with_attention where source_timestamp_missing),
    'invalidHref', (select count(*) from with_attention where invalid_href),
    'emptyVector', (select count(*) from with_attention where empty_vector),
    'unregisteredSource', (select count(*) from with_attention where unregistered_source),
    'stale30Days', (select count(*) from with_attention where stale_30_days),
    'archived', (select count(*) from with_attention where status = 'archived')
  ),
  'visibility', jsonb_build_object(
    'public', (select count(*) from with_attention where visibility = 'public'),
    'authenticated', (select count(*) from with_attention where visibility = 'authenticated'),
    'premium', (select count(*) from with_attention where visibility = 'premium'),
    'member', (select count(*) from with_attention where visibility = 'member'),
    'private', (select count(*) from with_attention where visibility = 'private')
  ),
  'sources', coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'sourceTable', source_table,
        'total', total,
        'activePublic', active_public,
        'restricted', restricted,
        'archived', archived,
        'attention', attention,
        'stale30Days', stale_30_days,
        'orphaned', orphaned,
        'indexLagging', index_lagging,
        'missingSourceTimestamp', missing_source_timestamp,
        'invalidHref', invalid_href,
        'emptyVector', empty_vector,
        'repairAvailable', repair_available,
        'lastSourceUpdatedAt', last_source_updated_at,
        'lastIndexedAt', last_indexed_at
      ) order by attention desc, total desc, source_table
    )
    from source_stats
  ), '[]'::jsonb),
  'issues', coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'documentId', id,
        'sourceTable', source_table,
        'entityType', entity_type,
        'entityId', entity_id,
        'visibility', visibility,
        'status', status,
        'href', case when visibility in ('public', 'authenticated', 'premium') then href else null end,
        'sourceUpdatedAt', source_updated_at,
        'indexedAt', updated_at,
        'repairAvailable', repair_available,
        'issueCodes', array_remove(array[
          case when unregistered_source then 'unregistered_source' end,
          case when orphaned then 'orphaned_source' end,
          case when source_timestamp_missing then 'missing_source_timestamp' end,
          case when index_lagging then 'index_lagging' end,
          case when invalid_href then 'invalid_destination' end,
          case when empty_vector then 'empty_search_vector' end
        ], null)
      ) order by updated_at asc, source_table, entity_id
    )
    from issue_rows
  ), '[]'::jsonb),
  'boundaries', jsonb_build_object(
    'sourceRebuildAvailable', true,
    'documentRepairAvailable', true,
    'arbitraryDeleteAvailable', false,
    'visibilityMutationAvailable', false,
    'rankingMutationAvailable', false,
    'sourceContentMutationAvailable', false,
    'sourceOwnedEligibility', true,
    'privateContentLoaded', false,
    'publicSearchRouteUnchanged', true
  )
);
$$;

revoke all on function public.index_public_event_search_document(uuid)
  from public, anon, authenticated;
revoke all on function public.index_service_request_search_document(uuid)
  from public, anon, authenticated;
revoke all on function public.index_provider_service_search_document(uuid)
  from public, anon, authenticated;
revoke all on function public.admin_rebuild_loombus_search_source(text)
  from public, anon, authenticated;
revoke all on function public.admin_repair_loombus_search_document(text, uuid)
  from public, anon, authenticated;
revoke all on function public.admin_loombus_search_health()
  from public, anon, authenticated;

grant execute on function public.index_public_event_search_document(uuid)
  to service_role;
grant execute on function public.index_service_request_search_document(uuid)
  to service_role;
grant execute on function public.index_provider_service_search_document(uuid)
  to service_role;
grant execute on function public.admin_rebuild_loombus_search_source(text)
  to service_role;
grant execute on function public.admin_repair_loombus_search_document(text, uuid)
  to service_role;
grant execute on function public.admin_loombus_search_health()
  to service_role;

notify pgrst, 'reload schema';

commit;
