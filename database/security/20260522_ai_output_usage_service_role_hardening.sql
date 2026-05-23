-- Loombus AI Output / Summary / Usage Service-Role Hardening
-- Apply only after the code uses service-role helpers for AI usage logs,
-- discussion AI output cache writes, and discussion summary writes.

alter table public.ai_usage_events enable row level security;
alter table public.discussion_ai_outputs enable row level security;
alter table public.discussion_summaries enable row level security;

-- AI usage events: users/admins can read, normal clients cannot write.
drop policy if exists "Users can insert their own AI usage"
on public.ai_usage_events;

drop policy if exists "Users can read their own AI usage"
on public.ai_usage_events;

create policy "Users can read their own AI usage"
on public.ai_usage_events
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Admins can read AI usage events"
on public.ai_usage_events;

create policy "Admins can read AI usage events"
on public.ai_usage_events
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

revoke all on table public.ai_usage_events from anon;
revoke insert, update, delete on table public.ai_usage_events from authenticated;
grant select on table public.ai_usage_events to authenticated;

-- Reusable AI outputs: premium/admins can read, normal clients cannot write.
drop policy if exists "Premium members and admins can create discussion AI outputs"
on public.discussion_ai_outputs;

drop policy if exists "Premium members and admins can update discussion AI outputs"
on public.discussion_ai_outputs;

drop policy if exists "Premium members and admins can read discussion AI outputs"
on public.discussion_ai_outputs;

create policy "Premium members and admins can read discussion AI outputs"
on public.discussion_ai_outputs
for select
to authenticated
using (
  exists (
    select 1
    from public.user_ai_entitlements
    where user_ai_entitlements.user_id = auth.uid()
      and user_ai_entitlements.ai_assisted_enabled = true
      and user_ai_entitlements.tier in ('premium', 'admin')
  )
  or exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
);

revoke all on table public.discussion_ai_outputs from anon;
revoke insert, update, delete on table public.discussion_ai_outputs from authenticated;
grant select on table public.discussion_ai_outputs to authenticated;

-- Discussion summaries: premium/admins can read, normal clients cannot write.
drop policy if exists "Anyone can read discussion summaries"
on public.discussion_summaries;

drop policy if exists "Authenticated users can create discussion summaries"
on public.discussion_summaries;

drop policy if exists "Authenticated users can update discussion summaries"
on public.discussion_summaries;

drop policy if exists "Premium members and admins can read discussion summaries"
on public.discussion_summaries;

create policy "Premium members and admins can read discussion summaries"
on public.discussion_summaries
for select
to authenticated
using (
  exists (
    select 1
    from public.user_ai_entitlements
    where user_ai_entitlements.user_id = auth.uid()
      and user_ai_entitlements.ai_assisted_enabled = true
      and user_ai_entitlements.tier in ('premium', 'admin')
  )
  or exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
);

revoke all on table public.discussion_summaries from anon;
revoke insert, update, delete on table public.discussion_summaries from authenticated;
grant select on table public.discussion_summaries to authenticated;

-- Verification: RLS should be enabled.
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'ai_usage_events',
    'discussion_ai_outputs',
    'discussion_summaries'
  )
order by c.relname;

-- Verification: write policies should be gone; read policies should remain.
select
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'ai_usage_events',
    'discussion_ai_outputs',
    'discussion_summaries'
  )
order by tablename, policyname;

-- Verification: anon should have no privileges; authenticated should only have SELECT.
select
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'ai_usage_events',
    'discussion_ai_outputs',
    'discussion_summaries'
  )
  and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;
