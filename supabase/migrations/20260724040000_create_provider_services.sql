-- Public Services, private saves, structured inquiries, and moderation reports.

begin;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.provider_services (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete set null,
  appointment_service_id uuid references public.business_appointment_services(id) on delete set null,
  slug text not null unique,
  title text not null,
  description text not null,
  category text not null,
  specialties text[] not null default '{}',
  service_mode text not null default 'flexible',
  city text,
  region text,
  postal_code text,
  country_code text not null default 'US',
  price_type text not null default 'contact',
  price_min numeric(14,2),
  price_max numeric(14,2),
  currency text not null default 'USD',
  typical_duration_minutes integer,
  response_expectation text,
  availability_text text,
  attachment_urls text[] not null default '{}',
  attachment_paths text[] not null default '{}',
  attachment_types text[] not null default '{}',
  attachment_names text[] not null default '{}',
  status text not null default 'pending',
  moderation_reason text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_services_mode_check check (
    service_mode in ('remote', 'requester_location', 'provider_location', 'flexible')
  ),
  constraint provider_services_price_type_check check (
    price_type in ('fixed', 'range', 'hourly', 'contact')
  ),
  constraint provider_services_status_check check (
    status in ('draft', 'pending', 'published', 'paused', 'rejected', 'archived', 'removed')
  ),
  constraint provider_services_price_check check (
    (price_min is null or price_min >= 0)
    and (price_max is null or price_max >= 0)
    and (price_min is null or price_max is null or price_max >= price_min)
    and (price_type <> 'contact' or (price_min is null and price_max is null))
    and (price_type <> 'fixed' or (price_min is not null and price_max = price_min))
  ),
  constraint provider_services_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint provider_services_country_check check (country_code ~ '^[A-Z]{2}$'),
  constraint provider_services_duration_check check (
    typical_duration_minutes is null
    or typical_duration_minutes between 15 and 10080
  ),
  constraint provider_services_attachment_alignment_check check (
    cardinality(attachment_urls) = cardinality(attachment_paths)
    and cardinality(attachment_paths) = cardinality(attachment_types)
    and cardinality(attachment_types) = cardinality(attachment_names)
    and cardinality(attachment_urls) <= 8
  )
);

create index if not exists provider_services_public_published_idx
  on public.provider_services (status, published_at desc);
create index if not exists provider_services_provider_updated_idx
  on public.provider_services (provider_id, updated_at desc);
create index if not exists provider_services_business_updated_idx
  on public.provider_services (business_id, updated_at desc)
  where business_id is not null;
create index if not exists provider_services_category_region_idx
  on public.provider_services (category, region, city);
create index if not exists provider_services_appointment_idx
  on public.provider_services (appointment_service_id)
  where appointment_service_id is not null;

create table if not exists public.provider_service_saves (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.provider_services(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint provider_service_saves_unique unique (service_id, user_id)
);

create index if not exists provider_service_saves_user_created_idx
  on public.provider_service_saves (user_id, created_at desc);
create index if not exists provider_service_saves_service_idx
  on public.provider_service_saves (service_id);

create table if not exists public.provider_service_inquiries (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.provider_services(id) on delete cascade,
  provider_id uuid not null references public.profiles(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  linked_request_id uuid references public.service_requests(id) on delete set null,
  message text not null,
  preferred_start timestamptz,
  preferred_end timestamptz,
  budget_min numeric(14,2),
  budget_max numeric(14,2),
  currency text not null default 'USD',
  status text not null default 'submitted',
  conversation_id uuid references public.private_conversations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_service_inquiries_parties_check check (provider_id <> requester_id),
  constraint provider_service_inquiries_status_check check (
    status in ('submitted', 'accepted', 'declined', 'cancelled', 'closed')
  ),
  constraint provider_service_inquiries_time_check check (
    preferred_end is null or preferred_start is null or preferred_end > preferred_start
  ),
  constraint provider_service_inquiries_budget_check check (
    (budget_min is null or budget_min >= 0)
    and (budget_max is null or budget_max >= 0)
    and (budget_min is null or budget_max is null or budget_max >= budget_min)
  ),
  constraint provider_service_inquiries_currency_check check (currency ~ '^[A-Z]{3}$')
);

create unique index if not exists provider_service_inquiries_one_active_idx
  on public.provider_service_inquiries (service_id, requester_id)
  where status in ('submitted', 'accepted');
create index if not exists provider_service_inquiries_provider_status_idx
  on public.provider_service_inquiries (provider_id, status, updated_at desc);
create index if not exists provider_service_inquiries_requester_status_idx
  on public.provider_service_inquiries (requester_id, status, updated_at desc);
create index if not exists provider_service_inquiries_linked_request_idx
  on public.provider_service_inquiries (linked_request_id)
  where linked_request_id is not null;

create table if not exists public.provider_service_reports (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.provider_services(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  details text not null,
  status text not null default 'open',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_service_reports_status_check check (
    status in ('open', 'resolved', 'dismissed')
  )
);

create unique index if not exists provider_service_reports_one_open_idx
  on public.provider_service_reports (service_id, reporter_id)
  where status = 'open';
create index if not exists provider_service_reports_status_created_idx
  on public.provider_service_reports (status, created_at desc);

alter table public.service_request_responses
  add column if not exists provider_service_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.service_request_responses'::regclass
      and conname = 'service_request_responses_provider_service_fk'
  ) then
    alter table public.service_request_responses
      add constraint service_request_responses_provider_service_fk
      foreign key (provider_service_id)
      references public.provider_services(id)
      on delete set null;
  end if;
end;
$$;

create index if not exists service_request_responses_provider_service_idx
  on public.service_request_responses (provider_service_id)
  where provider_service_id is not null;

create or replace function public.touch_provider_services_updated_at()
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

drop trigger if exists touch_provider_services_updated_at
  on public.provider_services;
create trigger touch_provider_services_updated_at
before update on public.provider_services
for each row execute function public.touch_provider_services_updated_at();

drop trigger if exists touch_provider_service_inquiries_updated_at
  on public.provider_service_inquiries;
create trigger touch_provider_service_inquiries_updated_at
before update on public.provider_service_inquiries
for each row execute function public.touch_provider_services_updated_at();

drop trigger if exists touch_provider_service_reports_updated_at
  on public.provider_service_reports;
create trigger touch_provider_service_reports_updated_at
before update on public.provider_service_reports
for each row execute function public.touch_provider_services_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'provider-service-attachments',
  'provider-service-attachments',
  true,
  12582912,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.provider_services enable row level security;
alter table public.provider_service_saves enable row level security;
alter table public.provider_service_inquiries enable row level security;
alter table public.provider_service_reports enable row level security;

revoke all on table public.provider_services from public, anon, authenticated;
revoke all on table public.provider_service_saves from public, anon, authenticated;
revoke all on table public.provider_service_inquiries from public, anon, authenticated;
revoke all on table public.provider_service_reports from public, anon, authenticated;

grant all on table public.provider_services to service_role;
grant all on table public.provider_service_saves to service_role;
grant all on table public.provider_service_inquiries to service_role;
grant all on table public.provider_service_reports to service_role;

revoke all on function public.touch_provider_services_updated_at()
  from public, anon, authenticated;
grant execute on function public.touch_provider_services_updated_at()
  to service_role;

commit;
