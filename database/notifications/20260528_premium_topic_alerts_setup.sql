-- Loombus Premium topic alerts
-- Allows Premium/Admin members to choose topic lanes and receive in-app
-- notifications when new discussions are published in those topics.
--
-- Supabase Data API policy:
-- This migration explicitly grants/revokes table access.
-- Anonymous users receive no table privileges.
-- Authenticated users may read their own topic alerts through RLS.
-- Authenticated Premium/Admin users may create/update/delete only their own alerts.
-- Server/API routes still validate topics and enforce Premium access.

create table if not exists public.user_topic_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  topic text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_topic_alerts_topic_length
    check (char_length(topic) between 1 and 80),
  constraint user_topic_alerts_unique_user_topic
    unique (user_id, topic)
);

create index if not exists user_topic_alerts_user_enabled_idx
on public.user_topic_alerts(user_id, enabled, topic);

create index if not exists user_topic_alerts_topic_enabled_idx
on public.user_topic_alerts(topic, enabled);

create or replace function public.user_has_premium_topic_alert_access(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles profile
    left join public.user_ai_entitlements entitlement
      on entitlement.user_id = profile.id
    where profile.id = target_user_id
      and (
        profile.is_admin = true
        or (
          entitlement.ai_assisted_enabled = true
          and entitlement.tier in ('premium', 'admin')
        )
      )
  );
$$;

alter table public.user_topic_alerts enable row level security;

drop policy if exists "Users can read their own topic alerts"
on public.user_topic_alerts;

create policy "Users can read their own topic alerts"
on public.user_topic_alerts
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Premium users can create their own topic alerts"
on public.user_topic_alerts;

create policy "Premium users can create their own topic alerts"
on public.user_topic_alerts
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.user_has_premium_topic_alert_access(auth.uid())
);

drop policy if exists "Premium users can update their own topic alerts"
on public.user_topic_alerts;

create policy "Premium users can update their own topic alerts"
on public.user_topic_alerts
for update
to authenticated
using (
  user_id = auth.uid()
  and public.user_has_premium_topic_alert_access(auth.uid())
)
with check (
  user_id = auth.uid()
  and public.user_has_premium_topic_alert_access(auth.uid())
);

drop policy if exists "Premium users can delete their own topic alerts"
on public.user_topic_alerts;

create policy "Premium users can delete their own topic alerts"
on public.user_topic_alerts
for delete
to authenticated
using (
  user_id = auth.uid()
  and public.user_has_premium_topic_alert_access(auth.uid())
);

drop policy if exists "Admins can read topic alerts"
on public.user_topic_alerts;

create policy "Admins can read topic alerts"
on public.user_topic_alerts
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
revoke all on table public.user_topic_alerts from anon;

grant select, insert, update, delete on table public.user_topic_alerts to authenticated;

comment on table public.user_topic_alerts is
'Premium/Admin member-selected topic alerts for new discussion notifications.';

comment on column public.user_topic_alerts.topic is
'Primary discussion topic lane the member wants alerts for.';

comment on column public.user_topic_alerts.enabled is
'Whether the topic alert is currently active.';

-- Verification helper:
-- select column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'user_topic_alerts'
-- order by ordinal_position;
--
-- select grantee, privilege_type
-- from information_schema.role_table_grants
-- where table_schema = 'public'
--   and table_name = 'user_topic_alerts'
--   and grantee in ('anon', 'authenticated')
-- order by grantee, privilege_type;
--
-- select policyname, cmd
-- from pg_policies
-- where schemaname = 'public'
--   and tablename = 'user_topic_alerts'
-- order by policyname;
