-- Loombus Phase 5.6: Private Contribution Goals
-- Adds private user-owned purpose/contribution goals.
-- This is not therapy, diagnosis, life coaching, scoring, ranking, or public reputation.

create table if not exists public.user_purpose_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  purpose_lane text null,
  private_note text null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz null,
  constraint user_purpose_goals_title_length_check
    check (char_length(trim(title)) between 1 and 120),
  constraint user_purpose_goals_private_note_length_check
    check (private_note is null or char_length(private_note) <= 1000),
  constraint user_purpose_goals_status_check
    check (status in ('active', 'paused', 'completed')),
  constraint user_purpose_goals_purpose_lane_check
    check (
      purpose_lane is null
      or purpose_lane in (
        'Learning',
        'Mastery',
        'Contribution',
        'Community',
        'Career transition',
        'Human development',
        'Local problem-solving',
        'Life after automation'
      )
    )
);

create index if not exists user_purpose_goals_user_status_updated_idx
on public.user_purpose_goals (user_id, status, updated_at desc);

create index if not exists user_purpose_goals_user_purpose_lane_idx
on public.user_purpose_goals (user_id, purpose_lane)
where purpose_lane is not null;

alter table public.user_purpose_goals enable row level security;

revoke all on table public.user_purpose_goals from anon;
grant select, insert, update, delete on table public.user_purpose_goals to authenticated;

drop policy if exists "Users can read their own purpose goals"
on public.user_purpose_goals;

create policy "Users can read their own purpose goals"
on public.user_purpose_goals
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can create their own purpose goals"
on public.user_purpose_goals;

create policy "Users can create their own purpose goals"
on public.user_purpose_goals
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own purpose goals"
on public.user_purpose_goals;

create policy "Users can update their own purpose goals"
on public.user_purpose_goals
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own purpose goals"
on public.user_purpose_goals;

create policy "Users can delete their own purpose goals"
on public.user_purpose_goals
for delete
to authenticated
using (auth.uid() = user_id);

comment on table public.user_purpose_goals is
'Private user-owned contribution and purpose goals. Not public reputation, therapy, diagnosis, life coaching, scoring, or ranking.';

comment on column public.user_purpose_goals.purpose_lane is
'Optional Purpose Lane connection for a private goal.';

comment on column public.user_purpose_goals.private_note is
'Private note for why this goal matters or what the user may do next.';
