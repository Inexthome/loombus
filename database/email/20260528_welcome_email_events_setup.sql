-- Loombus welcome email events
-- Tracks one-time welcome email delivery per user so product email
-- can be sent safely without duplicate sends.
--
-- Supabase Data API policy:
-- Anonymous users receive no table privileges.
-- Authenticated users may read only their own welcome email delivery row.
-- Writes are service-role/API controlled.

create table if not exists public.welcome_email_events (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  email text not null,
  status text not null default 'sent',
  provider text not null default 'resend',
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint welcome_email_events_email_length
    check (char_length(trim(email)) between 3 and 320),
  constraint welcome_email_events_status_check
    check (status in ('sent', 'skipped', 'failed')),
  constraint welcome_email_events_provider_check
    check (provider in ('resend', 'system'))
);

create index if not exists welcome_email_events_status_created_idx
on public.welcome_email_events(status, created_at desc);

create index if not exists welcome_email_events_sent_at_idx
on public.welcome_email_events(sent_at desc);

create or replace function public.set_welcome_email_events_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_welcome_email_events_updated_at_trigger
on public.welcome_email_events;

create trigger set_welcome_email_events_updated_at_trigger
before update on public.welcome_email_events
for each row
execute function public.set_welcome_email_events_updated_at();

alter table public.welcome_email_events enable row level security;

drop policy if exists "Users can read their own welcome email event"
on public.welcome_email_events;

create policy "Users can read their own welcome email event"
on public.welcome_email_events
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Admins can read welcome email events"
on public.welcome_email_events;

create policy "Admins can read welcome email events"
on public.welcome_email_events
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
);

-- Explicit Supabase Data API grants/revokes.
revoke all on table public.welcome_email_events from anon;
revoke all on table public.welcome_email_events from authenticated;

grant select on table public.welcome_email_events to authenticated;

comment on table public.welcome_email_events is
'One-time welcome email delivery tracking for Loombus product email.';

comment on column public.welcome_email_events.status is
'Welcome email delivery status: sent, skipped, or failed.';

comment on column public.welcome_email_events.provider_message_id is
'Email provider message id, when available.';

-- Verification helper:
-- select exists (
--   select 1
--   from information_schema.tables
--   where table_schema = 'public'
--     and table_name = 'welcome_email_events'
-- ) as table_exists,
-- (
--   select count(*)
--   from information_schema.columns
--   where table_schema = 'public'
--     and table_name = 'welcome_email_events'
-- ) as column_count,
-- (
--   select count(*)
--   from information_schema.role_table_grants
--   where table_schema = 'public'
--     and table_name = 'welcome_email_events'
--     and grantee = 'anon'
-- ) as anon_grant_count,
-- (
--   select count(*)
--   from information_schema.role_table_grants
--   where table_schema = 'public'
--     and table_name = 'welcome_email_events'
--     and grantee = 'authenticated'
-- ) as authenticated_grant_count,
-- (
--   select count(*)
--   from pg_policies
--   where schemaname = 'public'
--     and tablename = 'welcome_email_events'
-- ) as policy_count,
-- (
--   select count(*)
--   from pg_indexes
--   where schemaname = 'public'
--     and tablename = 'welcome_email_events'
-- ) as expected_index_count;
