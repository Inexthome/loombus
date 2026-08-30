create table if not exists public.questions_of_the_week (
  id uuid primary key default gen_random_uuid(),
  discussion_id uuid not null references public.discussions(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  category text not null,
  why_now text,
  source_context jsonb not null default '[]'::jsonb,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint questions_of_the_week_valid_window check (week_end >= week_start),
  constraint questions_of_the_week_category_length check (char_length(category) between 1 and 80),
  constraint questions_of_the_week_why_now_length check (why_now is null or char_length(why_now) <= 700),
  constraint questions_of_the_week_week_start_key unique (week_start),
  constraint questions_of_the_week_discussion_id_key unique (discussion_id)
);

create index if not exists questions_of_the_week_published_at_idx
  on public.questions_of_the_week (published_at desc);

alter table public.questions_of_the_week enable row level security;

drop policy if exists "Questions of the week are publicly readable" on public.questions_of_the_week;
create policy "Questions of the week are publicly readable"
  on public.questions_of_the_week
  for select
  using (published_at <= now());

comment on table public.questions_of_the_week is
  'Editorial metadata that promotes one existing Loombus discussion as the official Question of the Week for a calendar window.';
comment on column public.questions_of_the_week.discussion_id is
  'The canonical discussion. Replies, evidence, intelligence, moderation, and all discussion behavior remain in the existing discussion system.';
comment on column public.questions_of_the_week.source_context is
  'Optional provenance metadata used by the weekly selection/generation workflow. This table does not replace discussion sources or evidence.';
