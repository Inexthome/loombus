-- Loombus native push device tokens
-- Date: 2026-06-11
--
-- Purpose:
-- Store native app push tokens for device-level notifications.
-- Token writes are handled through authenticated API routes using the service role.
-- Normal clients can read/delete only their own token rows.

create table if not exists public.user_push_device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null default 'ios',
  token_type text not null default 'apns',
  token text not null,
  device_id text,
  app_version text,
  enabled boolean not null default true,
  last_registered_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_push_device_tokens_platform_check
    check (platform in ('ios', 'android', 'web', 'unknown')),
  constraint user_push_device_tokens_token_type_check
    check (token_type in ('apns', 'fcm', 'webpush', 'unknown')),
  constraint user_push_device_tokens_token_length_check
    check (char_length(token) between 16 and 4096),
  constraint user_push_device_tokens_unique_token
    unique (token)
);

create index if not exists user_push_device_tokens_user_enabled_idx
on public.user_push_device_tokens(user_id, enabled, platform);

create index if not exists user_push_device_tokens_enabled_seen_idx
on public.user_push_device_tokens(enabled, last_seen_at desc);

alter table public.user_push_device_tokens enable row level security;

drop policy if exists "Users can read their own push device tokens"
on public.user_push_device_tokens;

create policy "Users can read their own push device tokens"
on public.user_push_device_tokens
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can delete their own push device tokens"
on public.user_push_device_tokens;

create policy "Users can delete their own push device tokens"
on public.user_push_device_tokens
for delete
to authenticated
using (auth.uid() = user_id);

revoke all on table public.user_push_device_tokens from anon;
revoke all on table public.user_push_device_tokens from authenticated;

grant select, delete on table public.user_push_device_tokens to authenticated;

comment on table public.user_push_device_tokens is
'Native mobile push notification device tokens registered by authenticated Loombus users.';

comment on column public.user_push_device_tokens.token is
'Native push token. On iOS this is the APNs token returned through Capacitor PushNotifications registration.';

-- Verification:
-- select column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'user_push_device_tokens'
-- order by ordinal_position;
--
-- select policyname, cmd
-- from pg_policies
-- where schemaname = 'public'
--   and tablename = 'user_push_device_tokens'
-- order by policyname;
