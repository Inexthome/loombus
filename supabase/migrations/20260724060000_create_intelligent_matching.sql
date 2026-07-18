-- Loombus Intelligent Matching foundation.
-- First active pairing: private Request-to-Service and Service-to-Request matches.

begin;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.matching_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  active_sections text[] not null default array['requests', 'services']::text[],
  categories text[] not null default '{}',
  radius_miles integer not null default 25,
  include_remote boolean not null default true,
  minimum_relevance smallint not null default 55,
  notification_frequency text not null default 'weekly',
  matching_paused boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint matching_preferences_sections_check check (
    active_sections <@ array['requests', 'services']::text[]
  ),
  constraint matching_preferences_radius_check check (radius_miles between 1 and 250),
  constraint matching_preferences_relevance_check check (minimum_relevance between 0 and 100),
  constraint matching_preferences_frequency_check check (
    notification_frequency in ('none', 'daily', 'weekly')
  )
);

create table if not exists public.matching_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  source_type text not null,
  target_type text not null,
  categories text[] not null default '{}',
  radius_miles integer not null default 25,
  include_remote boolean not null default true,
  minimum_relevance smallint not null default 55,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint matching_rules_name_check check (char_length(name) between 1 and 80),
  constraint matching_rules_source_check check (source_type in ('request', 'service')),
  constraint matching_rules_target_check check (target_type in ('request', 'service')),
  constraint matching_rules_direction_check check (source_type <> target_type),
  constraint matching_rules_radius_check check (radius_miles between 1 and 250),
  constraint matching_rules_relevance_check check (minimum_relevance between 0 and 100)
);

create index if not exists matching_rules_user_active_idx
  on public.matching_rules (user_id, is_active, updated_at desc);

create table if not exists public.match_candidates (
  id uuid primary key default gen_random_uuid(),
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  source_type text not null,
  source_id uuid not null,
  target_type text not null,
  target_id uuid not null,
  direction text not null,
  eligibility_status text not null default 'eligible',
  internal_confidence smallint not null,
  factors jsonb not null default '{}'::jsonb,
  explanation text[] not null default '{}',
  created_at timestamptz not null default now(),
  refreshed_at timestamptz not null default now(),
  expires_at timestamptz,
  viewed_at timestamptz,
  dismissed_at timestamptz,
  saved_at timestamptz,
  acted_on_at timestamptz,
  constraint match_candidates_source_check check (source_type in ('request', 'service')),
  constraint match_candidates_target_check check (target_type in ('request', 'service')),
  constraint match_candidates_direction_check check (
    direction in ('request_to_service', 'service_to_request')
  ),
  constraint match_candidates_eligibility_check check (
    eligibility_status in ('eligible', 'ineligible', 'expired')
  ),
  constraint match_candidates_confidence_check check (internal_confidence between 0 and 100),
  constraint match_candidates_unique unique (
    viewer_id,
    source_type,
    source_id,
    target_type,
    target_id
  )
);

create index if not exists match_candidates_viewer_status_score_idx
  on public.match_candidates (
    viewer_id,
    eligibility_status,
    internal_confidence desc,
    refreshed_at desc
  );
create index if not exists match_candidates_viewer_saved_idx
  on public.match_candidates (viewer_id, saved_at desc)
  where saved_at is not null;
create index if not exists match_candidates_viewer_dismissed_idx
  on public.match_candidates (viewer_id, dismissed_at desc)
  where dismissed_at is not null;
create index if not exists match_candidates_expiration_idx
  on public.match_candidates (expires_at)
  where expires_at is not null and eligibility_status = 'eligible';

create table if not exists public.match_feedback (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.match_candidates(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  feedback_type text not null,
  note text,
  created_at timestamptz not null default now(),
  constraint match_feedback_type_check check (
    feedback_type in ('helpful', 'not_relevant', 'incorrect', 'unsafe')
  ),
  constraint match_feedback_note_check check (note is null or char_length(note) <= 1000),
  constraint match_feedback_unique unique (candidate_id, user_id)
);

create index if not exists match_feedback_user_created_idx
  on public.match_feedback (user_id, created_at desc);

create table if not exists public.match_deliveries (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.match_candidates(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null,
  status text not null default 'queued',
  scheduled_at timestamptz not null default now(),
  delivered_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  constraint match_deliveries_channel_check check (channel in ('in_app', 'email', 'push')),
  constraint match_deliveries_status_check check (
    status in ('queued', 'sent', 'skipped', 'failed')
  ),
  constraint match_deliveries_error_check check (
    error_message is null or char_length(error_message) <= 1000
  )
);

create index if not exists match_deliveries_user_status_idx
  on public.match_deliveries (user_id, status, scheduled_at desc);
create unique index if not exists match_deliveries_candidate_channel_unique
  on public.match_deliveries (candidate_id, channel);

create or replace function public.touch_intelligent_matching_updated_at()
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

drop trigger if exists touch_matching_preferences_updated_at
  on public.matching_preferences;
create trigger touch_matching_preferences_updated_at
before update on public.matching_preferences
for each row execute function public.touch_intelligent_matching_updated_at();

drop trigger if exists touch_matching_rules_updated_at
  on public.matching_rules;
create trigger touch_matching_rules_updated_at
before update on public.matching_rules
for each row execute function public.touch_intelligent_matching_updated_at();

alter table public.matching_preferences enable row level security;
alter table public.matching_rules enable row level security;
alter table public.match_candidates enable row level security;
alter table public.match_feedback enable row level security;
alter table public.match_deliveries enable row level security;

revoke all on table public.matching_preferences from public, anon, authenticated;
revoke all on table public.matching_rules from public, anon, authenticated;
revoke all on table public.match_candidates from public, anon, authenticated;
revoke all on table public.match_feedback from public, anon, authenticated;
revoke all on table public.match_deliveries from public, anon, authenticated;

revoke all on function public.touch_intelligent_matching_updated_at() from public, anon, authenticated;

grant all on table public.matching_preferences to service_role;
grant all on table public.matching_rules to service_role;
grant all on table public.match_candidates to service_role;
grant all on table public.match_feedback to service_role;
grant all on table public.match_deliveries to service_role;
grant execute on function public.touch_intelligent_matching_updated_at() to service_role;

commit;
