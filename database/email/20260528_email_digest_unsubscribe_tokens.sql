-- Loombus email digest unsubscribe tokens
-- Adds a durable one-click unsubscribe token to notification_preferences.
--
-- Supabase Data API policy:
-- This migration does not grant public read access.
-- Normal clients continue to manage digest preferences through existing
-- authenticated profile settings. The public unsubscribe route uses the token
-- server-side to disable only email_digest_enabled.

alter table public.notification_preferences
  add column if not exists email_digest_unsubscribe_token uuid not null default gen_random_uuid();

create unique index if not exists notification_preferences_email_digest_unsubscribe_token_idx
on public.notification_preferences(email_digest_unsubscribe_token);

comment on column public.notification_preferences.email_digest_unsubscribe_token is
'Durable token used by the public one-click email digest unsubscribe route.';

-- Backfill safeguard for legacy rows if any somehow bypassed the default.
update public.notification_preferences
set email_digest_unsubscribe_token = gen_random_uuid()
where email_digest_unsubscribe_token is null;

-- Explicitly preserve existing intended table privileges.
revoke all on table public.notification_preferences from anon;

-- Authenticated users keep existing RLS-backed preference management.
grant select, insert, update on table public.notification_preferences to authenticated;

-- Verification helper:
-- select exists (
--   select 1
--   from information_schema.columns
--   where table_schema = 'public'
--     and table_name = 'notification_preferences'
--     and column_name = 'email_digest_unsubscribe_token'
-- ) as token_column_exists,
-- (
--   select count(*)
--   from pg_indexes
--   where schemaname = 'public'
--     and tablename = 'notification_preferences'
--     and indexname = 'notification_preferences_email_digest_unsubscribe_token_idx'
-- ) as token_index_count,
-- (
--   select count(*)
--   from information_schema.role_table_grants
--   where table_schema = 'public'
--     and table_name = 'notification_preferences'
--     and grantee = 'anon'
-- ) as anon_grant_count,
-- (
--   select count(*)
--   from information_schema.role_table_grants
--   where table_schema = 'public'
--     and table_name = 'notification_preferences'
--     and grantee = 'authenticated'
-- ) as authenticated_grant_count;
