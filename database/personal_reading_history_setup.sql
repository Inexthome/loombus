-- Personal Reading History setup for Loombus
-- Purpose:
-- - Reuse existing discussion_views tracking.
-- - Ensure discussion views have a created_at timestamp.
-- - Add indexes for fast per-user reading-history queries.
-- - Do not change existing public view-count behavior.

alter table if exists public.discussion_views
  add column if not exists created_at timestamptz not null default now();

create index if not exists discussion_views_viewer_created_idx
  on public.discussion_views (viewer_id, created_at desc)
  where viewer_id is not null;

create index if not exists discussion_views_discussion_created_idx
  on public.discussion_views (discussion_id, created_at desc);
