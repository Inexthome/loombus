create table if not exists public.policy_content_daily_analytics (
  event_date date not null,
  surface text not null,
  document_id text not null,
  version text not null,
  view_count bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_date, surface, document_id, version),
  constraint policy_content_daily_analytics_surface_check
    check (surface in ('current', 'history', 'archive')),
  constraint policy_content_daily_analytics_document_id_check
    check (char_length(document_id) between 1 and 80),
  constraint policy_content_daily_analytics_version_check
    check (version ~ '^\d{4}\.\d{2}\.\d{2}\.\d+$'),
  constraint policy_content_daily_analytics_view_count_check
    check (view_count >= 0)
);

comment on table public.policy_content_daily_analytics is
  'Privacy-minimized daily aggregate page-view counts for public policy surfaces. Contains no user, session, device, network, location, referrer, search, dwell-time, or scroll data.';

alter table public.policy_content_daily_analytics enable row level security;

revoke all on table public.policy_content_daily_analytics from public, anon, authenticated;
grant select on table public.policy_content_daily_analytics to service_role;

drop function if exists public.increment_policy_content_daily_analytics(text, text, text);

create function public.increment_policy_content_daily_analytics(
  p_surface text,
  p_document_id text,
  p_version text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_surface not in ('current', 'history', 'archive') then
    raise exception 'invalid policy analytics surface';
  end if;

  if p_document_id is null or char_length(btrim(p_document_id)) not between 1 and 80 then
    raise exception 'invalid policy analytics document id';
  end if;

  if p_version is null or p_version !~ '^\d{4}\.\d{2}\.\d{2}\.\d+$' then
    raise exception 'invalid policy analytics version';
  end if;

  insert into public.policy_content_daily_analytics (
    event_date,
    surface,
    document_id,
    version,
    view_count
  )
  values (
    (now() at time zone 'utc')::date,
    p_surface,
    btrim(p_document_id),
    p_version,
    1
  )
  on conflict (event_date, surface, document_id, version)
  do update set
    view_count = public.policy_content_daily_analytics.view_count + 1,
    updated_at = now();
end;
$$;

revoke all on function public.increment_policy_content_daily_analytics(text, text, text) from public, anon, authenticated;
grant execute on function public.increment_policy_content_daily_analytics(text, text, text) to service_role;
