-- Business appointment services and explicit appointment-request lifecycle.

begin;

create table if not exists public.business_appointment_services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text not null,
  duration_minutes integer not null default 30,
  location_mode text not null default 'flexible',
  location_text text,
  price_text text,
  instructions text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_appointment_services_duration_check
    check (duration_minutes between 15 and 480),
  constraint business_appointment_services_location_check
    check (location_mode in ('in_person', 'online', 'phone', 'flexible')),
  constraint business_appointment_services_status_check
    check (status in ('active', 'paused', 'archived'))
);

create index if not exists business_appointment_services_business_status_idx
  on public.business_appointment_services (business_id, status, name);
create index if not exists business_appointment_services_owner_updated_idx
  on public.business_appointment_services (owner_id, updated_at desc);

create table if not exists public.business_appointment_requests (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.business_appointment_services(id) on delete restrict,
  business_id uuid not null references public.businesses(id) on delete cascade,
  provider_id uuid not null references public.profiles(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  requested_start timestamptz not null,
  requested_end timestamptz not null,
  proposed_start timestamptz,
  proposed_end timestamptz,
  timezone text not null default 'UTC',
  note text,
  provider_note text,
  status text not null default 'pending',
  acted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_appointment_requests_parties_check
    check (provider_id <> requester_id),
  constraint business_appointment_requests_time_check
    check (requested_end > requested_start),
  constraint business_appointment_requests_proposed_time_check
    check (
      (proposed_start is null and proposed_end is null)
      or (proposed_start is not null and proposed_end is not null and proposed_end > proposed_start)
    ),
  constraint business_appointment_requests_status_check
    check (status in ('pending', 'accepted', 'declined', 'reschedule_proposed', 'cancelled', 'completed'))
);

create index if not exists business_appointment_requests_provider_status_time_idx
  on public.business_appointment_requests (provider_id, status, requested_start);
create index if not exists business_appointment_requests_requester_status_time_idx
  on public.business_appointment_requests (requester_id, status, requested_start);
create index if not exists business_appointment_requests_business_created_idx
  on public.business_appointment_requests (business_id, created_at desc);
create index if not exists business_appointment_requests_service_created_idx
  on public.business_appointment_requests (service_id, created_at desc);

create or replace function public.touch_appointments_updated_at()
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

drop trigger if exists touch_business_appointment_services_updated_at
  on public.business_appointment_services;
create trigger touch_business_appointment_services_updated_at
before update on public.business_appointment_services
for each row execute function public.touch_appointments_updated_at();

drop trigger if exists touch_business_appointment_requests_updated_at
  on public.business_appointment_requests;
create trigger touch_business_appointment_requests_updated_at
before update on public.business_appointment_requests
for each row execute function public.touch_appointments_updated_at();

alter table public.business_appointment_services enable row level security;
alter table public.business_appointment_requests enable row level security;

revoke all on table public.business_appointment_services
  from public, anon, authenticated;
revoke all on table public.business_appointment_requests
  from public, anon, authenticated;

grant all on table public.business_appointment_services to service_role;
grant all on table public.business_appointment_requests to service_role;

revoke all on function public.touch_appointments_updated_at()
  from public, anon, authenticated;
grant execute on function public.touch_appointments_updated_at()
  to service_role;

commit;
