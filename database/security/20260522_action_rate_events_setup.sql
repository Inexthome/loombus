-- Loombus Action Rate Events
-- Date: 2026-05-22
--
-- Purpose:
-- Durable abuse-control table for user-triggered actions such as:
-- - follow toggle
-- - block toggle
-- - future report creation limits
--
-- This table stores lightweight action events. It is not user-facing.

create table if not exists public.action_rate_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action_key text not null,
  target_id uuid,
  created_at timestamptz not null default now(),

  constraint action_rate_events_action_key_check
    check (
      action_key in (
        'follow_toggle',
        'block_toggle',
        'report_create'
      )
    )
);

create index if not exists action_rate_events_user_action_created_idx
on public.action_rate_events (user_id, action_key, created_at desc);

create index if not exists action_rate_events_target_idx
on public.action_rate_events (target_id);

alter table public.action_rate_events enable row level security;

drop policy if exists "Users can read their own action rate events"
on public.action_rate_events;

create policy "Users can read their own action rate events"
on public.action_rate_events
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can create their own action rate events"
on public.action_rate_events;

create policy "Users can create their own action rate events"
on public.action_rate_events
for insert
to authenticated
with check (auth.uid() = user_id);

-- No update/delete policy is intentionally provided for normal users.

-- Verification
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'action_rate_events';

select
  policyname,
  roles,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
from pg_policies
where schemaname = 'public'
  and tablename = 'action_rate_events'
order by policyname;
