-- Loombus profile reporting support
-- Run this in Supabase SQL Editor before deploying profile-report UI code.

alter table public.reports
add column if not exists reported_profile_id uuid references public.profiles(id) on delete cascade;

create index if not exists reports_reported_profile_id_idx
on public.reports(reported_profile_id);

create unique index if not exists reports_unique_profile_report_per_user_idx
on public.reports(reporter_id, reported_profile_id)
where reported_profile_id is not null;

comment on column public.reports.reported_profile_id is
'Profile/user being reported. Used for member-submitted public profile reports.';
