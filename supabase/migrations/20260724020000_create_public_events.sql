-- Public Events, responses, reports, and private Room event responses.

begin;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.public_events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  organizer_id uuid not null references public.profiles(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete set null,
  title text not null,
  description text not null,
  category text not null,
  event_format text not null default 'in_person',
  venue_name text,
  address_line1 text,
  address_line2 text,
  city text,
  region text,
  postal_code text,
  country_code text not null default 'US',
  online_url text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  timezone text not null default 'UTC',
  capacity integer,
  is_free boolean not null default true,
  price_text text,
  registration_url text,
  status text not null default 'pending',
  moderation_reason text,
  published_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint public_events_format_check
    check (event_format in ('in_person', 'online', 'hybrid')),
  constraint public_events_status_check
    check (status in ('pending', 'published', 'rejected', 'cancelled', 'completed', 'removed')),
  constraint public_events_time_check
    check (ends_at is null or ends_at > starts_at),
  constraint public_events_capacity_check
    check (capacity is null or (capacity >= 1 and capacity <= 1000000)),
  constraint public_events_country_code_check
    check (country_code ~ '^[A-Z]{2}$')
);

create index if not exists public_events_public_starts_idx
  on public.public_events (status, starts_at);
create index if not exists public_events_organizer_updated_idx
  on public.public_events (organizer_id, updated_at desc);
create index if not exists public_events_business_starts_idx
  on public.public_events (business_id, starts_at)
  where business_id is not null;
create index if not exists public_events_category_starts_idx
  on public.public_events (category, starts_at);

create table if not exists public.public_event_rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.public_events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  response text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint public_event_rsvps_response_check
    check (response in ('going', 'interested')),
  constraint public_event_rsvps_unique unique (event_id, user_id)
);

create index if not exists public_event_rsvps_event_response_idx
  on public.public_event_rsvps (event_id, response);
create index if not exists public_event_rsvps_user_created_idx
  on public.public_event_rsvps (user_id, created_at desc);

create or replace function public.set_public_event_rsvp(
  target_event_id uuid,
  target_user_id uuid,
  target_response text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  target_event public.public_events%rowtype;
  going_total integer;
begin
  if target_response not in ('going', 'interested', 'none') then
    raise exception 'INVALID_EVENT_RESPONSE';
  end if;

  select *
  into target_event
  from public.public_events
  where id = target_event_id
  for update;

  if target_event.id is null
    or target_event.status <> 'published'
    or target_event.starts_at <= now() then
    raise exception 'EVENT_RESPONSE_CLOSED';
  end if;

  if target_response = 'none' then
    delete from public.public_event_rsvps
    where event_id = target_event_id
      and user_id = target_user_id;
    return null;
  end if;

  if target_response = 'going' and target_event.capacity is not null then
    select count(*)::integer
    into going_total
    from public.public_event_rsvps
    where event_id = target_event_id
      and response = 'going'
      and user_id <> target_user_id;

    if going_total >= target_event.capacity then
      raise exception 'EVENT_CAPACITY_REACHED';
    end if;
  end if;

  insert into public.public_event_rsvps (
    event_id,
    user_id,
    response
  ) values (
    target_event_id,
    target_user_id,
    target_response
  )
  on conflict (event_id, user_id)
  do update set response = excluded.response;

  return target_response;
end;
$$;

create table if not exists public.public_event_reports (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.public_events(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  details text not null,
  status text not null default 'open',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint public_event_reports_status_check
    check (status in ('open', 'resolved', 'dismissed'))
);

create unique index if not exists public_event_reports_one_open_per_user_idx
  on public.public_event_reports (event_id, reporter_id)
  where status = 'open';

create index if not exists public_event_reports_status_created_idx
  on public.public_event_reports (status, created_at desc);
create index if not exists public_event_reports_reporter_created_idx
  on public.public_event_reports (reporter_id, created_at desc);

create table if not exists public.room_event_rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.room_events(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  response text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint room_event_rsvps_response_check
    check (response in ('going', 'interested')),
  constraint room_event_rsvps_unique unique (event_id, user_id)
);

create index if not exists room_event_rsvps_room_event_idx
  on public.room_event_rsvps (room_id, event_id, response);
create index if not exists room_event_rsvps_user_created_idx
  on public.room_event_rsvps (user_id, created_at desc);

create or replace function public.touch_events_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_public_events_updated_at on public.public_events;
create trigger touch_public_events_updated_at
before update on public.public_events
for each row execute function public.touch_events_updated_at();

drop trigger if exists touch_public_event_rsvps_updated_at on public.public_event_rsvps;
create trigger touch_public_event_rsvps_updated_at
before update on public.public_event_rsvps
for each row execute function public.touch_events_updated_at();

drop trigger if exists touch_public_event_reports_updated_at on public.public_event_reports;
create trigger touch_public_event_reports_updated_at
before update on public.public_event_reports
for each row execute function public.touch_events_updated_at();

drop trigger if exists touch_room_event_rsvps_updated_at on public.room_event_rsvps;
create trigger touch_room_event_rsvps_updated_at
before update on public.room_event_rsvps
for each row execute function public.touch_events_updated_at();

alter table public.public_events enable row level security;
alter table public.public_event_rsvps enable row level security;
alter table public.public_event_reports enable row level security;
alter table public.room_event_rsvps enable row level security;

revoke all on table public.public_events from public, anon, authenticated;
revoke all on table public.public_event_rsvps from public, anon, authenticated;
revoke all on table public.public_event_reports from public, anon, authenticated;
revoke all on table public.room_event_rsvps from public, anon, authenticated;

grant all on table public.public_events to service_role;
grant all on table public.public_event_rsvps to service_role;
grant all on table public.public_event_reports to service_role;
grant all on table public.room_event_rsvps to service_role;

revoke all on function public.touch_events_updated_at()
  from public, anon, authenticated;
revoke all on function public.set_public_event_rsvp(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.touch_events_updated_at()
  to service_role;
grant execute on function public.set_public_event_rsvp(uuid, uuid, text)
  to service_role;

commit;
