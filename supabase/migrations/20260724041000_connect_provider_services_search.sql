-- Connect public Services to Everything Search and add platform navigation records.

begin;

create or replace function public.sync_provider_service_search_document()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  provider_profile public.profiles%rowtype;
  provider_sensitive public.profile_sensitive%rowtype;
  attributed_business public.businesses%rowtype;
  appointment_service public.business_appointment_services%rowtype;
  provider_allowed boolean := false;
begin
  if tg_op = 'DELETE' then
    delete from public.loombus_search_documents
    where source_table = 'provider_services'
      and entity_id = old.id;
    return old;
  end if;

  select * into provider_profile
  from public.profiles
  where id = new.provider_id;

  select * into provider_sensitive
  from public.profile_sensitive
  where id = new.provider_id;

  provider_allowed := provider_profile.id is not null
    and coalesce(provider_profile.account_status, 'active') not in ('suspended', 'banned', 'deleted')
    and coalesce(provider_sensitive.age_band, 'unknown') not in ('unknown', 'under_13')
    and coalesce(provider_sensitive.guardian_required, false) = false;

  if new.business_id is not null then
    select * into attributed_business
    from public.businesses
    where id = new.business_id;
    provider_allowed := provider_allowed
      and attributed_business.id is not null
      and attributed_business.status = 'published'
      and attributed_business.owner_id = new.provider_id;
  end if;

  if new.appointment_service_id is not null then
    select * into appointment_service
    from public.business_appointment_services
    where id = new.appointment_service_id;
    provider_allowed := provider_allowed
      and appointment_service.id is not null
      and appointment_service.status = 'active'
      and appointment_service.owner_id = new.provider_id
      and new.business_id is not null
      and appointment_service.business_id = new.business_id;
  end if;

  if new.status = 'published' and provider_allowed then
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
      new.id,
      new.title,
      left(new.description, 500),
      new.description,
      array_remove(array[
        new.category,
        replace(new.service_mode, '_', ' '),
        replace(new.price_type, '_', ' '),
        new.city,
        new.region,
        new.postal_code,
        'services',
        'provider',
        'appointments',
        'requests'
      ], null) || coalesce(new.specialties, '{}'),
      '/services/' || new.slug,
      new.provider_id,
      'public',
      'active',
      0,
      jsonb_build_object(
        'category', 'Services',
        'service_category', new.category,
        'service_mode', new.service_mode,
        'price_type', new.price_type,
        'city', new.city,
        'region', new.region,
        'business_id', new.business_id,
        'appointment_service_id', new.appointment_service_id
      ),
      new.created_at,
      new.updated_at
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
      source_updated_at = excluded.source_updated_at,
      updated_at = now();
  else
    delete from public.loombus_search_documents
    where source_table = 'provider_services'
      and entity_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_provider_service_search_document
  on public.provider_services;
create trigger sync_provider_service_search_document
after insert or update or delete on public.provider_services
for each row execute function public.sync_provider_service_search_document();

revoke all on function public.sync_provider_service_search_document()
  from public, anon, authenticated;
grant execute on function public.sync_provider_service_search_document()
  to service_role;

insert into public.loombus_search_documents (
  source_table, entity_type, entity_id, title, summary, body, keywords,
  href, visibility, status, signal_score, metadata, source_created_at, source_updated_at
)
values
  (
    'platform_pages', 'page', '8e774a45-b086-48a0-aa61-e47e45b467ba'::uuid,
    'Loombus Services',
    'Discover attributable Services from members and businesses, then send structured inquiries or request appointments.',
    'Loombus Services is the supply side of Requests. Providers publish scope, location, price context, availability, examples, appointment connections, and accountable profile attribution.',
    array['services', 'service directory', 'local services', 'professional services', 'find provider', 'request appointment'],
    '/services', 'public', 'active', 0, jsonb_build_object('category', 'Real-world'), now(), now()
  ),
  (
    'platform_pages', 'page', 'd189c6ba-8e05-49be-b1b3-4e3eec58fd54'::uuid,
    'Manage Loombus Services',
    'Publish Services, review inquiries, connect appointments, and manage provider availability.',
    'The Services workspace manages provider listings, moderation, inquiries, private conversation acceptance, appointment connections, lifecycle, and reports.',
    array['manage services', 'publish service', 'service inquiries', 'provider workspace'],
    '/services/manage', 'authenticated', 'active', 0, jsonb_build_object('category', 'Activity'), now(), now()
  ),
  (
    'platform_pages', 'page', '4d1315d1-d83b-4d61-8691-64c2b93ef045'::uuid,
    'Saved Loombus Services',
    'Return to public Services you saved privately.',
    'Saved Services are private to the member account and may include Services that later pause, archive, or become unavailable.',
    array['saved services', 'service watchlist', 'bookmarked providers'],
    '/services/saved', 'authenticated', 'active', 0, jsonb_build_object('category', 'Activity'), now(), now()
  ),
  (
    'platform_pages', 'page', '2b4d8ab7-99d6-4d1d-b3f2-43c0a763347d'::uuid,
    'Services Safety',
    'Review safety, payment, identity, qualification, licensing, and privacy guidance for Loombus Services.',
    'Loombus does not process Service payments, provide escrow, verify professional licensing, guarantee credentials, perform background checks, or guarantee provider performance.',
    array['services safety', 'provider safety', 'service fraud', 'verify provider', 'payment safety'],
    '/services/safety', 'public', 'active', 0, jsonb_build_object('category', 'Safety'), now(), now()
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
  source_updated_at = now(),
  updated_at = now();

-- Backfill through the trigger so the same eligibility rules apply.
update public.provider_services
set updated_at = updated_at
where status = 'published';

commit;
