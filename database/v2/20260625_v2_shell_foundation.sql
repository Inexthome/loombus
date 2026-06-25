-- Loombus V2 shell backend foundation
-- Safe rollout rule: this migration is additive only. It does not alter existing V1 tables,
-- routes, policies, or live user flows.

begin;

create table if not exists public.loombus_feature_flags (
  key text primary key,
  enabled boolean not null default false,
  rollout_percentage integer not null default 0 check (rollout_percentage >= 0 and rollout_percentage <= 100),
  allowed_user_ids uuid[] not null default '{}'::uuid[],
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint loombus_feature_flags_key_format check (key ~ '^[a-z0-9_:-]+$')
);

insert into public.loombus_feature_flags (key, enabled, rollout_percentage, metadata)
values
  ('v2_shell', false, 0, '{"description":"Controls access to the Loombus V2 app shell."}'::jsonb),
  ('v2_signal_brief', false, 0, '{"description":"Controls the V2 Home Signal Brief experience."}'::jsonb),
  ('v2_rooms', false, 0, '{"description":"Controls access to V2 Rooms and room-backed discussions."}'::jsonb)
on conflict (key) do nothing;

create table if not exists public.loombus_shell_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  layout_version text not null default 'v1' check (layout_version in ('v1', 'v2')),
  home_sections jsonb not null default '["needs_attention", "featured_signal", "recent_signals", "rooms"]'::jsonb,
  compact_mode boolean not null default false,
  last_seen_v2_prompt_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.loombus_rooms (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  room_type text not null default 'community' check (room_type in ('community', 'expert', 'lab', 'local', 'private')),
  visibility text not null default 'public' check (visibility in ('public', 'private', 'unlisted')),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid references public.profiles(id) on delete set null,
  member_count integer not null default 0 check (member_count >= 0),
  discussion_count integer not null default 0 check (discussion_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint loombus_rooms_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table if not exists public.loombus_room_members (
  room_id uuid not null references public.loombus_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'moderator', 'member')),
  status text not null default 'active' check (status in ('active', 'pending', 'blocked')),
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table if not exists public.loombus_room_discussions (
  room_id uuid not null references public.loombus_rooms(id) on delete cascade,
  discussion_id uuid not null references public.discussions(id) on delete cascade,
  added_by uuid references public.profiles(id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (room_id, discussion_id)
);

create index if not exists loombus_feature_flags_enabled_idx
  on public.loombus_feature_flags (enabled);

create index if not exists loombus_rooms_status_visibility_idx
  on public.loombus_rooms (status, visibility);

create index if not exists loombus_rooms_type_idx
  on public.loombus_rooms (room_type);

create index if not exists loombus_room_members_user_idx
  on public.loombus_room_members (user_id, status);

create index if not exists loombus_room_discussions_discussion_idx
  on public.loombus_room_discussions (discussion_id);

create or replace function public.loombus_v2_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_loombus_feature_flags_updated_at on public.loombus_feature_flags;
create trigger set_loombus_feature_flags_updated_at
  before update on public.loombus_feature_flags
  for each row execute function public.loombus_v2_set_updated_at();

drop trigger if exists set_loombus_shell_preferences_updated_at on public.loombus_shell_preferences;
create trigger set_loombus_shell_preferences_updated_at
  before update on public.loombus_shell_preferences
  for each row execute function public.loombus_v2_set_updated_at();

drop trigger if exists set_loombus_rooms_updated_at on public.loombus_rooms;
create trigger set_loombus_rooms_updated_at
  before update on public.loombus_rooms
  for each row execute function public.loombus_v2_set_updated_at();

alter table public.loombus_feature_flags enable row level security;
alter table public.loombus_shell_preferences enable row level security;
alter table public.loombus_rooms enable row level security;
alter table public.loombus_room_members enable row level security;
alter table public.loombus_room_discussions enable row level security;

-- Feature flags are safe to read from the app shell. Writes stay server/admin-only by default.
drop policy if exists "Feature flags are readable" on public.loombus_feature_flags;
create policy "Feature flags are readable"
  on public.loombus_feature_flags
  for select
  using (true);

-- Users can manage only their own shell preference row.
drop policy if exists "Users can read own shell preferences" on public.loombus_shell_preferences;
create policy "Users can read own shell preferences"
  on public.loombus_shell_preferences
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own shell preferences" on public.loombus_shell_preferences;
create policy "Users can insert own shell preferences"
  on public.loombus_shell_preferences
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own shell preferences" on public.loombus_shell_preferences;
create policy "Users can update own shell preferences"
  on public.loombus_shell_preferences
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Public rooms are discoverable. Private/unlisted rooms are visible to active members only.
drop policy if exists "Visible rooms are readable" on public.loombus_rooms;
create policy "Visible rooms are readable"
  on public.loombus_rooms
  for select
  using (
    status = 'active'
    and (
      visibility = 'public'
      or exists (
        select 1
        from public.loombus_room_members member
        where member.room_id = loombus_rooms.id
          and member.user_id = auth.uid()
          and member.status = 'active'
      )
    )
  );

-- Members can read their own membership rows. Room member lists stay private for V2 launch.
drop policy if exists "Users can read own room memberships" on public.loombus_room_members;
create policy "Users can read own room memberships"
  on public.loombus_room_members
  for select
  using (auth.uid() = user_id);

-- Room discussion links are readable only when the room itself is readable.
drop policy if exists "Readable room discussion links" on public.loombus_room_discussions;
create policy "Readable room discussion links"
  on public.loombus_room_discussions
  for select
  using (
    exists (
      select 1
      from public.loombus_rooms room
      where room.id = loombus_room_discussions.room_id
    )
  );

comment on table public.loombus_feature_flags is 'Dark-launch flags for Loombus V2 backend and shell features.';
comment on table public.loombus_shell_preferences is 'Per-user shell/layout preference storage for Loombus V2.';
comment on table public.loombus_rooms is 'V2 room directory for communities, labs, local spaces, and private groups.';
comment on table public.loombus_room_members is 'Membership table for V2 rooms.';
comment on table public.loombus_room_discussions is 'Join table linking existing discussions into V2 rooms.';

commit;
