-- Reply edit window setup for Loombus
-- Purpose:
-- - Allow limited, accountable reply edits.
-- - Keep replies structured without adding nested threads.
-- - Store edit metadata for transparency.

alter table public.replies
  add column if not exists updated_at timestamptz;

alter table public.replies
  add column if not exists edited_at timestamptz;

alter table public.replies
  add column if not exists edited_by uuid references auth.users(id) on delete set null;

alter table public.replies
  add column if not exists edit_count integer not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'replies_edit_count_nonnegative'
  ) then
    alter table public.replies
      add constraint replies_edit_count_nonnegative
      check (edit_count >= 0);
  end if;
end $$;

create index if not exists replies_user_updated_at_idx
  on public.replies (user_id, updated_at desc)
  where deleted_at is null;

create index if not exists replies_edited_at_idx
  on public.replies (edited_at desc)
  where edited_at is not null;

comment on column public.replies.updated_at is
  'Timestamp when a reply was last updated.';

comment on column public.replies.edited_at is
  'Timestamp when a reply was last edited by a user or admin.';

comment on column public.replies.edited_by is
  'User id of the member or admin who last edited the reply.';

comment on column public.replies.edit_count is
  'Number of times a reply has been edited.';
