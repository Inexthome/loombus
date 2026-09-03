-- Canonical member-controlled preferences used by the Editorial Settings workspace.
-- Existing specialized tables (notification_preferences, member_privacy_settings,
-- discussion_audience_preferences, etc.) remain authoritative for their current
-- behavior. This table stores the expanded cross-surface preferences that did
-- not previously have a canonical member setting.

create table if not exists public.member_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_settings_preferences_object
    check (jsonb_typeof(preferences) = 'object')
);

alter table public.member_settings enable row level security;

revoke all on table public.member_settings from anon;
grant select, insert, update on table public.member_settings to authenticated;

drop policy if exists "member_settings_select_own" on public.member_settings;
create policy "member_settings_select_own"
  on public.member_settings
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "member_settings_insert_own" on public.member_settings;
create policy "member_settings_insert_own"
  on public.member_settings
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "member_settings_update_own" on public.member_settings;
create policy "member_settings_update_own"
  on public.member_settings
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists member_settings_updated_at_idx
  on public.member_settings (updated_at desc);

comment on table public.member_settings is
  'Private member preference state for cross-surface Loombus Settings controls.';
comment on column public.member_settings.preferences is
  'Validated preference object. Never expose through public profile/search APIs.';
