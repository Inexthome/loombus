create extension if not exists pgcrypto;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  type text not null default 'Room',
  visibility text not null default 'public',
  is_private boolean not null default false,
  member_count integer not null default 0,
  activity_count integer not null default 0,
  last_activity_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.room_members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'rooms'
      and policyname = 'Authenticated users can view rooms'
  ) then
    create policy "Authenticated users can view rooms"
      on public.rooms
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'rooms'
      and policyname = 'Admins can manage rooms'
  ) then
    create policy "Admins can manage rooms"
      on public.rooms
      for all
      to authenticated
      using (
        exists (
          select 1 from public.profiles
          where profiles.id = auth.uid()
            and profiles.is_admin = true
        )
      )
      with check (
        exists (
          select 1 from public.profiles
          where profiles.id = auth.uid()
            and profiles.is_admin = true
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'room_members'
      and policyname = 'Users can view their room memberships'
  ) then
    create policy "Users can view their room memberships"
      on public.room_members
      for select
      to authenticated
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'room_members'
      and policyname = 'Admins can manage room memberships'
  ) then
    create policy "Admins can manage room memberships"
      on public.room_members
      for all
      to authenticated
      using (
        exists (
          select 1 from public.profiles
          where profiles.id = auth.uid()
            and profiles.is_admin = true
        )
      )
      with check (
        exists (
          select 1 from public.profiles
          where profiles.id = auth.uid()
            and profiles.is_admin = true
        )
      );
  end if;
end $$;

insert into public.rooms (
  id,
  name,
  description,
  type,
  visibility,
  is_private,
  member_count,
  activity_count,
  last_activity_at
)
values (
  '11111111-1111-4111-8111-111111111111'::uuid,
  'Quiet Creek Residents',
  'A private room for Quiet Creek residents to share updates, ask questions, and keep community conversations organized away from the public discussion feed.',
  'Local Community',
  'private',
  true,
  1,
  0,
  now()
)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  type = excluded.type,
  visibility = excluded.visibility,
  is_private = excluded.is_private,
  member_count = greatest(public.rooms.member_count, excluded.member_count),
  updated_at = now();
