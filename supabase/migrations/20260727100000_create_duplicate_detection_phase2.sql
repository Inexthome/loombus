-- Phase 2 duplicate detection for Marketplace, Jobs, Events, Requests, and Services.

begin;

alter table public.duplicate_request_keys
  drop constraint if exists duplicate_request_kind_check;

alter table public.duplicate_request_keys
  add constraint duplicate_request_kind_check
  check (
    request_kind in (
      'discussion',
      'reply',
      'business',
      'marketplace',
      'job',
      'event',
      'request',
      'service'
    )
  );

alter table public.marketplace_listings
  add column if not exists submission_fingerprint text;

alter table public.job_postings
  add column if not exists submission_fingerprint text;

alter table public.public_events
  add column if not exists submission_fingerprint text;

alter table public.service_requests
  add column if not exists submission_fingerprint text;

alter table public.provider_services
  add column if not exists submission_fingerprint text;

create unique index if not exists marketplace_submission_fingerprint_unique_idx
  on public.marketplace_listings (submission_fingerprint)
  where submission_fingerprint is not null;

create unique index if not exists jobs_submission_fingerprint_unique_idx
  on public.job_postings (submission_fingerprint)
  where submission_fingerprint is not null;

create unique index if not exists events_submission_fingerprint_unique_idx
  on public.public_events (submission_fingerprint)
  where submission_fingerprint is not null;

create unique index if not exists requests_submission_fingerprint_unique_idx
  on public.service_requests (submission_fingerprint)
  where submission_fingerprint is not null;

create unique index if not exists services_submission_fingerprint_unique_idx
  on public.provider_services (submission_fingerprint)
  where submission_fingerprint is not null;

create or replace function public.normalize_duplicate_number(input_value numeric)
returns text
language sql
immutable
parallel safe
set search_path = public
as $$
  select case
    when input_value is null then ''
    else regexp_replace(
      regexp_replace(input_value::text, '(\.\d*?)0+$', '\1'),
      '\.$',
      ''
    )
  end;
$$;

create or replace function public.claim_duplicate_request(
  request_kind text,
  actor_user_id uuid,
  scope_key text default '',
  title_value text default '',
  body_value text default '',
  identity_value text default '',
  bucket_date date default current_date,
  ttl_seconds integer default 120
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  request_key text;
  existing public.duplicate_request_keys%rowtype;
  safe_ttl integer := least(greatest(coalesce(ttl_seconds, 120), 30), 600);
begin
  if request_kind not in (
    'discussion',
    'reply',
    'business',
    'marketplace',
    'job',
    'event',
    'request',
    'service'
  ) then
    raise exception 'Unsupported duplicate request kind.';
  end if;

  if actor_user_id is null then
    raise exception 'Duplicate request actor is required.';
  end if;

  request_key := public.duplicate_request_fingerprint(
    request_kind,
    actor_user_id,
    scope_key,
    title_value,
    body_value,
    identity_value,
    bucket_date
  );

  delete from public.duplicate_request_keys
  where target_id is null
    and expires_at < now() - interval '1 day';

  insert into public.duplicate_request_keys (
    fingerprint,
    request_kind,
    actor_user_id,
    created_at,
    expires_at
  ) values (
    request_key,
    request_kind,
    actor_user_id,
    now(),
    now() + make_interval(secs => safe_ttl)
  )
  on conflict (fingerprint) do nothing
  returning * into existing;

  if found then
    return jsonb_build_object(
      'claimed', true,
      'pending', false,
      'fingerprint', request_key,
      'targetId', null,
      'targetType', null
    );
  end if;

  select *
  into existing
  from public.duplicate_request_keys request_row
  where request_row.fingerprint = request_key
  for update;

  if existing.actor_user_id <> actor_user_id
    or existing.request_kind <> request_kind
  then
    raise exception 'Duplicate request ownership mismatch.';
  end if;

  if existing.target_id is not null then
    return jsonb_build_object(
      'claimed', false,
      'pending', false,
      'fingerprint', request_key,
      'targetId', existing.target_id,
      'targetType', existing.target_type
    );
  end if;

  if existing.expires_at <= now() then
    update public.duplicate_request_keys
    set
      created_at = now(),
      expires_at = now() + make_interval(secs => safe_ttl),
      target_type = null,
      target_id = null
    where fingerprint = request_key;

    return jsonb_build_object(
      'claimed', true,
      'pending', false,
      'fingerprint', request_key,
      'targetId', null,
      'targetType', null
    );
  end if;

  return jsonb_build_object(
    'claimed', false,
    'pending', true,
    'fingerprint', request_key,
    'targetId', null,
    'targetType', null
  );
end;
$$;

create or replace function public.set_marketplace_submission_fingerprint()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.submission_fingerprint is null then
    new.submission_fingerprint := public.duplicate_request_fingerprint(
      'marketplace',
      new.seller_id,
      concat_ws(
        '|',
        new.status,
        coalesce(new.business_id::text, ''),
        new.category
      ),
      new.title,
      new.description,
      concat_ws(
        '|',
        new.item_condition,
        public.normalize_duplicate_number(new.price),
        new.currency,
        case when new.is_free then '1' else '0' end,
        new.city,
        new.region,
        new.postal_code,
        array_to_string(new.photo_paths, ',')
      ),
      (coalesce(new.created_at, now()) at time zone 'UTC')::date
    );
  end if;
  return new;
end;
$$;

create or replace function public.set_job_submission_fingerprint()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.submission_fingerprint is null then
    new.submission_fingerprint := public.duplicate_request_fingerprint(
      'job',
      new.created_by,
      new.business_id::text,
      new.title,
      concat_ws(E'\n', new.summary, new.description),
      concat_ws(
        '|',
        public.normalize_duplicate_website(new.application_url),
        lower(coalesce(new.application_email, '')),
        new.employment_type,
        new.workplace_type,
        new.city,
        new.region,
        new.postal_code
      ),
      (coalesce(new.created_at, now()) at time zone 'UTC')::date
    );
  end if;
  return new;
end;
$$;

create or replace function public.set_event_submission_fingerprint()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.submission_fingerprint is null then
    new.submission_fingerprint := public.duplicate_request_fingerprint(
      'event',
      new.organizer_id,
      concat_ws(
        '|',
        coalesce(new.business_id::text, ''),
        new.event_format,
        floor(extract(epoch from new.starts_at))::bigint::text
      ),
      new.title,
      new.description,
      concat_ws(
        '|',
        new.venue_name,
        new.address_line1,
        new.address_line2,
        new.city,
        new.region,
        new.postal_code,
        public.normalize_duplicate_website(new.online_url)
      ),
      date '1970-01-01'
    );
  end if;
  return new;
end;
$$;

create or replace function public.set_request_submission_fingerprint()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.submission_fingerprint is null then
    new.submission_fingerprint := public.duplicate_request_fingerprint(
      'request',
      new.requester_id,
      concat_ws(
        '|',
        coalesce(new.business_id::text, ''),
        new.request_type,
        new.category,
        new.service_mode
      ),
      new.title,
      new.description,
      concat_ws(
        '|',
        new.city,
        new.region,
        new.postal_code,
        case
          when new.deadline is null then ''
          else floor(extract(epoch from new.deadline))::bigint::text
        end
      ),
      (coalesce(new.created_at, now()) at time zone 'UTC')::date
    );
  end if;
  return new;
end;
$$;

create or replace function public.set_service_submission_fingerprint()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.submission_fingerprint is null then
    new.submission_fingerprint := public.duplicate_request_fingerprint(
      'service',
      new.provider_id,
      concat_ws(
        '|',
        coalesce(new.business_id::text, ''),
        coalesce(new.appointment_service_id::text, ''),
        new.category,
        new.service_mode
      ),
      new.title,
      new.description,
      concat_ws(
        '|',
        new.city,
        new.region,
        new.postal_code,
        new.price_type,
        public.normalize_duplicate_number(new.price_min),
        public.normalize_duplicate_number(new.price_max),
        new.currency
      ),
      date '1970-01-01'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists set_marketplace_submission_fingerprint
  on public.marketplace_listings;
create trigger set_marketplace_submission_fingerprint
before insert on public.marketplace_listings
for each row execute function public.set_marketplace_submission_fingerprint();

drop trigger if exists resolve_marketplace_duplicate_request
  on public.marketplace_listings;
create trigger resolve_marketplace_duplicate_request
after insert on public.marketplace_listings
for each row execute function public.resolve_duplicate_request_target();

drop trigger if exists set_job_submission_fingerprint
  on public.job_postings;
create trigger set_job_submission_fingerprint
before insert on public.job_postings
for each row execute function public.set_job_submission_fingerprint();

drop trigger if exists resolve_job_duplicate_request
  on public.job_postings;
create trigger resolve_job_duplicate_request
after insert on public.job_postings
for each row execute function public.resolve_duplicate_request_target();

drop trigger if exists set_event_submission_fingerprint
  on public.public_events;
create trigger set_event_submission_fingerprint
before insert on public.public_events
for each row execute function public.set_event_submission_fingerprint();

drop trigger if exists resolve_event_duplicate_request
  on public.public_events;
create trigger resolve_event_duplicate_request
after insert on public.public_events
for each row execute function public.resolve_duplicate_request_target();

drop trigger if exists set_request_submission_fingerprint
  on public.service_requests;
create trigger set_request_submission_fingerprint
before insert on public.service_requests
for each row execute function public.set_request_submission_fingerprint();

drop trigger if exists resolve_request_duplicate_request
  on public.service_requests;
create trigger resolve_request_duplicate_request
after insert on public.service_requests
for each row execute function public.resolve_duplicate_request_target();

drop trigger if exists set_service_submission_fingerprint
  on public.provider_services;
create trigger set_service_submission_fingerprint
before insert on public.provider_services
for each row execute function public.set_service_submission_fingerprint();

drop trigger if exists resolve_service_duplicate_request
  on public.provider_services;
create trigger resolve_service_duplicate_request
after insert on public.provider_services
for each row execute function public.resolve_duplicate_request_target();

revoke all on function public.normalize_duplicate_number(numeric)
  from public, anon, authenticated;
revoke all on function public.set_marketplace_submission_fingerprint()
  from public, anon, authenticated;
revoke all on function public.set_job_submission_fingerprint()
  from public, anon, authenticated;
revoke all on function public.set_event_submission_fingerprint()
  from public, anon, authenticated;
revoke all on function public.set_request_submission_fingerprint()
  from public, anon, authenticated;
revoke all on function public.set_service_submission_fingerprint()
  from public, anon, authenticated;

grant execute on function public.normalize_duplicate_number(numeric)
  to service_role;
grant execute on function public.set_marketplace_submission_fingerprint()
  to service_role;
grant execute on function public.set_job_submission_fingerprint()
  to service_role;
grant execute on function public.set_event_submission_fingerprint()
  to service_role;
grant execute on function public.set_request_submission_fingerprint()
  to service_role;
grant execute on function public.set_service_submission_fingerprint()
  to service_role;

comment on column public.marketplace_listings.submission_fingerprint is
  'Server-generated daily fingerprint used to prevent repeated Marketplace creation requests.';
comment on column public.job_postings.submission_fingerprint is
  'Server-generated daily fingerprint used to prevent repeated Job creation requests.';
comment on column public.public_events.submission_fingerprint is
  'Server-generated event-instance fingerprint used to prevent repeated Event creation requests.';
comment on column public.service_requests.submission_fingerprint is
  'Server-generated daily fingerprint used to prevent repeated Request creation requests.';
comment on column public.provider_services.submission_fingerprint is
  'Server-generated stable fingerprint used to prevent repeated Service creation requests.';

commit;
