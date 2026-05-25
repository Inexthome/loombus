-- Pinned reply setup for Loombus
-- Purpose:
-- - Let discussion authors/admins highlight one high-quality reply.
-- - Keep threads structured without nested replies or chaotic ranking.
-- - Store pin metadata on the discussion itself.

alter table public.discussions
  add column if not exists pinned_reply_id uuid references public.replies(id) on delete set null;

alter table public.discussions
  add column if not exists pinned_at timestamptz;

alter table public.discussions
  add column if not exists pinned_by uuid references auth.users(id) on delete set null;

create index if not exists discussions_pinned_reply_id_idx
  on public.discussions (pinned_reply_id)
  where pinned_reply_id is not null;

create index if not exists discussions_pinned_at_idx
  on public.discussions (pinned_at desc)
  where pinned_at is not null;

comment on column public.discussions.pinned_reply_id is
  'Reply highlighted by a discussion author or admin as especially useful.';

comment on column public.discussions.pinned_at is
  'Timestamp when a reply was pinned to the discussion.';

comment on column public.discussions.pinned_by is
  'User id of the member or admin who pinned the reply.';
