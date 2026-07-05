create table if not exists public.room_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 160),
  description text,
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint room_events_ends_after_start check (ends_at is null or ends_at >= starts_at)
);

create index if not exists room_events_room_id_starts_at_idx on public.room_events (room_id, starts_at);
create index if not exists room_events_created_by_idx on public.room_events (created_by);

alter table public.room_events enable row level security;

drop policy if exists "Room members can view room events" on public.room_events;
create policy "Room members can view room events"
  on public.room_events
  for select
  using (
    exists (
      select 1
      from public.room_members member
      where member.room_id = room_events.room_id
        and member.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.rooms room
      where room.id = room_events.room_id
        and (room.owner_id = auth.uid() or room.created_by = auth.uid())
    )
  );

drop policy if exists "Room owners and admins can create room events" on public.room_events;
create policy "Room owners and admins can create room events"
  on public.room_events
  for insert
  with check (
    created_by = auth.uid()
    and (
      exists (
        select 1
        from public.room_members member
        where member.room_id = room_events.room_id
          and member.user_id = auth.uid()
          and member.role in ('owner', 'admin')
      )
      or exists (
        select 1
        from public.rooms room
        where room.id = room_events.room_id
          and (room.owner_id = auth.uid() or room.created_by = auth.uid())
      )
    )
  );

drop policy if exists "Room owners and admins can update room events" on public.room_events;
create policy "Room owners and admins can update room events"
  on public.room_events
  for update
  using (
    exists (
      select 1
      from public.room_members member
      where member.room_id = room_events.room_id
        and member.user_id = auth.uid()
        and member.role in ('owner', 'admin')
    )
    or exists (
      select 1
      from public.rooms room
      where room.id = room_events.room_id
        and (room.owner_id = auth.uid() or room.created_by = auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.room_members member
      where member.room_id = room_events.room_id
        and member.user_id = auth.uid()
        and member.role in ('owner', 'admin')
    )
    or exists (
      select 1
      from public.rooms room
      where room.id = room_events.room_id
        and (room.owner_id = auth.uid() or room.created_by = auth.uid())
    )
  );

drop policy if exists "Room owners and admins can delete room events" on public.room_events;
create policy "Room owners and admins can delete room events"
  on public.room_events
  for delete
  using (
    exists (
      select 1
      from public.room_members member
      where member.room_id = room_events.room_id
        and member.user_id = auth.uid()
        and member.role in ('owner', 'admin')
    )
    or exists (
      select 1
      from public.rooms room
      where room.id = room_events.room_id
        and (room.owner_id = auth.uid() or room.created_by = auth.uid())
    )
  );
