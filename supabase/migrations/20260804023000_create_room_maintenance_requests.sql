create table if not exists public.room_maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  assigned_to uuid references public.profiles(id) on delete set null,
  title text not null,
  description text not null,
  category text not null default 'general',
  priority text not null default 'normal',
  location_text text,
  status text not null default 'submitted',
  manager_note text,
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint room_maintenance_title_length check (char_length(title) between 3 and 160),
  constraint room_maintenance_description_length check (char_length(description) between 10 and 8000),
  constraint room_maintenance_category_check check (category in ('general','gate','lighting','landscaping','pool','road','water','building','parking','safety','other')),
  constraint room_maintenance_priority_check check (priority in ('low','normal','high','urgent')),
  constraint room_maintenance_status_check check (status in ('submitted','acknowledged','assigned','in_progress','waiting','resolved','closed','cancelled'))
);

create table if not exists public.room_maintenance_updates (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.room_maintenance_requests(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  update_type text not null default 'comment',
  body text not null,
  created_at timestamptz not null default now(),
  constraint room_maintenance_update_type_check check (update_type in ('comment','status','assignment','resolution')),
  constraint room_maintenance_update_body_length check (char_length(body) between 1 and 4000)
);

create index if not exists room_maintenance_requests_room_status_idx
  on public.room_maintenance_requests(room_id, status, updated_at desc);
create index if not exists room_maintenance_requests_requester_idx
  on public.room_maintenance_requests(requester_id, updated_at desc);
create index if not exists room_maintenance_requests_assigned_idx
  on public.room_maintenance_requests(assigned_to, status, updated_at desc)
  where assigned_to is not null;
create index if not exists room_maintenance_updates_request_idx
  on public.room_maintenance_updates(request_id, created_at asc);

alter table public.room_maintenance_requests enable row level security;
alter table public.room_maintenance_updates enable row level security;

revoke all on public.room_maintenance_requests from anon, authenticated;
revoke all on public.room_maintenance_updates from anon, authenticated;
grant all on public.room_maintenance_requests to service_role;
grant all on public.room_maintenance_updates to service_role;

comment on table public.room_maintenance_requests is 'Private Room-native maintenance and repair request ledger.';
comment on table public.room_maintenance_updates is 'Private timeline entries for Room maintenance requests.';