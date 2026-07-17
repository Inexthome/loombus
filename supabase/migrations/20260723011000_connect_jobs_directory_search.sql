-- Connect approved Jobs Directory postings to Everything Search.

begin;

create or replace function public.index_local_job_search(
  target_job_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  job_row public.job_postings%rowtype;
  business_row public.businesses%rowtype;
  location_summary text;
  compensation_summary text;
  job_keywords text[];
begin
  select *
  into job_row
  from public.job_postings job
  where job.id = target_job_id;

  if job_row.id is null then
    delete from public.loombus_search_documents document
    where document.source_table = 'job_postings'
      and document.entity_id = target_job_id;
    return;
  end if;

  select *
  into business_row
  from public.businesses business
  where business.id = job_row.business_id;

  if business_row.id is null
    or business_row.status <> 'published'
    or job_row.status <> 'published'
    or (
      job_row.expires_at is not null
      and job_row.expires_at <= now()
    )
    or (
      job_row.application_deadline is not null
      and job_row.application_deadline < current_date
    )
  then
    delete from public.loombus_search_documents document
    where document.source_table = 'job_postings'
      and document.entity_id = target_job_id;
    return;
  end if;

  location_summary := case
    when job_row.workplace_type = 'remote'
      then concat_ws(
        ', ',
        'Remote',
        nullif(job_row.region, ''),
        nullif(job_row.country_code, '')
      )
    else concat_ws(
      ', ',
      nullif(job_row.city, ''),
      nullif(job_row.region, ''),
      nullif(job_row.postal_code, '')
    )
  end;

  compensation_summary := case
    when not job_row.show_compensation then null
    when job_row.compensation_min is null
      and job_row.compensation_max is null then null
    when job_row.compensation_min is not null
      and job_row.compensation_max is not null
      and job_row.compensation_min <> job_row.compensation_max
      then concat(
        job_row.compensation_currency,
        ' ',
        job_row.compensation_min,
        ' - ',
        job_row.compensation_currency,
        ' ',
        job_row.compensation_max,
        ' per ',
        job_row.compensation_period
      )
    else concat(
      job_row.compensation_currency,
      ' ',
      coalesce(job_row.compensation_min, job_row.compensation_max),
      ' per ',
      job_row.compensation_period
    )
  end;

  job_keywords := array_remove(
    array[
      job_row.title,
      job_row.category,
      job_row.employment_type,
      job_row.workplace_type,
      job_row.experience_level,
      job_row.city,
      job_row.region,
      job_row.postal_code,
      job_row.country_code,
      business_row.name,
      business_row.category,
      'job',
      'jobs',
      'hiring',
      'employment',
      'career',
      'work'
    ]
      || coalesce(job_row.skills, '{}'::text[])
      || coalesce(job_row.benefits, '{}'::text[]),
    null
  );

  insert into public.loombus_search_documents (
    source_table,
    entity_type,
    entity_id,
    parent_id,
    room_id,
    owner_id,
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
  values (
    'job_postings',
    'job',
    job_row.id,
    business_row.id,
    null,
    business_row.owner_id,
    left(job_row.title, 300),
    left(
      concat_ws(
        ' · ',
        business_row.name,
        job_row.category,
        replace(job_row.employment_type, '_', ' '),
        replace(job_row.workplace_type, '_', ' '),
        nullif(location_summary, ''),
        nullif(compensation_summary, '')
      ),
      2000
    ),
    left(
      concat_ws(
        E'\n\n',
        nullif(job_row.summary, ''),
        nullif(job_row.description, ''),
        nullif(job_row.responsibilities, ''),
        nullif(job_row.qualifications, ''),
        case
          when cardinality(job_row.skills) > 0
            then 'Skills: ' || array_to_string(job_row.skills, ', ')
          else null
        end,
        case
          when cardinality(job_row.benefits) > 0
            then 'Benefits: ' || array_to_string(job_row.benefits, ', ')
          else null
        end
      ),
      20000
    ),
    job_keywords,
    '/jobs/' || job_row.slug,
    'public',
    'active',
    case
      when business_row.verification_status = 'verified' then 10
      else 0
    end,
    jsonb_strip_nulls(jsonb_build_object(
      'jobId', job_row.id,
      'jobSlug', job_row.slug,
      'businessId', business_row.id,
      'businessName', business_row.name,
      'businessSlug', business_row.slug,
      'businessLogoUrl', business_row.logo_url,
      'businessVerificationStatus', business_row.verification_status,
      'category', job_row.category,
      'employmentType', job_row.employment_type,
      'workplaceType', job_row.workplace_type,
      'experienceLevel', job_row.experience_level,
      'city', job_row.city,
      'region', job_row.region,
      'postalCode', job_row.postal_code,
      'countryCode', job_row.country_code,
      'compensationMin', job_row.compensation_min,
      'compensationMax', job_row.compensation_max,
      'compensationCurrency', job_row.compensation_currency,
      'compensationPeriod', job_row.compensation_period,
      'showCompensation', job_row.show_compensation,
      'skills', job_row.skills,
      'benefits', job_row.benefits,
      'applicationDeadline', job_row.application_deadline,
      'expiresAt', job_row.expires_at
    )),
    job_row.created_at,
    greatest(job_row.updated_at, business_row.updated_at)
  )
  on conflict (source_table, entity_id)
  do update set
    entity_type = excluded.entity_type,
    parent_id = excluded.parent_id,
    room_id = excluded.room_id,
    owner_id = excluded.owner_id,
    title = excluded.title,
    summary = excluded.summary,
    body = excluded.body,
    keywords = excluded.keywords,
    href = excluded.href,
    visibility = excluded.visibility,
    status = excluded.status,
    signal_score = excluded.signal_score,
    metadata = excluded.metadata,
    source_created_at = excluded.source_created_at,
    source_updated_at = excluded.source_updated_at,
    updated_at = now();
end;
$$;

create or replace function public.sync_local_job_search()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_job_id uuid;
begin
  target_job_id := case
    when tg_op = 'DELETE' then old.id
    else new.id
  end;

  perform public.index_local_job_search(target_job_id);

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create or replace function public.sync_business_jobs_search()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  job_id uuid;
begin
  for job_id in
    select job.id
    from public.job_postings job
    where job.business_id = new.id
  loop
    perform public.index_local_job_search(job_id);
  end loop;

  return new;
end;
$$;

drop trigger if exists sync_local_job_search_postings
  on public.job_postings;
create trigger sync_local_job_search_postings
after insert or update or delete on public.job_postings
for each row execute function public.sync_local_job_search();

drop trigger if exists sync_business_jobs_search_businesses
  on public.businesses;
create trigger sync_business_jobs_search_businesses
after update of
  owner_id,
  name,
  slug,
  category,
  logo_url,
  verification_status,
  status
on public.businesses
for each row execute function public.sync_business_jobs_search();

do $$
declare
  job_id uuid;
begin
  perform public.expire_local_job_postings();

  for job_id in
    select job.id
    from public.job_postings job
  loop
    perform public.index_local_job_search(job_id);
  end loop;
end;
$$;

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
values (
  'platform_pages',
  'page',
  '4f7943b0-ff93-44be-a584-1056f90a51c7'::uuid,
  'Jobs Directory',
  'Browse approved jobs connected to attributable Loombus employer profiles.',
  'Find structured job postings, employer identity, workplace type, compensation, skills, deadlines, and original application sources.',
  array[
    'jobs',
    'job directory',
    'hiring',
    'employment',
    'careers',
    'internships',
    'remote jobs',
    'local jobs',
    'apply'
  ],
  '/jobs',
  'public',
  'active',
  0,
  jsonb_build_object('category', 'Real-world action'),
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
  metadata = excluded.metadata,
  source_updated_at = now(),
  updated_at = now();

revoke all on function public.index_local_job_search(uuid)
  from public, anon, authenticated;
revoke all on function public.sync_local_job_search()
  from public, anon, authenticated;
revoke all on function public.sync_business_jobs_search()
  from public, anon, authenticated;

grant execute on function public.index_local_job_search(uuid)
  to service_role;


-- Keep time-sensitive job results out of Everything Search after their
-- application deadline or optional posting expiration passes.
create or replace function public.search_loombus_documents(
  search_text text,
  viewer_user_id uuid default null,
  viewer_has_premium boolean default false,
  result_limit integer default 60
)
returns table (
  document_id uuid,
  entity_type text,
  entity_id uuid,
  parent_id uuid,
  room_id uuid,
  owner_id uuid,
  title text,
  snippet text,
  href text,
  visibility text,
  signal_score numeric,
  source_created_at timestamptz,
  metadata jsonb,
  rank real
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  clean_query text := trim(coalesce(search_text, ''));
  capped_limit integer := least(greatest(coalesce(result_limit, 60), 1), 100);
  query_tree tsquery;
begin
  if char_length(clean_query) < 2 then
    return;
  end if;

  query_tree := websearch_to_tsquery('simple', clean_query);

  return query
  with accessible as (
    select
      document.*,
      ts_rank_cd(document.search_vector, query_tree)::real as lexical_rank,
      case
        when lower(document.title) = lower(clean_query) then 0.75
        when lower(document.title) like lower(clean_query) || '%' then 0.5
        when document.title ilike '%' || clean_query || '%' then 0.3
        else 0
      end::real as title_boost,
      greatest(
        0,
        0.12 - (
          extract(
            epoch from (
              now() - coalesce(document.source_created_at, document.created_at)
            )
          ) / 315576000
        )
      )::real as recency_boost
    from public.loombus_search_documents document
    where document.status = 'active'
      and (
        document.entity_type <> 'job'
        or (
          (
            nullif(document.metadata ->> 'expiresAt', '') is null
            or (
              nullif(document.metadata ->> 'expiresAt', '')::timestamptz
              > now()
            )
          )
          and (
            nullif(document.metadata ->> 'applicationDeadline', '') is null
            or (
              nullif(
                document.metadata ->> 'applicationDeadline',
                ''
              )::date >= current_date
            )
          )
        )
      )
      and (
        document.visibility = 'public'
        or (
          viewer_user_id is not null
          and document.visibility = 'authenticated'
        )
        or (
          viewer_user_id is not null
          and viewer_has_premium
          and document.visibility = 'premium'
        )
        or (
          viewer_user_id is not null
          and document.visibility = 'private'
          and document.owner_id = viewer_user_id
        )
        or (
          viewer_user_id is not null
          and document.visibility = 'member'
          and document.room_id is not null
          and (
            exists (
              select 1
              from public.rooms room
              where room.id = document.room_id
                and (
                  room.owner_id = viewer_user_id
                  or room.created_by = viewer_user_id
                )
            )
            or exists (
              select 1
              from public.room_members member
              where member.room_id = document.room_id
                and member.user_id = viewer_user_id
                and coalesce(member.status, 'active')
                  not in ('blocked', 'removed', 'inactive')
                and (
                  member.suspended_until is null
                  or member.suspended_until <= now()
                )
            )
          )
        )
      )
      and (
        document.source_table not in (
          'replies',
          'discussion_summaries',
          'discussion_attachments'
        )
        or exists (
          select 1
          from public.discussions parent_discussion
          where parent_discussion.id = document.parent_id
            and parent_discussion.deleted_at is null
        )
      )
      and (
        document.search_vector @@ query_tree
        or document.title ilike '%' || clean_query || '%'
        or document.summary ilike '%' || clean_query || '%'
        or document.body ilike '%' || clean_query || '%'
      )
  )
  select
    accessible.id,
    accessible.entity_type,
    accessible.entity_id,
    accessible.parent_id,
    accessible.room_id,
    accessible.owner_id,
    accessible.title,
    left(
      coalesce(
        nullif(accessible.summary, ''),
        nullif(accessible.body, ''),
        ''
      ),
      700
    ),
    accessible.href,
    accessible.visibility,
    accessible.signal_score,
    accessible.source_created_at,
    accessible.metadata,
    (
      accessible.lexical_rank
      + accessible.title_boost
      + accessible.recency_boost
      + least(greatest(accessible.signal_score, 0) / 400, 0.25)
    )::real
  from accessible
  order by
    (
      accessible.lexical_rank
      + accessible.title_boost
      + accessible.recency_boost
      + least(greatest(accessible.signal_score, 0) / 400, 0.25)
    ) desc,
    accessible.source_created_at desc nulls last
  limit capped_limit;
end;
$$;

revoke all on function public.search_loombus_documents(
  text,
  uuid,
  boolean,
  integer
)
  from public, anon, authenticated;

grant execute on function public.search_loombus_documents(
  text,
  uuid,
  boolean,
  integer
)
  to service_role;

notify pgrst, 'reload schema';

commit;
