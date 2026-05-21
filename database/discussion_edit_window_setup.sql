-- Discussion Edit Window setup for Loombus
-- Purpose:
-- - Add edit metadata to published discussions.
-- - Support server-enforced edit windows.
-- - Preserve existing public discussion behavior.
-- - Enable audit logging for discussion updates.

alter table if exists public.discussions
  add column if not exists updated_at timestamptz;

alter table if exists public.discussions
  add column if not exists edited_at timestamptz;

alter table if exists public.discussions
  add column if not exists edited_by uuid references auth.users(id) on delete set null;

alter table if exists public.discussions
  add column if not exists edit_count integer not null default 0;

alter table if exists public.discussions
  add constraint discussions_edit_count_nonnegative
  check (edit_count >= 0);

create index if not exists discussions_user_updated_idx
  on public.discussions (user_id, updated_at desc);

create index if not exists discussions_edited_at_idx
  on public.discussions (edited_at desc)
  where edited_at is not null;

comment on column public.discussions.updated_at is
'Timestamp of the most recent discussion content update.';

comment on column public.discussions.edited_at is
'Timestamp of the most recent user-visible edit.';

comment on column public.discussions.edited_by is
'User id that most recently edited the discussion.';

comment on column public.discussions.edit_count is
'Number of times the published discussion has been edited.';
