-- Discussion tags setup for Loombus
-- Purpose:
-- - Add optional secondary labels beyond a discussion's main topic.
-- - Keep main topic as the primary lane.
-- - Use tags for discovery, nuance, and future recommendation support.

create table if not exists public.discussion_tags (
  id uuid primary key default gen_random_uuid(),
  discussion_id uuid not null references public.discussions(id) on delete cascade,
  tag text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint discussion_tags_tag_length
    check (char_length(trim(tag)) between 2 and 40),
  constraint discussion_tags_tag_format
    check (tag ~ '^[A-Za-z0-9][A-Za-z0-9 &+.#''-]{0,38}[A-Za-z0-9]$')
);

create unique index if not exists discussion_tags_discussion_lower_tag_idx
  on public.discussion_tags (discussion_id, lower(tag));

create index if not exists discussion_tags_discussion_id_idx
  on public.discussion_tags (discussion_id);

create index if not exists discussion_tags_lower_tag_idx
  on public.discussion_tags (lower(tag));

alter table public.discussion_tags enable row level security;

drop policy if exists "Anyone can read discussion tags" on public.discussion_tags;
create policy "Anyone can read discussion tags"
  on public.discussion_tags
  for select
  using (true);

comment on table public.discussion_tags is
  'Optional secondary tags for discussions beyond the primary topic lane.';

comment on column public.discussion_tags.tag is
  'Short human-readable tag such as AI ethics, publishing, startups, or housing.';
