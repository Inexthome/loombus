begin;

create table if not exists public.room_retention_holds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  target_type text not null check (target_type in ('room', 'room_post', 'room_post_reply', 'room_module_record', 'room_event', 'room_announcement', 'room_attachment')),
  target_id uuid,
  reason text not null check (char_length(btrim(reason)) between 1 and 1000),
  status text not null default 'active' check (status in ('active', 'released')),
  created_by uuid references auth.users(id) on delete set null,
  released_by uuid references auth.users(id) on delete set null,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists room_retention_holds_active_target_idx
  on public.room_retention_holds (
    room_id,
    target_type,
    coalesce(target_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where status = 'active';

create index if not exists room_retention_holds_room_status_idx
  on public.room_retention_holds (room_id, status, created_at desc);

create table if not exists public.room_retention_runs (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  mode text not null check (mode in ('preview', 'stage')),
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  cutoff_at timestamptz not null,
  retention_days integer not null check (retention_days between 30 and 3650),
  candidate_count integer not null default 0 check (candidate_count >= 0),
  staged_count integer not null default 0 check (staged_count >= 0),
  excluded_count integer not null default 0 check (excluded_count >= 0),
  summary jsonb not null default '{}'::jsonb,
  error_message text,
  started_by uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists room_retention_runs_room_created_idx
  on public.room_retention_runs (room_id, created_at desc);

create table if not exists public.room_retention_candidates (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.room_retention_runs(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  target_type text not null check (target_type in ('room_post', 'room_post_reply', 'room_module_record', 'room_event', 'room_announcement', 'room_attachment')),
  target_id uuid not null,
  record_created_at timestamptz,
  stage_status text not null default 'eligible' check (stage_status in ('eligible', 'staged', 'excluded', 'cancelled')),
  exclusion_reason text,
  metadata jsonb not null default '{}'::jsonb,
  staged_at timestamptz,
  created_at timestamptz not null default now(),
  unique (run_id, target_type, target_id)
);

create index if not exists room_retention_candidates_room_status_idx
  on public.room_retention_candidates (room_id, stage_status, created_at desc);

alter table public.room_retention_holds enable row level security;
alter table public.room_retention_runs enable row level security;
alter table public.room_retention_candidates enable row level security;

drop policy if exists room_retention_holds_select on public.room_retention_holds;
create policy room_retention_holds_select
on public.room_retention_holds
for select
using (public.room_user_is_staff(room_id, auth.uid()));

drop policy if exists room_retention_runs_select on public.room_retention_runs;
create policy room_retention_runs_select
on public.room_retention_runs
for select
using (public.room_user_is_staff(room_id, auth.uid()));

drop policy if exists room_retention_candidates_select on public.room_retention_candidates;
create policy room_retention_candidates_select
on public.room_retention_candidates
for select
using (public.room_user_is_staff(room_id, auth.uid()));

commit;