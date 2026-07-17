-- Events search documents, reminder de-duplication, and Room event notifications.

begin;

create table if not exists public.schedule_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_type text not null,
  source_id uuid not null,
  reminder_key text not null,
  delivered_at timestamptz not null default now(),
  constraint schedule_reminder_deliveries_source_check
    check (source_type in ('public_event', 'room_event', 'appointment')),
  constraint schedule_reminder_deliveries_unique
    unique (user_id, source_type, source_id, reminder_key)
);

create index if not exists schedule_reminder_deliveries_user_time_idx
  on public.schedule_reminder_deliveries (user_id, delivered_at desc);

alter table public.schedule_reminder_deliveries enable row level security;
revoke all on table public.schedule_reminder_deliveries
  from public, anon, authenticated;
grant all on table public.schedule_reminder_deliveries to service_role;

create or replace function public.sync_public_event_search_document()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.loombus_search_documents
    where source_table = 'public_events'
      and entity_id = old.id;
    return old;
  end if;

  if new.status = 'published' then
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
      new.id,
      new.title,
      left(new.description, 500),
      new.description,
      array_remove(array[
        new.category,
        replace(new.event_format, '_', ' '),
        new.venue_name,
        new.city,
        new.region,
        'events',
        'calendar'
      ], null),
      '/events/' || new.slug,
      'public',
      'active',
      0,
      jsonb_build_object(
        'category', 'Events',
        'event_category', new.category,
        'event_format', new.event_format,
        'starts_at', new.starts_at,
        'city', new.city,
        'region', new.region,
        'business_id', new.business_id
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
      visibility = excluded.visibility,
      status = excluded.status,
      signal_score = 0,
      metadata = excluded.metadata,
      source_updated_at = excluded.source_updated_at,
      updated_at = now();
  else
    delete from public.loombus_search_documents
    where source_table = 'public_events'
      and entity_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_public_event_search_document
  on public.public_events;
create trigger sync_public_event_search_document
after insert or update or delete on public.public_events
for each row execute function public.sync_public_event_search_document();

create or replace function public.notify_room_event_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (
    user_id,
    actor_id,
    type,
    target_type,
    target_id,
    message
  )
  select
    member.user_id,
    new.created_by,
    'room_event_created',
    'room',
    new.room_id,
    'A Room event was added: ' || new.title
  from public.room_members member
  where member.room_id = new.room_id
    and member.user_id <> new.created_by
    and coalesce(member.status, 'active') not in ('blocked', 'removed', 'inactive');

  return new;
end;
$$;

drop trigger if exists notify_room_event_created
  on public.room_events;
create trigger notify_room_event_created
after insert on public.room_events
for each row execute function public.notify_room_event_created();

revoke all on function public.sync_public_event_search_document()
  from public, anon, authenticated;
revoke all on function public.notify_room_event_created()
  from public, anon, authenticated;
grant execute on function public.sync_public_event_search_document()
  to service_role;
grant execute on function public.notify_room_event_created()
  to service_role;

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
    '59e8431f-0bb3-47cd-9b51-c4f3c61fcb01'::uuid,
    'Loombus Events',
    'Browse accountable public events and connect real-world dates to attributable organizers.',
    'Loombus Events provides chronological public event discovery, organizer attribution, Going and Interested responses, reports, and event management.',
    array['events', 'public events', 'calendar', 'things to do', 'community events', 'online events'],
    '/events',
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
    'd50450bc-c23f-4bfb-a345-8b28d9a001c8'::uuid,
    'My Loombus Calendar',
    'Review public Events, private Room dates, and Appointments in one personal calendar.',
    'The Loombus calendar combines saved public Events, private Room events, and appointment requests without exposing private Room context publicly.',
    array['calendar', 'my calendar', 'schedule', 'room calendar', 'event calendar', 'appointments'],
    '/calendar',
    'authenticated',
    'active',
    0,
    jsonb_build_object('category', 'Activity'),
    now(),
    now()
  ),
  (
    'platform_pages',
    'page',
    '95ec0fed-ac1c-49d5-949a-b34b4026e5b8'::uuid,
    'Loombus Appointments',
    'Manage business appointment services and explicit appointment requests.',
    'Businesses define appointment services. Members propose times. Providers accept, decline, or suggest another time before an appointment becomes confirmed.',
    array['appointments', 'business appointments', 'schedule service', 'request appointment', 'booking'],
    '/appointments',
    'authenticated',
    'active',
    0,
    jsonb_build_object('category', 'Real-world'),
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
select
  'public_events',
  'event',
  event.id,
  event.title,
  left(event.description, 500),
  event.description,
  array_remove(array[
    event.category,
    replace(event.event_format, '_', ' '),
    event.venue_name,
    event.city,
    event.region,
    'events',
    'calendar'
  ], null),
  '/events/' || event.slug,
  'public',
  'active',
  0,
  jsonb_build_object(
    'category', 'Events',
    'event_category', event.category,
    'event_format', event.event_format,
    'starts_at', event.starts_at,
    'city', event.city,
    'region', event.region,
    'business_id', event.business_id
  ),
  event.created_at,
  event.updated_at
from public.public_events event
where event.status = 'published'
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
  source_updated_at = excluded.source_updated_at,
  updated_at = now();

commit;
