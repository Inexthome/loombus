-- Live Rooms core storage and privacy boundaries.
-- This migration activates the existing Rooms contracts without adding room checkout,
-- file storage, video hosting, or public-room discovery behavior.

begin;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  room_type text not null default 'community',
  visibility text not null default 'private',
  status text not null default 'active',
  owner_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  template_key text,
  subscription_plan text not null default 'free',
  subscription_status text not null default 'active',
  member_limit integer,
  invite_only boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.rooms
  add column if not exists name text,
  add column if not exists description text not null default '',
  add column if not exists room_type text not null default 'community',
  add column if not exists visibility text not null default 'private',
  add column if not exists status text not null default 'active',
  add column if not exists owner_id uuid references auth.users(id) on delete set null,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists template_key text,
  add column if not exists subscription_plan text not null default 'free',
  add column if not exists subscription_status text not null default 'active',
  add column if not exists member_limit integer,
  add column if not exists invite_only boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  status text not null default 'active',
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.room_members
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists role text not null default 'member',
  add column if not exists status text not null default 'active',
  add column if not exists joined_at timestamptz not null default now(),
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists room_members_room_user_unique_idx
  on public.room_members (room_id, user_id);
create unique index if not exists room_members_id_unique_idx
  on public.room_members (id);
create index if not exists room_members_user_status_idx
  on public.room_members (user_id, status);
create index if not exists room_members_room_status_idx
  on public.room_members (room_id, status);

create table if not exists public.room_posts (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  title text,
  body text not null,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  deletion_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.room_posts
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null,
  add column if not exists deletion_reason text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists room_posts_room_created_idx
  on public.room_posts (room_id, created_at desc);
create index if not exists room_posts_author_idx
  on public.room_posts (author_id, created_at desc);
create index if not exists room_posts_room_active_idx
  on public.room_posts (room_id, created_at desc)
  where deleted_at is null;

create table if not exists public.room_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  title text not null,
  description text,
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  created_by uuid not null references auth.users(id) on delete cascade,
  interested_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.room_events
  add column if not exists description text,
  add column if not exists location text,
  add column if not exists ends_at timestamptz,
  add column if not exists interested_count integer not null default 0,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists room_events_room_starts_idx
  on public.room_events (room_id, starts_at);
create index if not exists room_events_creator_idx
  on public.room_events (created_by);

create table if not exists public.room_announcements (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  title text not null,
  body text not null,
  priority text not null default 'normal',
  is_pinned boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.room_announcements
  add column if not exists priority text not null default 'normal',
  add column if not exists is_pinned boolean not null default false,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists room_announcements_room_created_idx
  on public.room_announcements (room_id, created_at desc);
create index if not exists room_announcements_room_pinned_idx
  on public.room_announcements (room_id, is_pinned desc, created_at desc);

create table if not exists public.room_applications (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  applicant_id uuid not null references auth.users(id) on delete cascade,
  state text not null default 'pending',
  note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.room_applications
  add column if not exists state text not null default 'pending',
  add column if not exists note text,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists room_applications_room_applicant_unique_idx
  on public.room_applications (room_id, applicant_id);
create index if not exists room_applications_room_state_idx
  on public.room_applications (room_id, state, created_at desc);
create index if not exists room_applications_applicant_idx
  on public.room_applications (applicant_id, created_at desc);

create or replace function public.touch_live_room_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

select public.touch_live_room_updated_at();

-- The preceding function is trigger-only. Remove the direct-call artifact if a database
-- version rejects trigger functions when called directly.

-- Recreate updated-at triggers idempotently.
drop trigger if exists touch_rooms_updated_at on public.rooms;
create trigger touch_rooms_updated_at
before update on public.rooms
for each row execute function public.touch_live_room_updated_at();

drop trigger if exists touch_room_members_updated_at on public.room_members;
create trigger touch_room_members_updated_at
before update on public.room_members
for each row execute function public.touch_live_room_updated_at();

drop trigger if exists touch_room_posts_updated_at on public.room_posts;
create trigger touch_room_posts_updated_at
before update on public.room_posts
for each row execute function public.touch_live_room_updated_at();

drop trigger if exists touch_room_events_live_updated_at on public.room_events;
create trigger touch_room_events_live_updated_at
before update on public.room_events
for each row execute function public.touch_live_room_updated_at();

drop trigger if exists touch_room_announcements_updated_at on public.room_announcements;
create trigger touch_room_announcements_updated_at
before update on public.room_announcements
for each row execute function public.touch_live_room_updated_at();

drop trigger if exists touch_room_applications_updated_at on public.room_applications;
create trigger touch_room_applications_updated_at
before update on public.room_applications
for each row execute function public.touch_live_room_updated_at();

create or replace function public.user_is_active_room_member(target_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.room_members member
    where member.room_id = target_room_id
      and member.user_id = auth.uid()
      and coalesce(member.status, 'active') not in ('blocked', 'removed', 'inactive')
  )
  or exists (
    select 1
    from public.rooms room
    where room.id = target_room_id
      and (room.owner_id = auth.uid() or room.created_by = auth.uid())
  );
$$;

create or replace function public.user_can_manage_live_room(target_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.rooms room
    where room.id = target_room_id
      and (room.owner_id = auth.uid() or room.created_by = auth.uid())
  )
  or exists (
    select 1
    from public.room_members member
    where member.room_id = target_room_id
      and member.user_id = auth.uid()
      and coalesce(member.status, 'active') not in ('blocked', 'removed', 'inactive')
      and member.role in ('owner', 'admin', 'administrator')
  );
$$;

create or replace function public.user_can_moderate_live_room(target_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.user_can_manage_live_room(target_room_id)
  or exists (
    select 1
    from public.room_members member
    where member.room_id = target_room_id
      and member.user_id = auth.uid()
      and coalesce(member.status, 'active') not in ('blocked', 'removed', 'inactive')
      and member.role = 'moderator'
  );
$$;

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.room_posts enable row level security;
alter table public.room_events enable row level security;
alter table public.room_announcements enable row level security;
alter table public.room_applications enable row level security;

-- Canonical clients read only records for rooms they can enter. All mutations are routed
-- through authenticated server endpoints after account and role verification.
drop policy if exists "Live room records are visible to active members" on public.rooms;
create policy "Live room records are visible to active members"
on public.rooms for select to authenticated
using (public.user_is_active_room_member(id));

drop policy if exists "Live room members are visible inside the room" on public.room_members;
create policy "Live room members are visible inside the room"
on public.room_members for select to authenticated
using (public.user_is_active_room_member(room_id));

drop policy if exists "Live room posts are visible inside the room" on public.room_posts;
create policy "Live room posts are visible inside the room"
on public.room_posts for select to authenticated
using (deleted_at is null and public.user_is_active_room_member(room_id));

drop policy if exists "Live room events are visible inside the room" on public.room_events;
create policy "Live room events are visible inside the room"
on public.room_events for select to authenticated
using (public.user_is_active_room_member(room_id));

drop policy if exists "Live room announcements are visible inside the room" on public.room_announcements;
create policy "Live room announcements are visible inside the room"
on public.room_announcements for select to authenticated
using (public.user_is_active_room_member(room_id));

drop policy if exists "Live room applications are visible to applicant or managers" on public.room_applications;
create policy "Live room applications are visible to applicant or managers"
on public.room_applications for select to authenticated
using (
  applicant_id = auth.uid()
  or public.user_can_manage_live_room(room_id)
);

revoke all on table public.rooms from anon;
revoke all on table public.room_members from anon;
revoke all on table public.room_posts from anon;
revoke all on table public.room_events from anon;
revoke all on table public.room_announcements from anon;
revoke all on table public.room_applications from anon;

revoke insert, update, delete on table public.rooms from authenticated;
revoke insert, update, delete on table public.room_members from authenticated;
revoke insert, update, delete on table public.room_posts from authenticated;
revoke insert, update, delete on table public.room_events from authenticated;
revoke insert, update, delete on table public.room_announcements from authenticated;
revoke insert, update, delete on table public.room_applications from authenticated;

grant select on table public.rooms to authenticated;
grant select on table public.room_members to authenticated;
grant select on table public.room_posts to authenticated;
grant select on table public.room_events to authenticated;
grant select on table public.room_announcements to authenticated;
grant select on table public.room_applications to authenticated;

alter table public.rooms replica identity full;
alter table public.room_members replica identity full;
alter table public.room_posts replica identity full;
alter table public.room_events replica identity full;
alter table public.room_announcements replica identity full;
alter table public.room_applications replica identity full;

do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'rooms',
    'room_members',
    'room_posts',
    'room_events',
    'room_announcements',
    'room_applications'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = relation_name
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        relation_name
      );
    end if;
  end loop;
end;
$$;

comment on table public.rooms is
  'Private Loombus room records used by the canonical Live Rooms workspace.';
comment on table public.room_posts is
  'Structured private room discussion posts. Soft-deleted posts remain auditable.';
comment on table public.room_events is
  'Room calendar events visible only to active room members.';
comment on table public.room_announcements is
  'Role-controlled room announcements visible only inside the room.';
comment on table public.room_applications is
  'Private membership requests reviewed by room owners and administrators.';

notify pgrst, 'reload schema';

commit;
