-- Phase 2C calendar-feed credential foundation.
--
-- The raw private calendar-feed token is never persisted. Only its SHA-256
-- digest plus a short non-secret hint are stored. Client roles have no direct
-- table privileges; the authenticated management API mediates lifecycle
-- changes and the future feed endpoint will validate a presented token through
-- the service role.

create table if not exists public.calendar_feed_credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token_hash text not null unique
    check (token_hash ~ '^[0-9a-f]{64}$'),
  token_hint text not null
    check (char_length(token_hint) = 8),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz
);

alter table public.calendar_feed_credentials enable row level security;
alter table public.calendar_feed_credentials force row level security;

revoke all on table public.calendar_feed_credentials from anon, authenticated;
grant select, insert, update, delete on table public.calendar_feed_credentials to service_role;

comment on table public.calendar_feed_credentials is
  'Hash-only credentials for member-owned private Loombus calendar subscription feeds. Raw feed tokens are never stored. Client roles have no direct table access.';
comment on column public.calendar_feed_credentials.token_hash is
  'Lowercase hexadecimal SHA-256 digest of the private calendar-feed token.';
comment on column public.calendar_feed_credentials.token_hint is
  'Last eight base64url characters of the token for member-facing identification; not sufficient for authentication.';
