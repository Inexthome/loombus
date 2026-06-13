create table if not exists public.paste_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature_key text not null check (
    feature_key in ('discussion_body_paste', 'reply_body_paste')
  ),
  character_count integer not null check (
    character_count > 0 and character_count <= 100000
  ),
  created_at timestamptz not null default now()
);

create index if not exists paste_usage_events_user_created_idx
  on public.paste_usage_events (user_id, created_at desc);

alter table public.paste_usage_events enable row level security;

drop policy if exists "Users can read own paste usage" on public.paste_usage_events;
create policy "Users can read own paste usage"
  on public.paste_usage_events
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own paste usage" on public.paste_usage_events;
create policy "Users can insert own paste usage"
  on public.paste_usage_events
  for insert
  with check (auth.uid() = user_id);
