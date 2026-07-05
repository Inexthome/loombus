create table if not exists public.room_resources (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 160),
  description text not null default '' check (char_length(description) <= 4000),
  resource_type text not null default 'link' check (resource_type in ('link', 'document', 'note', 'rule', 'form', 'other')),
  url text,
  body text not null default '' check (char_length(body) <= 12000),
  is_pinned boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (url is null or char_length(trim(url)) <= 2000)
);

create index if not exists room_resources_room_id_pinned_created_at_idx on public.room_resources (room_id, is_pinned desc, created_at desc);
create index if not exists room_resources_room_id_type_created_at_idx on public.room_resources (room_id, resource_type, created_at desc);
create index if not exists room_resources_created_by_idx on public.room_resources (created_by);

alter table public.room_resources enable row level security;

create or replace function public.user_can_access_room_resources(target_room_id uuid)
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

create or replace function public.user_can_manage_room_resources(target_room_id uuid)
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

drop policy if exists "Room members can view room resources" on public.room_resources;
create policy "Room members can view room resources"
  on public.room_resources
  for select
  using (public.user_can_access_room_resources(room_id));

drop policy if exists "Room owners and admins can create room resources" on public.room_resources;
create policy "Room owners and admins can create room resources"
  on public.room_resources
  for insert
  with check (
    created_by = auth.uid()
    and public.user_can_manage_room_resources(room_id)
  );

drop policy if exists "Room owners and admins can update room resources" on public.room_resources;
create policy "Room owners and admins can update room resources"
  on public.room_resources
  for update
  using (public.user_can_manage_room_resources(room_id))
  with check (public.user_can_manage_room_resources(room_id));
