-- Enables persisted room calendar events for the V2 Rooms hub.
-- The V2 room UI already reads and writes public.room_events; this migration
-- makes that storage layer explicit and keeps access limited to room owners and members.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.room_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 180),
  description text,
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  created_by uuid not null references auth.users(id) on delete cascade,
  interested_count integer not null default 0 check (interested_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint room_events_valid_time_range check (ends_at is null or ends_at >= starts_at)
);

alter table public.room_events
  add column if not exists description text,
  add column if not exists location text,
  add column if not exists ends_at timestamptz,
  add column if not exists interested_count integer not null default 0,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists room_events_room_starts_at_idx
  on public.room_events (room_id, starts_at);

create index if not exists room_events_created_by_idx
  on public.room_events (created_by);

create or replace function public.touch_room_events_updated_at()
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

drop trigger if exists touch_room_events_updated_at on public.room_events;
create trigger touch_room_events_updated_at
before update on public.room_events
for each row
execute function public.touch_room_events_updated_at();

alter table public.room_events enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'room_events'
      and policyname = 'Room members can view room events'
  ) then
    create policy "Room members can view room events"
      on public.room_events
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.rooms room
          where room.id = room_events.room_id
            and (
              room.owner_id = auth.uid()
              or room.created_by = auth.uid()
            )
        )
        or exists (
          select 1
          from public.room_members member
          where member.room_id = room_events.room_id
            and member.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'room_events'
      and policyname = 'Room owners can create room events'
  ) then
    create policy "Room owners can create room events"
      on public.room_events
      for insert
      to authenticated
      with check (
        created_by = auth.uid()
        and exists (
          select 1
          from public.rooms room
          where room.id = room_events.room_id
            and (
              room.owner_id = auth.uid()
              or room.created_by = auth.uid()
            )
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'room_events'
      and policyname = 'Room owners can update room events'
  ) then
    create policy "Room owners can update room events"
      on public.room_events
      for update
      to authenticated
      using (
        exists (
          select 1
          from public.rooms room
          where room.id = room_events.room_id
            and (
              room.owner_id = auth.uid()
              or room.created_by = auth.uid()
            )
        )
      )
      with check (
        exists (
          select 1
          from public.rooms room
          where room.id = room_events.room_id
            and (
              room.owner_id = auth.uid()
              or room.created_by = auth.uid()
            )
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'room_events'
      and policyname = 'Room owners can delete room events'
  ) then
    create policy "Room owners can delete room events"
      on public.room_events
      for delete
      to authenticated
      using (
        exists (
          select 1
          from public.rooms room
          where room.id = room_events.room_id
            and (
              room.owner_id = auth.uid()
              or room.created_by = auth.uid()
            )
        )
      );
  end if;
end;
$$;

grant select, insert, update, delete on public.room_events to authenticated;
