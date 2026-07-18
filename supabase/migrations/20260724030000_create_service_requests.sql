-- Public Requests, private saves, attributable responses, and moderation reports.

begin;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete set null,
  slug text not null unique,
  title text not null,
  description text not null,
  request_type text not null default 'service_needed',
  category text not null,
  urgency text not null default 'normal',
  urgency_rank smallint generated always as (
    case urgency when 'urgent' then 3 when 'soon' then 2 else 1 end
  ) stored,
  service_mode text not null default 'flexible',
  city text,
  region text,
  postal_code text,
  country_code text not null default 'US',
  budget_min numeric(14,2),
  budget_max numeric(14,2),
  currency text not null default 'USD',
  budget_type text not null default 'flexible',
  deadline timestamptz,
  preferred_start timestamptz,
  preferred_end timestamptz,
  tags text[] not null default '{}',
  attachment_urls text[] not null default '{}',
  attachment_paths text[] not null default '{}',
  attachment_types text[] not null default '{}',
  attachment_names text[] not null default '{}',
  status text not null default 'pending',
  moderation_reason text,
  selected_response_id uuid,
  published_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_requests_type_check check (
    request_type in (
      'service_needed', 'recommendation', 'quote_request',
      'community_help', 'volunteer_help', 'consultation', 'local_problem'
    )
  ),
  constraint service_requests_urgency_check check (urgency in ('normal', 'soon', 'urgent')),
  constraint service_requests_mode_check check (
    service_mode in ('remote', 'requester_location', 'provider_location', 'flexible')
  ),
  constraint service_requests_budget_type_check check (budget_type in ('total', 'hourly', 'flexible')),
  constraint service_requests_status_check check (
    status in (
      'draft', 'pending', 'open', 'reviewing', 'in_progress',
      'resolved', 'closed', 'rejected', 'suspended', 'removed'
    )
  ),
  constraint service_requests_budget_check check (
    (budget_min is null or budget_min >= 0)
    and (budget_max is null or budget_max >= 0)
    and (budget_min is null or budget_max is null or budget_max >= budget_min)
  ),
  constraint service_requests_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint service_requests_country_check check (country_code ~ '^[A-Z]{2}$'),
  constraint service_requests_preferred_time_check check (
    preferred_end is null or preferred_start is null or preferred_end > preferred_start
  ),
  constraint service_requests_attachment_alignment_check check (
    cardinality(attachment_urls) = cardinality(attachment_paths)
    and cardinality(attachment_paths) = cardinality(attachment_types)
    and cardinality(attachment_types) = cardinality(attachment_names)
    and cardinality(attachment_urls) <= 8
  )
);

create index if not exists service_requests_public_rank_idx
  on public.service_requests (status, urgency_rank desc, published_at desc);
create index if not exists service_requests_requester_updated_idx
  on public.service_requests (requester_id, updated_at desc);
create index if not exists service_requests_business_updated_idx
  on public.service_requests (business_id, updated_at desc)
  where business_id is not null;
create index if not exists service_requests_category_region_idx
  on public.service_requests (category, region, city);
create index if not exists service_requests_deadline_idx
  on public.service_requests (deadline)
  where deadline is not null and status in ('open', 'reviewing');

create table if not exists public.service_request_saves (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint service_request_saves_unique unique (request_id, user_id)
);

create index if not exists service_request_saves_user_created_idx
  on public.service_request_saves (user_id, created_at desc);
create index if not exists service_request_saves_request_idx
  on public.service_request_saves (request_id);

create table if not exists public.service_request_responses (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id) on delete cascade,
  responder_id uuid not null references public.profiles(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete set null,
  message text not null,
  availability_text text,
  estimate_min numeric(14,2),
  estimate_max numeric(14,2),
  currency text not null default 'USD',
  appointment_service_id uuid references public.business_appointment_services(id) on delete set null,
  status text not null default 'submitted',
  conversation_id uuid references public.private_conversations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_request_responses_parties_check check (responder_id is not null),
  constraint service_request_responses_status_check check (
    status in ('submitted', 'selected', 'declined', 'withdrawn')
  ),
  constraint service_request_responses_estimate_check check (
    (estimate_min is null or estimate_min >= 0)
    and (estimate_max is null or estimate_max >= 0)
    and (estimate_min is null or estimate_max is null or estimate_max >= estimate_min)
  ),
  constraint service_request_responses_currency_check check (currency ~ '^[A-Z]{3}$')
);

create unique index if not exists service_request_responses_one_active_idx
  on public.service_request_responses (request_id, responder_id)
  where status <> 'withdrawn';
create unique index if not exists service_request_responses_one_selected_idx
  on public.service_request_responses (request_id)
  where status = 'selected';
create index if not exists service_request_responses_request_status_idx
  on public.service_request_responses (request_id, status, created_at desc);
create index if not exists service_request_responses_responder_updated_idx
  on public.service_request_responses (responder_id, updated_at desc);

alter table public.service_requests
  drop constraint if exists service_requests_selected_response_fk;
alter table public.service_requests
  add constraint service_requests_selected_response_fk
  foreign key (selected_response_id)
  references public.service_request_responses(id)
  on delete set null
  deferrable initially deferred;

create table if not exists public.service_request_reports (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  details text not null,
  status text not null default 'open',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_request_reports_status_check check (status in ('open', 'resolved', 'dismissed'))
);

create unique index if not exists service_request_reports_one_open_idx
  on public.service_request_reports (request_id, reporter_id)
  where status = 'open';
create index if not exists service_request_reports_status_created_idx
  on public.service_request_reports (status, created_at desc);

create or replace function public.touch_service_requests_updated_at()
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

create or replace function public.expire_service_requests()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update public.service_requests
  set status = 'closed',
      closed_at = coalesce(closed_at, now())
  where status in ('open', 'reviewing')
    and deadline is not null
    and deadline <= now();
  get diagnostics affected = row_count;
  return affected;
end;
$$;

drop trigger if exists touch_service_requests_updated_at on public.service_requests;
create trigger touch_service_requests_updated_at
before update on public.service_requests
for each row execute function public.touch_service_requests_updated_at();

drop trigger if exists touch_service_request_responses_updated_at on public.service_request_responses;
create trigger touch_service_request_responses_updated_at
before update on public.service_request_responses
for each row execute function public.touch_service_requests_updated_at();

drop trigger if exists touch_service_request_reports_updated_at on public.service_request_reports;
create trigger touch_service_request_reports_updated_at
before update on public.service_request_reports
for each row execute function public.touch_service_requests_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'service-request-attachments',
  'service-request-attachments',
  true,
  12582912,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.service_requests enable row level security;
alter table public.service_request_saves enable row level security;
alter table public.service_request_responses enable row level security;
alter table public.service_request_reports enable row level security;

revoke all on table public.service_requests from public, anon, authenticated;
revoke all on table public.service_request_saves from public, anon, authenticated;
revoke all on table public.service_request_responses from public, anon, authenticated;
revoke all on table public.service_request_reports from public, anon, authenticated;

grant all on table public.service_requests to service_role;
grant all on table public.service_request_saves to service_role;
grant all on table public.service_request_responses to service_role;
grant all on table public.service_request_reports to service_role;

revoke all on function public.touch_service_requests_updated_at() from public, anon, authenticated;
revoke all on function public.expire_service_requests() from public, anon, authenticated;
grant execute on function public.touch_service_requests_updated_at() to service_role;
grant execute on function public.expire_service_requests() to service_role;

commit;
