-- Jobs Directory core data, employer ownership, lifecycle, moderation, and reporting.

begin;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.job_postings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  slug text not null unique,
  title text not null,
  summary text not null,
  description text not null,
  responsibilities text not null default '',
  qualifications text not null default '',
  category text not null,
  employment_type text not null default 'full_time',
  workplace_type text not null default 'on_site',
  experience_level text not null default 'not_specified',
  city text,
  region text,
  postal_code text,
  country_code text not null default 'US',
  compensation_min numeric(14, 2),
  compensation_max numeric(14, 2),
  compensation_currency text not null default 'USD',
  compensation_period text not null default 'year',
  show_compensation boolean not null default false,
  application_url text,
  application_email text,
  skills text[] not null default '{}'::text[],
  benefits text[] not null default '{}'::text[],
  application_deadline date,
  expires_at timestamptz,
  status text not null default 'pending',
  moderation_reason text,
  published_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_postings_slug_length_check
    check (char_length(slug) between 1 and 100),
  constraint job_postings_title_length_check
    check (char_length(title) between 3 and 200),
  constraint job_postings_summary_length_check
    check (char_length(summary) between 20 and 500),
  constraint job_postings_description_length_check
    check (char_length(description) between 60 and 12000),
  constraint job_postings_responsibilities_length_check
    check (char_length(responsibilities) <= 8000),
  constraint job_postings_qualifications_length_check
    check (char_length(qualifications) <= 8000),
  constraint job_postings_category_length_check
    check (char_length(category) between 1 and 120),
  constraint job_postings_employment_type_check
    check (
      employment_type in (
        'full_time',
        'part_time',
        'contract',
        'temporary',
        'internship',
        'seasonal',
        'apprenticeship',
        'volunteer'
      )
    ),
  constraint job_postings_workplace_type_check
    check (workplace_type in ('on_site', 'hybrid', 'remote')),
  constraint job_postings_experience_level_check
    check (
      experience_level in (
        'not_specified',
        'entry',
        'mid',
        'senior',
        'lead',
        'executive'
      )
    ),
  constraint job_postings_country_code_check
    check (char_length(country_code) = 2),
  constraint job_postings_compensation_min_check
    check (compensation_min is null or compensation_min >= 0),
  constraint job_postings_compensation_max_check
    check (compensation_max is null or compensation_max >= 0),
  constraint job_postings_compensation_range_check
    check (
      compensation_min is null
      or compensation_max is null
      or compensation_max >= compensation_min
    ),
  constraint job_postings_compensation_currency_check
    check (compensation_currency ~ '^[A-Z]{3}$'),
  constraint job_postings_compensation_period_check
    check (
      compensation_period in (
        'hour',
        'day',
        'week',
        'month',
        'year',
        'project'
      )
    ),
  constraint job_postings_application_source_check
    check (
      nullif(trim(coalesce(application_url, '')), '') is not null
      or nullif(trim(coalesce(application_email, '')), '') is not null
    ),
  constraint job_postings_expiration_after_deadline_check
    check (
      expires_at is null
      or application_deadline is null
      or expires_at::date >= application_deadline
    ),
  constraint job_postings_status_check
    check (
      status in (
        'draft',
        'pending',
        'published',
        'rejected',
        'suspended',
        'closed',
        'expired'
      )
    )
);

create table if not exists public.job_reports (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.job_postings(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  details text not null,
  status text not null default 'open',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_reports_reason_length_check
    check (char_length(reason) between 1 and 120),
  constraint job_reports_details_length_check
    check (char_length(details) between 10 and 3000),
  constraint job_reports_status_check
    check (status in ('open', 'resolved', 'dismissed'))
);

create index if not exists job_postings_public_idx
  on public.job_postings (status, published_at desc);

create index if not exists job_postings_business_idx
  on public.job_postings (business_id, status, updated_at desc);

create index if not exists job_postings_location_idx
  on public.job_postings (city, region, category, workplace_type);

create index if not exists job_postings_expiration_idx
  on public.job_postings (status, expires_at, application_deadline)
  where status = 'published';

create index if not exists job_reports_review_idx
  on public.job_reports (status, created_at);

create index if not exists job_reports_reporter_rate_idx
  on public.job_reports (reporter_id, created_at desc);

create or replace function public.touch_jobs_directory_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_job_postings_updated_at
  on public.job_postings;
create trigger touch_job_postings_updated_at
before update on public.job_postings
for each row execute function public.touch_jobs_directory_updated_at();

drop trigger if exists touch_job_reports_updated_at
  on public.job_reports;
create trigger touch_job_reports_updated_at
before update on public.job_reports
for each row execute function public.touch_jobs_directory_updated_at();

create or replace function public.expire_local_job_postings()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  expired_count integer := 0;
begin
  update public.job_postings
  set
    status = 'expired',
    closed_at = coalesce(closed_at, now()),
    moderation_reason = coalesce(
      moderation_reason,
      'Automatically expired after the published deadline.'
    )
  where status = 'published'
    and (
      (expires_at is not null and expires_at <= now())
      or (
        application_deadline is not null
        and application_deadline < current_date
      )
    );

  get diagnostics expired_count = row_count;
  return expired_count;
end;
$$;

create or replace function public.search_public_jobs(
  search_text text default null,
  category_filter text default null,
  city_filter text default null,
  employment_filter text default null,
  workplace_filter text default null,
  page_number integer default 1,
  page_size integer default 24
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  clean_search text := trim(coalesce(search_text, ''));
  clean_category text := trim(coalesce(category_filter, ''));
  clean_city text := trim(coalesce(city_filter, ''));
  clean_employment text := trim(coalesce(employment_filter, ''));
  clean_workplace text := trim(coalesce(workplace_filter, ''));
  clean_page integer := greatest(coalesce(page_number, 1), 1);
  clean_size integer := least(greatest(coalesce(page_size, 24), 1), 48);
  result jsonb;
begin
  with filtered as (
    select
      job.id,
      job.business_id,
      business.name as business_name,
      business.slug as business_slug,
      business.logo_url as business_logo_url,
      business.verification_status as business_verification_status,
      business.status as business_status,
      job.slug,
      job.title,
      job.summary,
      job.description,
      job.responsibilities,
      job.qualifications,
      job.category,
      job.employment_type,
      job.workplace_type,
      job.experience_level,
      job.city,
      job.region,
      job.postal_code,
      job.country_code,
      job.compensation_min,
      job.compensation_max,
      job.compensation_currency,
      job.compensation_period,
      job.show_compensation,
      job.application_url,
      job.application_email,
      job.skills,
      job.benefits,
      job.application_deadline,
      job.expires_at,
      job.status,
      job.moderation_reason,
      job.published_at,
      job.closed_at,
      job.created_at,
      job.updated_at
    from public.job_postings job
    join public.businesses business
      on business.id = job.business_id
    where job.status = 'published'
      and business.status = 'published'
      and (
        job.expires_at is null
        or job.expires_at > now()
      )
      and (
        job.application_deadline is null
        or job.application_deadline >= current_date
      )
      and (
        clean_category = ''
        or lower(job.category) = lower(clean_category)
      )
      and (
        clean_employment = ''
        or job.employment_type = clean_employment
      )
      and (
        clean_workplace = ''
        or job.workplace_type = clean_workplace
      )
      and (
        clean_city = ''
        or job.city ilike '%' || clean_city || '%'
        or job.region ilike '%' || clean_city || '%'
        or job.postal_code ilike '%' || clean_city || '%'
        or (
          job.workplace_type = 'remote'
          and 'remote' ilike '%' || clean_city || '%'
        )
      )
      and (
        clean_search = ''
        or job.title ilike '%' || clean_search || '%'
        or job.summary ilike '%' || clean_search || '%'
        or job.description ilike '%' || clean_search || '%'
        or job.category ilike '%' || clean_search || '%'
        or business.name ilike '%' || clean_search || '%'
        or array_to_string(job.skills, ' ') ilike '%' || clean_search || '%'
        or array_to_string(job.benefits, ' ') ilike '%' || clean_search || '%'
      )
  ),
  paged as (
    select *
    from filtered
    order by published_at desc nulls last, created_at desc
    offset (clean_page - 1) * clean_size
    limit clean_size
  )
  select jsonb_build_object(
    'total',
    (select count(*) from filtered),
    'jobs',
    coalesce(
      (
        select jsonb_agg(
          to_jsonb(page_row)
          order by page_row.published_at desc nulls last,
            page_row.created_at desc
        )
        from paged page_row
      ),
      '[]'::jsonb
    )
  )
  into result;

  return coalesce(
    result,
    jsonb_build_object('total', 0, 'jobs', '[]'::jsonb)
  );
end;
$$;

alter table public.job_postings enable row level security;
alter table public.job_reports enable row level security;

revoke all on table public.job_postings
  from public, anon, authenticated;
revoke all on table public.job_reports
  from public, anon, authenticated;

revoke all on function public.touch_jobs_directory_updated_at()
  from public, anon, authenticated;
revoke all on function public.expire_local_job_postings()
  from public, anon, authenticated;
revoke all on function public.search_public_jobs(
  text,
  text,
  text,
  text,
  text,
  integer,
  integer
)
  from public, anon, authenticated;

grant execute on function public.expire_local_job_postings()
  to service_role;
grant execute on function public.search_public_jobs(
  text,
  text,
  text,
  text,
  text,
  integer,
  integer
)
  to service_role;

notify pgrst, 'reload schema';

commit;
