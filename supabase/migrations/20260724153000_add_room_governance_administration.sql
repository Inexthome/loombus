begin;

create table if not exists public.room_ownership_transfers (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  from_user_id uuid not null references auth.users(id) on delete cascade,
  to_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'cancelled', 'expired')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists room_ownership_transfers_one_pending_idx
  on public.room_ownership_transfers (room_id)
  where status = 'pending';

create index if not exists room_ownership_transfers_recipient_idx
  on public.room_ownership_transfers (to_user_id, status, expires_at);

create table if not exists public.room_governance_settings (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  retention_days integer
    check (retention_days is null or retention_days between 30 and 3650),
  retain_audit_logs boolean not null default true,
  require_policy_acknowledgment boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.room_policies (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  body text not null check (char_length(btrim(body)) between 1 and 12000),
  version integer not null default 1 check (version > 0),
  status text not null default 'published'
    check (status in ('draft', 'published', 'retired')),
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, title, version)
);

create index if not exists room_policies_room_status_idx
  on public.room_policies (room_id, status, published_at desc);

create table if not exists public.room_policy_acknowledgments (
  policy_id uuid not null references public.room_policies(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  acknowledged_at timestamptz not null default now(),
  primary key (policy_id, user_id)
);

create index if not exists room_policy_acknowledgments_room_idx
  on public.room_policy_acknowledgments (room_id, acknowledged_at desc);

create table if not exists public.room_moderation_queue (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  target_type text not null
    check (target_type in ('room_post', 'room_post_reply', 'room_member', 'other')),
  target_id uuid,
  reason text not null check (char_length(btrim(reason)) between 1 and 1000),
  status text not null default 'open'
    check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  reported_by uuid references auth.users(id) on delete set null,
  assigned_to uuid references auth.users(id) on delete set null,
  resolution_note text,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists room_moderation_queue_room_status_idx
  on public.room_moderation_queue (room_id, status, created_at desc);

create or replace function public.accept_room_ownership_transfer(
  transfer_id uuid,
  accepting_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  transfer_row public.room_ownership_transfers%rowtype;
  current_owner uuid;
begin
  select *
  into transfer_row
  from public.room_ownership_transfers
  where id = transfer_id
  for update;

  if transfer_row.id is null then
    raise exception 'Ownership transfer not found.';
  end if;

  if transfer_row.status <> 'pending' then
    raise exception 'Ownership transfer is no longer pending.';
  end if;

  if transfer_row.expires_at <= now() then
    update public.room_ownership_transfers
    set status = 'expired', updated_at = now()
    where id = transfer_id;
    raise exception 'Ownership transfer has expired.';
  end if;

  if transfer_row.to_user_id <> accepting_user_id then
    raise exception 'Only the selected recipient can accept ownership.';
  end if;

  select owner_id
  into current_owner
  from public.rooms
  where id = transfer_row.room_id
  for update;

  if current_owner is distinct from transfer_row.from_user_id then
    raise exception 'Room ownership changed before this transfer was accepted.';
  end if;

  update public.rooms
  set owner_id = transfer_row.to_user_id,
      updated_at = now()
  where id = transfer_row.room_id;

  insert into public.room_members (
    room_id, user_id, role, status, joined_at, created_at, updated_at
  )
  values (
    transfer_row.room_id, transfer_row.to_user_id, 'owner', 'active', now(), now(), now()
  )
  on conflict (room_id, user_id)
  do update set
    role = 'owner',
    status = 'active',
    suspended_until = null,
    updated_at = now();

  insert into public.room_members (
    room_id, user_id, role, status, joined_at, created_at, updated_at
  )
  values (
    transfer_row.room_id, transfer_row.from_user_id, 'administrator', 'active', now(), now(), now()
  )
  on conflict (room_id, user_id)
  do update set
    role = 'administrator',
    status = 'active',
    suspended_until = null,
    updated_at = now();

  update public.room_ownership_transfers
  set status = 'accepted',
      accepted_at = now(),
      updated_at = now()
  where id = transfer_id;

  return transfer_row.room_id;
end;
$$;

alter table public.room_ownership_transfers enable row level security;
alter table public.room_governance_settings enable row level security;
alter table public.room_policies enable row level security;
alter table public.room_policy_acknowledgments enable row level security;
alter table public.room_moderation_queue enable row level security;

drop policy if exists room_ownership_transfers_select on public.room_ownership_transfers;
create policy room_ownership_transfers_select
on public.room_ownership_transfers
for select
using (
  auth.uid() = from_user_id
  or auth.uid() = to_user_id
  or public.room_user_is_staff(room_id, auth.uid())
);

drop policy if exists room_governance_settings_select on public.room_governance_settings;
create policy room_governance_settings_select
on public.room_governance_settings
for select
using (public.room_user_is_staff(room_id, auth.uid()));

drop policy if exists room_policies_select on public.room_policies;
create policy room_policies_select
on public.room_policies
for select
using (
  (status = 'published' and public.room_user_is_active_member(room_id, auth.uid()))
  or public.room_user_is_staff(room_id, auth.uid())
);

drop policy if exists room_policy_acknowledgments_select on public.room_policy_acknowledgments;
create policy room_policy_acknowledgments_select
on public.room_policy_acknowledgments
for select
using (
  auth.uid() = user_id
  or public.room_user_is_staff(room_id, auth.uid())
);

drop policy if exists room_policy_acknowledgments_insert on public.room_policy_acknowledgments;
create policy room_policy_acknowledgments_insert
on public.room_policy_acknowledgments
for insert
with check (
  auth.uid() = user_id
  and public.room_user_is_active_member(room_id, auth.uid())
);

drop policy if exists room_moderation_queue_select on public.room_moderation_queue;
create policy room_moderation_queue_select
on public.room_moderation_queue
for select
using (public.room_user_is_staff(room_id, auth.uid()));

commit;
