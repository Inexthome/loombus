create table if not exists public.room_announcements (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 160),
  body text not null check (char_length(trim(body)) between 1 and 12000),
  priority text not null default 'normal' check (priority in ('normal', 'important', 'urgent')),
  is_pinned boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists room_announcements_room_id_created_at_idx on public.room_announcements (room_id, created_at desc);
create index if not exists room_announcements_room_id_pinned_idx on public.room_announcements (room_id, is_pinned desc, created_at desc);
create index if not exists room_announcements_created_by_idx on public.room_announcements (created_by);

alter table public.room_announcements enable row level security;

drop policy if exists "Room members can view room announcements" on public.room_announcements;
create policy "Room members can view room announcements"
  on public.room_announcements
  for select
  using (
    exists (
      select 1
      from public.room_members member
      where member.room_id = room_announcements.room_id
        and member.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.rooms room
      where room.id = room_announcements.room_id
        and (room.owner_id = auth.uid() or room.created_by = auth.uid())
    )
  );

drop policy if exists "Room owners and admins can create room announcements" on public.room_announcements;
create policy "Room owners and admins can create room announcements"
  on public.room_announcements
  for insert
  with check (
    created_by = auth.uid()
    and (
      exists (
        select 1
        from public.room_members member
        where member.room_id = room_announcements.room_id
          and member.user_id = auth.uid()
          and member.role in ('owner', 'admin')
      )
      or exists (
        select 1
        from public.rooms room
        where room.id = room_announcements.room_id
          and (room.owner_id = auth.uid() or room.created_by = auth.uid())
      )
    )
  );

drop policy if exists "Room owners and admins can update room announcements" on public.room_announcements;
create policy "Room owners and admins can update room announcements"
  on public.room_announcements
  for update
  using (
    exists (
      select 1
      from public.room_members member
      where member.room_id = room_announcements.room_id
        and member.user_id = auth.uid()
        and member.role in ('owner', 'admin')
    )
    or exists (
      select 1
      from public.rooms room
      where room.id = room_announcements.room_id
        and (room.owner_id = auth.uid() or room.created_by = auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.room_members member
      where member.room_id = room_announcements.room_id
        and member.user_id = auth.uid()
        and member.role in ('owner', 'admin')
    )
    or exists (
      select 1
      from public.rooms room
      where room.id = room_announcements.room_id
        and (room.owner_id = auth.uid() or room.created_by = auth.uid())
    )
  );

drop policy if exists "Room owners and admins can delete room announcements" on public.room_announcements;
create policy "Room owners and admins can delete room announcements"
  on public.room_announcements
  for delete
  using (
    exists (
      select 1
      from public.room_members member
      where member.room_id = room_announcements.room_id
        and member.user_id = auth.uid()
        and member.role in ('owner', 'admin')
    )
    or exists (
      select 1
      from public.rooms room
      where room.id = room_announcements.room_id
        and (room.owner_id = auth.uid() or room.created_by = auth.uid())
    )
  );
