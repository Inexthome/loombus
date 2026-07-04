create table if not exists public.room_applications (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  applicant_id uuid not null,
  state text not null default 'pending',
  note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, applicant_id)
);

alter table public.room_applications enable row level security;

create policy "Room applications read"
on public.room_applications
for select
to authenticated
using (
  applicant_id = auth.uid()
  or public.is_room_owner(room_id)
);

create policy "Room applications create"
on public.room_applications
for insert
to authenticated
with check (
  applicant_id = auth.uid()
  and state = 'pending'
);

create policy "Room applications update"
on public.room_applications
for update
to authenticated
using (public.is_room_owner(room_id))
with check (public.is_room_owner(room_id));

notify pgrst, 'reload schema';
