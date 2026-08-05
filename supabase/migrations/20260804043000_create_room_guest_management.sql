create table if not exists public.room_guest_settings (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  require_approval boolean not null default true,
  vehicle_required boolean not null default false,
  notes_required boolean not null default false,
  maximum_active_guests integer not null default 10,
  maximum_duration_hours integer not null default 168,
  allow_recurring_guests boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.room_guest_settings add column if not exists require_approval boolean not null default true;
alter table public.room_guest_settings add column if not exists vehicle_required boolean not null default false;
alter table public.room_guest_settings add column if not exists notes_required boolean not null default false;
alter table public.room_guest_settings add column if not exists maximum_active_guests integer not null default 10;
alter table public.room_guest_settings add column if not exists maximum_duration_hours integer not null default 168;
alter table public.room_guest_settings add column if not exists allow_recurring_guests boolean not null default false;
alter table public.room_guest_settings add column if not exists created_at timestamptz not null default now();
alter table public.room_guest_settings add column if not exists updated_at timestamptz not null default now();

create table if not exists public.room_guest_passes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  resident_id uuid not null references public.profiles(id) on delete cascade,
  guest_name text not null,
  visit_type text not null default 'guest',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  vehicle_make text,
  vehicle_model text,
  license_plate text,
  notes text,
  status text not null default 'pending',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.room_guest_passes add column if not exists resident_id uuid references public.profiles(id) on delete cascade;
alter table public.room_guest_passes add column if not exists guest_name text;
alter table public.room_guest_passes add column if not exists visit_type text not null default 'guest';
alter table public.room_guest_passes add column if not exists starts_at timestamptz;
alter table public.room_guest_passes add column if not exists ends_at timestamptz;
alter table public.room_guest_passes add column if not exists vehicle_make text;
alter table public.room_guest_passes add column if not exists vehicle_model text;
alter table public.room_guest_passes add column if not exists license_plate text;
alter table public.room_guest_passes add column if not exists notes text;
alter table public.room_guest_passes add column if not exists status text not null default 'pending';
alter table public.room_guest_passes add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;
alter table public.room_guest_passes add column if not exists reviewed_at timestamptz;
alter table public.room_guest_passes add column if not exists review_note text;
alter table public.room_guest_passes add column if not exists checked_in_at timestamptz;
alter table public.room_guest_passes add column if not exists checked_out_at timestamptz;
alter table public.room_guest_passes add column if not exists cancelled_at timestamptz;
alter table public.room_guest_passes add column if not exists created_at timestamptz not null default now();
alter table public.room_guest_passes add column if not exists updated_at timestamptz not null default now();

create index if not exists room_guest_passes_room_schedule_idx on public.room_guest_passes(room_id, starts_at, status);
create index if not exists room_guest_passes_resident_idx on public.room_guest_passes(resident_id, created_at desc);
create index if not exists room_guest_passes_plate_idx on public.room_guest_passes(room_id, license_plate);

alter table public.room_guest_settings enable row level security;
alter table public.room_guest_passes enable row level security;
revoke all on public.room_guest_settings, public.room_guest_passes from anon, authenticated;
grant all on public.room_guest_settings, public.room_guest_passes to service_role;

comment on table public.room_guest_passes is 'Private Room visitor registrations and guest-pass lifecycle.';