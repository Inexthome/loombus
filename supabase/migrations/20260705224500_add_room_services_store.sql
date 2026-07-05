create table if not exists public.room_service_listings (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 160),
  description text not null default '' check (char_length(description) <= 8000),
  listing_type text not null default 'service' check (listing_type in ('service', 'product', 'offer', 'appointment', 'internal_request')),
  price_label text not null default '' check (char_length(price_label) <= 120),
  availability_label text not null default '' check (char_length(availability_label) <= 160),
  provider_name text not null default '' check (char_length(provider_name) <= 160),
  contact_label text not null default '' check (char_length(contact_label) <= 200),
  status text not null default 'active' check (status in ('draft', 'active', 'paused', 'archived')),
  is_featured boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.room_service_requests (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  listing_id uuid references public.room_service_listings(id) on delete set null,
  title text not null check (char_length(trim(title)) between 1 and 160),
  details text not null default '' check (char_length(details) <= 12000),
  requested_for text not null default '' check (char_length(requested_for) <= 160),
  requester_contact text not null default '' check (char_length(requester_contact) <= 200),
  status text not null default 'new' check (status in ('new', 'accepted', 'in_progress', 'completed', 'cancelled')),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists room_service_listings_room_status_created_idx on public.room_service_listings (room_id, status, created_at desc);
create index if not exists room_service_listings_room_featured_created_idx on public.room_service_listings (room_id, is_featured desc, created_at desc);
create index if not exists room_service_requests_room_status_created_idx on public.room_service_requests (room_id, status, created_at desc);
create index if not exists room_service_requests_listing_idx on public.room_service_requests (listing_id);
create index if not exists room_service_requests_created_by_idx on public.room_service_requests (created_by);

alter table public.room_service_listings enable row level security;
alter table public.room_service_requests enable row level security;

create or replace function public.user_can_access_room_services(target_room_id uuid)
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

create or replace function public.user_can_manage_room_services(target_room_id uuid)
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

drop policy if exists "Room members can view service listings" on public.room_service_listings;
create policy "Room members can view service listings"
  on public.room_service_listings
  for select
  using (public.user_can_access_room_services(room_id));

drop policy if exists "Room owners and admins can create service listings" on public.room_service_listings;
create policy "Room owners and admins can create service listings"
  on public.room_service_listings
  for insert
  with check (
    created_by = auth.uid()
    and public.user_can_manage_room_services(room_id)
  );

drop policy if exists "Room owners and admins can update service listings" on public.room_service_listings;
create policy "Room owners and admins can update service listings"
  on public.room_service_listings
  for update
  using (public.user_can_manage_room_services(room_id))
  with check (public.user_can_manage_room_services(room_id));

drop policy if exists "Room members can view service requests" on public.room_service_requests;
create policy "Room members can view service requests"
  on public.room_service_requests
  for select
  using (
    public.user_can_manage_room_services(room_id)
    or created_by = auth.uid()
  );

drop policy if exists "Room members can create service requests" on public.room_service_requests;
create policy "Room members can create service requests"
  on public.room_service_requests
  for insert
  with check (
    created_by = auth.uid()
    and public.user_can_access_room_services(room_id)
  );

drop policy if exists "Room owners and admins can update service requests" on public.room_service_requests;
create policy "Room owners and admins can update service requests"
  on public.room_service_requests
  for update
  using (public.user_can_manage_room_services(room_id))
  with check (public.user_can_manage_room_services(room_id));
