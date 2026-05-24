-- Loombus report status workflow upgrade
--
-- Purpose:
-- Replace the ambiguous open/reviewed report workflow with explicit moderation
-- states while preserving existing report data.
--
-- New report statuses:
-- - new: submitted and not yet triaged
-- - reviewing: admin has started review
-- - dismissed: reviewed with no moderation action
-- - actioned: moderation action was taken
--
-- Existing data migration:
-- - open -> new
-- - reviewed -> dismissed

alter table public.reports
  add column if not exists status_updated_by uuid references public.profiles(id) on delete set null;

alter table public.reports
  add column if not exists status_updated_at timestamptz;

alter table public.reports
  add column if not exists actioned_by uuid references public.profiles(id) on delete set null;

alter table public.reports
  add column if not exists actioned_at timestamptz;

update public.reports
set status = 'new'
where status = 'open';

update public.reports
set status = 'dismissed'
where status = 'reviewed';

alter table public.reports
  alter column status set default 'new';

alter table public.reports
  drop constraint if exists reports_status_check;

alter table public.reports
  add constraint reports_status_check
  check (status in ('new', 'reviewing', 'dismissed', 'actioned'));

create index if not exists reports_status_created_idx
on public.reports(status, created_at desc);

create index if not exists reports_status_updated_by_idx
on public.reports(status_updated_by);

create index if not exists reports_status_updated_at_idx
on public.reports(status_updated_at);

create index if not exists reports_actioned_by_idx
on public.reports(actioned_by);

create index if not exists reports_actioned_at_idx
on public.reports(actioned_at);

comment on column public.reports.status is
'Moderation report workflow status: new, reviewing, dismissed, or actioned.';

comment on column public.reports.status_updated_by is
'Admin who last changed the report workflow status.';

comment on column public.reports.status_updated_at is
'Timestamp when the report workflow status was last changed.';

comment on column public.reports.actioned_by is
'Admin who took a moderation action because of this report, when applicable.';

comment on column public.reports.actioned_at is
'Timestamp when a moderation action was taken because of this report, when applicable.';
