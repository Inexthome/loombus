-- Connect Loombus Local Discovery destinations to Everything Search.

begin;

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
values
  (
    'platform_pages',
    'page',
    'cb78d0b5-58ef-4e93-b3c4-0df8f39bbb76'::uuid,
    'Loombus Local Discovery',
    'Search Businesses, Services, Events, Jobs, Marketplace listings, and Requests together by place, distance, date, and availability.',
    'Loombus Local is the list-first discovery layer across attributable real-world Loombus sources. It ranks by relevance, privacy-safe distance, availability, event time, and freshness without sponsored placement, follower-count ranking, or pay-to-rank boosts.',
    array[
      'local',
      'local discovery',
      'near me',
      'nearby',
      'businesses near me',
      'services near me',
      'events near me',
      'jobs near me',
      'marketplace near me',
      'requests near me',
      'remote services',
      'things to do'
    ],
    '/local',
    'public',
    'active',
    0,
    jsonb_build_object('category', 'Real-world'),
    now(),
    now()
  ),
  (
    'platform_pages',
    'page',
    '69ae0307-80e2-44e0-9f68-e22ab9b90802'::uuid,
    'Manage Local Discovery Areas',
    'Attach a privacy-safe approximate area to attributable public Loombus sources you control.',
    'Business locations may be inherited by connected Jobs, Services, Events, Requests, and Marketplace listings. Personal Marketplace and Request sources remain approximate. Public results return distance and area labels, never stored latitude or longitude.',
    array[
      'manage local',
      'local location',
      'distance search',
      'business location',
      'approximate location',
      'location privacy'
    ],
    '/local/manage',
    'authenticated',
    'active',
    0,
    jsonb_build_object('category', 'Activity'),
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
  signal_score = 0,
  metadata = excluded.metadata,
  source_updated_at = now(),
  updated_at = now();

commit;
