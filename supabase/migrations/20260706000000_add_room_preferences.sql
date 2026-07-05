create table if not exists public.room_preferences (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 160),
  description text not null default '' check (char_length(description) <= 4000),
  privacy_mode text not null default 'private' check (privacy_mode in ('private', 'restricted', 'public_preview')),
  room_status text not null default 'active' check (room_status in ('active', 'paused', 'archived')),
  posting_rule text not null default 'members' check (posting_rule in ('members', 'contributors', 'admins')),
  join_rule text not null default 'owner_add_only' check (join_rule in ('owner_add_only', 'request_to_join', 'invite_only')),
  room_icon text not null default 'hub' check (char_length(room_icon) <= 80),
  theme_label text not null default 'default' check (char_length(theme_label) <= 80),
  calendar_enabled boolean not null default true,
  announcements_enabled boolean not null default true,
  requests_enabled boolean not null default true,
  resources_enabled boolean not null default true,
  services_enabled boolean not null default true,
  members_enabled boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists room_preferences_room_status_idx on public.room_preferences (room_status);
create index if not exists room_preferences_privacy_mode_idx on public.room_preferences (privacy_mode);

alter table public.room_preferences enable row level security;

create or replace function public.user_can_access_room_preferences(target_room_id uuid)
returns boolean
language sql
security definer
set search_path = 'public'
as $function$
  select
    exists (
      select 1
      from public.room_members member
      where member.room_id = target_room_id
        and member.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.rooms room
      where room.id = target_room_id
        and (room.owner_id = auth.uid() or room.created_by = auth.uid())
    );
$function$;

create or replace function public.user_can_manage_room_preferences(target_room_id uuid)
returns boolean
language sql
security definer
set search_path = 'public'
as $function$
  select
    exists (
      select 1
      from public.room_members member
      where member.room_id = target_room_id
        and member.user_id = auth.uid()
        and member.role in ('owner', 'admin')
    )
    or exists (
      select 1
      from public.rooms room
      where room.id = target_room_id
        and (room.owner_id = auth.uid() or room.created_by = auth.uid())
    );
$function$;

drop policy if exists "Room members can view room preferences" on public.room_preferences;
create policy "Room members can view room preferences"
  on public.room_preferences
  for select
  using (public.user_can_access_room_preferences(room_id));

drop policy if exists "Room owners and admins can create room preferences" on public.room_preferences;
create policy "Room owners and admins can create room preferences"
  on public.room_preferences
  for insert
  with check (
    created_by = auth.uid()
    and public.user_can_manage_room_preferences(room_id)
  );

drop policy if exists "Room owners and admins can update room preferences" on public.room_preferences;
create policy "Room owners and admins can update room preferences"
  on public.room_preferences
  for update
  using (public.user_can_manage_room_preferences(room_id))
  with check (public.user_can_manage_room_preferences(room_id));
