-- Reconcile legacy Room invitation schemas before cumulative Room modules.
-- This migration intentionally sorts before 20260717010000_activate_room_tier_modules.sql.

begin;

create extension if not exists pgcrypto with schema extensions;

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
  updated_at timestamptz not null default now()
);

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
  max_uses = case
    when max_uses between 1 and 10000 then max_uses
    else null
  end,
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
    select 1
    from pg_constraint
    where conrelid = 'public.room_invites'::regclass
      and conname = 'room_invites_role_check'
  ) then
    alter table public.room_invites
      add constraint room_invites_role_check
      check (role in ('member', 'moderator'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.room_invites'::regclass
      and conname = 'room_invites_max_uses_check'
  ) then
    alter table public.room_invites
      add constraint room_invites_max_uses_check
      check (max_uses is null or max_uses between 1 and 10000);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.room_invites'::regclass
      and conname = 'room_invites_use_count_check'
  ) then
    alter table public.room_invites
      add constraint room_invites_use_count_check
      check (use_count >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.room_invites'::regclass
      and conname = 'room_invites_label_length_check'
  ) then
    alter table public.room_invites
      add constraint room_invites_label_length_check
      check (char_length(label) between 1 and 120);
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
