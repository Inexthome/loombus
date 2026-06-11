-- Loombus native push notification preferences
-- Date: 2026-06-11
--
-- Purpose:
-- Add per-user native push controls while preserving existing in-app notification preferences.
-- Defaults are enabled for currently supported push categories so existing push behavior continues
-- until a user turns a category off.

alter table public.notification_preferences
  add column if not exists push_messages_enabled boolean not null default true;

alter table public.notification_preferences
  add column if not exists push_replies_enabled boolean not null default true;

alter table public.notification_preferences
  add column if not exists push_follows_enabled boolean not null default true;

alter table public.notification_preferences
  add column if not exists push_admin_reports_enabled boolean not null default true;

update public.notification_preferences
set
  push_messages_enabled = coalesce(push_messages_enabled, true),
  push_replies_enabled = coalesce(push_replies_enabled, true),
  push_follows_enabled = coalesce(push_follows_enabled, true),
  push_admin_reports_enabled = coalesce(push_admin_reports_enabled, true);

create index if not exists notification_preferences_push_enabled_idx
on public.notification_preferences(
  user_id,
  push_messages_enabled,
  push_replies_enabled,
  push_follows_enabled,
  push_admin_reports_enabled
);

comment on column public.notification_preferences.push_messages_enabled is
'Whether this member wants native push notifications for private messages.';

comment on column public.notification_preferences.push_replies_enabled is
'Whether this member wants native push notifications for replies to their discussions.';

comment on column public.notification_preferences.push_follows_enabled is
'Whether this member wants native push notifications for new followers.';

comment on column public.notification_preferences.push_admin_reports_enabled is
'Whether this admin wants native push notifications for newly filed reports.';

-- Verification:
-- select column_name, data_type, is_nullable, column_default
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'notification_preferences'
--   and column_name like 'push_%'
-- order by ordinal_position;
