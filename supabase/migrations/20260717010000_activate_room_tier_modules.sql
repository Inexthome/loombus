-- Private, server-controlled storage for cumulative Room subscription modules.
-- Apply after the Live Rooms core and Room resources migrations.

begin;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.room_module_records (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  module_key text not null,
  title text not null,
  body text not null default '',
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint room_module_records_module_key_check check (
    module_key in (
      'resource',
      'task',
      'poll',
      'directory',
      'knowledge',
      'form',
      'service',
      'workflow'
    )
  ),
  constraint room_module_records_title_length_check check (
    char_length(title) between 1 and 200
  ),
  constraint room_module_records_body_length_check check (
    char_length(body) <= 12000
  )
);

create index if not exists room_module_records_room_module_created_idx
  on public.room_module_records (room_id, module_key, created_at desc)
  where archived_at is null;
create index if not exists room_module_records_room_status_idx
  on public.room_module_records (room_id, module_key, status)
  where archived_at is null;
create index if not exists room_module_records_creator_idx
  on public.room_module_records (created_by, created_at desc);

create table if not exists public.room_module_responses (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  record_id uuid not null references public.room_module_records(id) on delete cascade,
  response_type text not null,
  responder_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint room_module_responses_type_length_check check (
    char_length(response_type) between 1 and 40
  )
);

create unique index if not exists room_module_responses_record_responder_type_unique_idx
  on public.room_module_responses (record_id, responder_id, response_type);
create index if not exists room_module_responses_room_record_idx
  on public.room_module_responses (room_id, record_id, created_at desc);

create table if not exists public.room_module_settings (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  settings jsonb not null default jsonb_build_object(
    'allowMemberPosts', true,
    'memberDirectoryVisible', true,
    'inviteRequiresApproval', false,
    'allowedEmailDomains', '[]'::jsonb,
    'defaultInviteRole', 'member'
  ),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.room_invites (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  token_hash text not null unique,
  label text not null default 'Room invitation',
  role text not null default 'member',
  max_uses integer,
  use_count integer not null default 0,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint room_invites_role_check check (
    role in ('member', 'moderator')
  ),
  constraint room_invites_max_uses_check check (
    max_uses is null or max_uses between 1 and 10000
  ),
  constraint room_invites_use_count_check check (use_count >= 0),
  constraint room_invites_label_length_check check (
    char_length(label) between 1 and 120
  )
);

-- A legacy room_invites table may already exist. CREATE TABLE IF NOT EXISTS does
-- not add newer columns, so reconcile it before any partial index references them.
alter table public.room_invites
  add column if not exists token_hash text,
  add column if not exists label text,
  add column if not exists role text,
  add column if not exists max_uses integer,
  add column if not exists use_count integer,
  add column if not exists expires_at timestamptz,
  add column if not exists revoked_at timestamptz,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

update public.room_invites
set
  token_hash = coalesce(
    nullif(token_hash, ''),
    encode(
      extensions.digest(
        concat_ws(':', id::text, room_id::text, gen_random_uuid()::text),
        'sha256'
      ),
      'hex'
    )
  ),
  label = coalesce(nullif(trim(label), ''), 'Room invitation'),
  role = case when role in ('member', 'moderator') then role else 'member' end,
  max_uses = case when max_uses between 1 and 10000 then max_uses else null end,
  use_count = greatest(coalesce(use_count, 0), 0),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, created_at, now());

alter table public.room_invites
  alter column token_hash set not null,
  alter column label set default 'Room invitation',
  alter column label set not null,
  alter column role set default 'member',
  alter column role set not null,
  alter column use_count set default 0,
  alter column use_count set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

create unique index if not exists room_invites_token_hash_unique_idx
  on public.room_invites (token_hash);
create index if not exists room_invites_room_active_idx
  on public.room_invites (room_id, created_at desc)
  where revoked_at is null;
create index if not exists room_invites_expiration_idx
  on public.room_invites (expires_at)
  where revoked_at is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.room_invites'::regclass
      and conname = 'room_invites_role_check'
  ) then
    alter table public.room_invites
      add constraint room_invites_role_check
      check (role in ('member', 'moderator'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.room_invites'::regclass
      and conname = 'room_invites_max_uses_check'
  ) then
    alter table public.room_invites
      add constraint room_invites_max_uses_check
      check (max_uses is null or max_uses between 1 and 10000);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.room_invites'::regclass
      and conname = 'room_invites_use_count_check'
  ) then
    alter table public.room_invites
      add constraint room_invites_use_count_check
      check (use_count >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.room_invites'::regclass
      and conname = 'room_invites_label_length_check'
  ) then
    alter table public.room_invites
      add constraint room_invites_label_length_check
      check (char_length(label) between 1 and 120);
  end if;
end;
$$;

create or replace function public.touch_room_tier_module_updated_at()
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

drop trigger if exists touch_room_module_records_updated_at on public.room_module_records;
create trigger touch_room_module_records_updated_at
before update on public.room_module_records
for each row execute function public.touch_room_tier_module_updated_at();

drop trigger if exists touch_room_module_responses_updated_at on public.room_module_responses;
create trigger touch_room_module_responses_updated_at
before update on public.room_module_responses
for each row execute function public.touch_room_tier_module_updated_at();

drop trigger if exists touch_room_module_settings_updated_at on public.room_module_settings;
create trigger touch_room_module_settings_updated_at
before update on public.room_module_settings
for each row execute function public.touch_room_tier_module_updated_at();

drop trigger if exists touch_room_invites_updated_at on public.room_invites;
create trigger touch_room_invites_updated_at
before update on public.room_invites
for each row execute function public.touch_room_tier_module_updated_at();

alter table public.room_module_records enable row level security;
alter table public.room_module_responses enable row level security;
alter table public.room_module_settings enable row level security;
alter table public.room_invites enable row level security;

drop policy if exists "Room module records are visible to active members"
  on public.room_module_records;
create policy "Room module records are visible to active members"
on public.room_module_records for select to authenticated
using (
  archived_at is null
  and public.user_is_active_room_member(room_id)
);

drop policy if exists "Room module settings are visible to managers"
  on public.room_module_settings;
create policy "Room module settings are visible to managers"
on public.room_module_settings for select to authenticated
using (public.user_can_manage_live_room(room_id));

drop policy if exists "Room invites are visible to managers"
  on public.room_invites;
create policy "Room invites are visible to managers"
on public.room_invites for select to authenticated
using (public.user_can_manage_live_room(room_id));

revoke all on table public.room_module_records from anon;
revoke all on table public.room_module_responses from anon;
revoke all on table public.room_module_settings from anon;
revoke all on table public.room_invites from anon;

revoke insert, update, delete on table public.room_module_records from authenticated;
revoke all on table public.room_module_responses from authenticated;
revoke insert, update, delete on table public.room_module_settings from authenticated;
revoke insert, update, delete on table public.room_invites from authenticated;

grant select on table public.room_module_records to authenticated;
grant select on table public.room_module_settings to authenticated;
grant select on table public.room_invites to authenticated;

notify pgrst, 'reload schema';

commit;
