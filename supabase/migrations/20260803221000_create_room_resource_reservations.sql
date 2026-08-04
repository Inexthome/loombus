begin;

create table if not exists public.room_reservable_resources (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  name text not null,
  description text,
  location_text text,
  capacity integer,
  duration_minutes integer not null default 60,
  buffer_minutes integer not null default 0,
  minimum_notice_minutes integer not null default 60,
  maximum_advance_days integer not null default 90,
  approval_required boolean not null default true,
  rules text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint room_reservable_resources_name_check check (char_length(btrim(name)) between 2 and 160),
  constraint room_reservable_resources_capacity_check check (capacity is null or capacity between 1 and 100000),
  constraint room_reservable_resources_duration_check check (duration_minutes between 15 and 1440),
  constraint room_reservable_resources_buffer_check check (buffer_minutes between 0 and 1440),
  constraint room_reservable_resources_notice_check check (minimum_notice_minutes between 0 and 525600),
  constraint room_reservable_resources_advance_check check (maximum_advance_days between 1 and 730),
  constraint room_reservable_resources_status_check check (status in ('active', 'paused', 'archived')),
  unique (id, room_id)
);

create table if not exists public.room_resource_reservations (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  resource_id uuid not null,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  requested_start timestamptz not null,
  requested_end timestamptz not null,
  timezone text not null default 'UTC',
  attendee_count integer,
  note text,
  manager_note text,
  status text not null default 'pending',
  acted_by uuid references public.profiles(id) on delete set null,
  acted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint room_resource_reservations_resource_fk
    foreign key (resource_id, room_id)
    references public.room_reservable_resources(id, room_id)
    on delete restrict,
  constraint room_resource_reservations_time_check check (requested_end > requested_start),
  constraint room_resource_reservations_attendees_check check (attendee_count is null or attendee_count between 1 and 100000),
  constraint room_resource_reservations_status_check
    check (status in ('pending', 'accepted', 'declined', 'reschedule_proposed', 'cancelled', 'completed'))
);

create index if not exists room_reservable_resources_room_status_idx
  on public.room_reservable_resources (room_id, status, name);
create index if not exists room_resource_reservations_resource_time_idx
  on public.room_resource_reservations (resource_id, status, requested_start);
create index if not exists room_resource_reservations_requester_time_idx
  on public.room_resource_reservations (requester_id, requested_start desc);
create index if not exists room_resource_reservations_room_status_idx
  on public.room_resource_reservations (room_id, status, updated_at desc);

create or replace function public.touch_room_resource_reservation_updated_at()
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

drop trigger if exists touch_room_reservable_resources_updated_at on public.room_reservable_resources;
create trigger touch_room_reservable_resources_updated_at
before update on public.room_reservable_resources
for each row execute function public.touch_room_resource_reservation_updated_at();

drop trigger if exists touch_room_resource_reservations_updated_at on public.room_resource_reservations;
create trigger touch_room_resource_reservations_updated_at
before update on public.room_resource_reservations
for each row execute function public.touch_room_resource_reservation_updated_at();

create or replace function public.prevent_room_resource_double_booking()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.status = 'accepted' and exists (
    select 1
    from public.room_resource_reservations existing
    where existing.resource_id = new.resource_id
      and existing.status = 'accepted'
      and existing.id <> new.id
      and existing.requested_start < new.requested_end
      and existing.requested_end > new.requested_start
  ) then
    raise exception 'room_resource_time_conflict' using errcode = '23P01';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_room_resource_double_booking on public.room_resource_reservations;
create trigger prevent_room_resource_double_booking
before insert or update of status, requested_start, requested_end
on public.room_resource_reservations
for each row execute function public.prevent_room_resource_double_booking();

alter table public.room_reservable_resources enable row level security;
alter table public.room_resource_reservations enable row level security;
revoke all on table public.room_reservable_resources from public, anon, authenticated;
revoke all on table public.room_resource_reservations from public, anon, authenticated;
grant all on table public.room_reservable_resources to service_role;
grant all on table public.room_resource_reservations to service_role;
revoke all on function public.touch_room_resource_reservation_updated_at() from public, anon, authenticated;
revoke all on function public.prevent_room_resource_double_booking() from public, anon, authenticated;
grant execute on function public.touch_room_resource_reservation_updated_at() to service_role;
grant execute on function public.prevent_room_resource_double_booking() to service_role;

comment on table public.room_reservable_resources is 'Private Room facilities and time-based resources configured by Room management.';
comment on table public.room_resource_reservations is 'Private member reservation lifecycle for a Room resource.';

commit;
