-- V2 discussions are separate from the live V1 discussions table.
-- This supports the internal V2 lifecycle without adding items to the public feed.

create extension if not exists pgcrypto;

create table if not exists public.loombus_v2_discussions (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  source_draft_id uuid null,
  title text not null,
  topic text not null,
  original_topic text null,
  body text not null,
  mode text not null default 'open_discussion',
  tags text[] not null default '{}'::text[],
  discussion_metadata jsonb not null default '{}'::jsonb,
  status text not null default 'internal_preview',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint loombus_v2_discussions_title_length check (char_length(trim(title)) >= 8),
  constraint loombus_v2_discussions_topic_length check (char_length(trim(topic)) >= 2),
  constraint loombus_v2_discussions_body_length check (char_length(trim(body)) >= 40),
  constraint loombus_v2_discussions_mode_check check (
    mode in ('open_discussion', 'debate', 'research_question', 'problem_solving')
  ),
  constraint loombus_v2_discussions_status_check check (
    status in ('internal_preview', 'ready_for_review', 'archived')
  ),
  constraint loombus_v2_discussions_tags_limit check (array_length(tags, 1) is null or array_length(tags, 1) <= 6)
);

create index if not exists loombus_v2_discussions_author_created_idx
  on public.loombus_v2_discussions (author_id, created_at desc);

create index if not exists loombus_v2_discussions_status_created_idx
  on public.loombus_v2_discussions (status, created_at desc);

alter table public.loombus_v2_discussions enable row level security;

drop policy if exists "Own V2 discussion previews are readable" on public.loombus_v2_discussions;
create policy "Own V2 discussion previews are readable"
  on public.loombus_v2_discussions
  for select
  using (auth.uid() = author_id);

drop policy if exists "Own V2 discussion previews are insertable" on public.loombus_v2_discussions;
create policy "Own V2 discussion previews are insertable"
  on public.loombus_v2_discussions
  for insert
  with check (auth.uid() = author_id);

drop policy if exists "Own V2 discussion previews are editable" on public.loombus_v2_discussions;
create policy "Own V2 discussion previews are editable"
  on public.loombus_v2_discussions
  for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);
