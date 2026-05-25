-- Discussion status setup for Loombus
-- Purpose:
-- - Allow discussion authors/admins to mark discussions as open or resolved.
-- - Keep this as a simple text/check-constraint foundation before UI/API wiring.
-- - Avoid nested-thread complexity.

alter table public.discussions
  add column if not exists discussion_status text not null default 'open';

alter table public.discussions
  add column if not exists resolved_at timestamptz;

alter table public.discussions
  add column if not exists resolved_by uuid references auth.users(id) on delete set null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'discussions_discussion_status_check'
  ) then
    alter table public.discussions
      add constraint discussions_discussion_status_check
      check (discussion_status in ('open', 'resolved'));
  end if;
end $$;

create index if not exists discussions_status_created_at_idx
  on public.discussions (discussion_status, created_at desc)
  where deleted_at is null;

create index if not exists discussions_resolved_at_idx
  on public.discussions (resolved_at desc)
  where resolved_at is not null;

comment on column public.discussions.discussion_status is
  'Discussion state used to distinguish still-open discussions from resolved discussions.';

comment on column public.discussions.resolved_at is
  'Timestamp when a discussion was marked resolved.';

comment on column public.discussions.resolved_by is
  'User id of the member or admin who marked the discussion resolved.';
