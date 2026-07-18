-- Connect public Requests to Everything Search and add platform navigation records.

begin;

create or replace function public.sync_service_request_search_document()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_profile public.profiles%rowtype;
  requester_sensitive public.profile_sensitive%rowtype;
  attributed_business public.businesses%rowtype;
  requester_allowed boolean := false;
begin
  if tg_op = 'DELETE' then
    delete from public.loombus_search_documents
    where source_table = 'service_requests'
      and entity_id = old.id;
    return old;
  end if;

  select * into requester_profile
  from public.profiles
  where id = new.requester_id;

  select * into requester_sensitive
  from public.profile_sensitive
  where id = new.requester_id;

  requester_allowed := requester_profile.id is not null
    and coalesce(requester_profile.account_status, 'active') not in ('suspended', 'banned', 'deleted')
    and coalesce(requester_sensitive.age_band, 'unknown') not in ('unknown', 'under_13')
    and coalesce(requester_sensitive.guardian_required, false) = false;

  if new.business_id is not null then
    select * into attributed_business
    from public.businesses
    where id = new.business_id;
    requester_allowed := requester_allowed
      and attributed_business.id is not null
      and attributed_business.status = 'published'
      and attributed_business.owner_id = new.requester_id;
  end if;

  if new.status = 'open'
    and requester_allowed
    and (new.deadline is null or new.deadline > now()) then
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
      new.id,
      new.title,
      left(new.description, 500),
      new.description,
      array_remove(array[
        new.request_type,
        replace(new.request_type, '_', ' '),
        new.category,
        new.urgency,
        replace(new.service_mode, '_', ' '),
        new.city,
        new.region,
        new.postal_code,
        'requests',
        'services'
      ], null) || coalesce(new.tags, '{}'),
      '/requests/' || new.slug,
      new.requester_id,
      'public',
      'active',
      0,
      jsonb_build_object(
        'category', 'Requests',
        'request_type', new.request_type,
        'request_category', new.category,
        'urgency', new.urgency,
        'service_mode', new.service_mode,
        'city', new.city,
        'region', new.region,
        'business_id', new.business_id,
        'deadline', new.deadline
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
    where source_table = 'service_requests'
      and entity_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_service_request_search_document on public.service_requests;
create trigger sync_service_request_search_document
after insert or update or delete on public.service_requests
for each row execute function public.sync_service_request_search_document();

revoke all on function public.sync_service_request_search_document() from public, anon, authenticated;
grant execute on function public.sync_service_request_search_document() to service_role;

insert into public.loombus_search_documents (
  source_table, entity_type, entity_id, title, summary, body, keywords,
  href, visibility, status, signal_score, metadata, source_created_at, source_updated_at
)
values
  (
    'platform_pages', 'page', '121eb02f-82fe-477b-9651-6d218fb29fd4'::uuid,
    'Loombus Requests',
    'State a need and reach attributable members or businesses that can help.',
    'Loombus Requests supports services, quotes, recommendations, consultations, community help, volunteer needs, and local problem solving with private response selection.',
    array['requests', 'service needed', 'quote request', 'recommendation', 'community help', 'consultation', 'local problem'],
    '/requests', 'public', 'active', 0, jsonb_build_object('category', 'Real-world'), now(), now()
  ),
  (
    'platform_pages', 'page', '8e2f8cad-8a8f-451f-9f23-e6eb7ac490d6'::uuid,
    'Manage Loombus Requests',
    'Create Requests, review responses, select help, and manage resolution.',
    'The Requests workspace manages public Request moderation, attributable responses, private conversation selection, lifecycle, and reports.',
    array['manage requests', 'create request', 'request responses', 'resolve request'],
    '/requests/manage', 'authenticated', 'active', 0, jsonb_build_object('category', 'Activity'), now(), now()
  ),
  (
    'platform_pages', 'page', 'bd88b52a-c937-44b7-bda9-b51430410d4d'::uuid,
    'Saved Loombus Requests',
    'Return to public Requests you saved privately.',
    'Saved Requests are private to the member account and may include Requests that later close or become unavailable.',
    array['saved requests', 'request watchlist', 'bookmarked requests'],
    '/requests/saved', 'authenticated', 'active', 0, jsonb_build_object('category', 'Activity'), now(), now()
  ),
  (
    'platform_pages', 'page', '09bcaa1a-0ea1-4987-bab4-621fb5472567'::uuid,
    'Requests Safety',
    'Review safety, payment, identity, qualification, and privacy guidance for Loombus Requests.',
    'Loombus does not process Request payments, verify professional licensing, guarantee credentials, or guarantee completion. Members must independently confirm material details.',
    array['requests safety', 'service safety', 'request fraud', 'verify provider', 'payment safety'],
    '/requests/safety', 'public', 'active', 0, jsonb_build_object('category', 'Safety'), now(), now()
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
update public.service_requests
set updated_at = updated_at
where status = 'open';

commit;
