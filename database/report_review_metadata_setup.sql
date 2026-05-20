-- Loombus report review metadata support
-- Run this in Supabase SQL Editor before deploying report-resolution UI code.

alter table public.reports
add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;

alter table public.reports
add column if not exists reviewed_at timestamptz;

alter table public.reports
add column if not exists resolution_note text;

create index if not exists reports_reviewed_by_idx
on public.reports(reviewed_by);

create index if not exists reports_reviewed_at_idx
on public.reports(reviewed_at);

comment on column public.reports.reviewed_by is
'Admin profile id that reviewed or resolved the report.';

comment on column public.reports.reviewed_at is
'Timestamp when an admin marked the report reviewed.';

comment on column public.reports.resolution_note is
'Optional admin note describing how the report was handled.';
