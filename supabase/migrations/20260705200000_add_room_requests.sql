create table if not exists public.room_requests (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 160),
  body text not null check (char_length(trim(body)) between 1 and 12000),
  category text not null default 'general' check (category in ('general', 'maintenance', 'help', 'service', 'other')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists room_requests_room_id_status_created_at_idx on public.room_requests (room_id, status, created_at desc);
create index if not exists room_requests_created_by_idx on public.room_requests (created_by);

alter table public.room_requests enable row level security;

drop policy if exists "Room members can view room requests" on public.room_requests;
create policy "Room members can view room requests"
  on public.room_requests
  for select
  using (
    exists (
      select 1
      from public.room_members member
      where member.room_id = room_requests.room_id
        and member.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.rooms room
      where room.id = room_requests.room_id
        and (room.owner_id = auth.uid() or room.created_by = auth.uid())
    )
  );

drop policy if exists "Room members can create room requests" on public.room_requests;
create policy "Room members can create room requests"
  on public.room_requests
  for insert
  with check (
    created_by = auth.uid()
    and (
      exists (
        select 1
        from public.room_members member
        where member.room_id = room_requests.room_id
          and member.user_id = auth.uid()
      )
      or exists (
        select 1
        from public.rooms room
        where room.id = room_requests.room_id
          and (room.owner_id = auth.uid() or room.created_by = auth.uid())
      )
    )
  );

drop policy if exists "Room owners and admins can update room requests" on public.room_requests;
create policy "Room owners and admins can update room requests"
  on public.room_requests
  for update
  using (
    exists (
      select 1
      from public.room_members member
      where member.room_id = room_requests.room_id
        and member.user_id = auth.uid()
        and member.role in ('owner', 'admin')
    )
    or exists (
      select 1
      from public.rooms room
      where room.id = room_requests.room_id
        and (room.owner_id = auth.uid() or room.created_by = auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.room_members member
      where member.room_id = room_requests.room_id
        and member.user_id = auth.uid()
        and member.role in ('owner', 'admin')
    )
    or exists (
      select 1
      from public.rooms room
      where room.id = room_requests.room_id
        and (room.owner_id = auth.uid() or room.created_by = auth.uid())
    )
  );
