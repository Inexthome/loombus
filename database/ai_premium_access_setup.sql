-- Loombus Premium AI-Assisted Layer foundation
-- Run this in Supabase SQL Editor before deploying premium-gated AI code.

create table if not exists public.user_ai_entitlements (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  tier text not null default 'free',
  ai_assisted_enabled boolean not null default false,
  monthly_summary_limit integer not null default 0,
  monthly_writing_limit integer not null default 0,
  monthly_research_limit integer not null default 0,
  monthly_discovery_limit integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_ai_entitlements_tier_check
    check (tier in ('free', 'premium', 'admin'))
);

create index if not exists user_ai_entitlements_tier_idx
on public.user_ai_entitlements(tier);

create index if not exists user_ai_entitlements_enabled_idx
on public.user_ai_entitlements(ai_assisted_enabled);

alter table public.user_ai_entitlements enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_ai_entitlements'
      and policyname = 'Users can read their own AI entitlement'
  ) then
    create policy "Users can read their own AI entitlement"
    on public.user_ai_entitlements
    for select
    using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_ai_entitlements'
      and policyname = 'Admins can read AI entitlements'
  ) then
    create policy "Admins can read AI entitlements"
    on public.user_ai_entitlements
    for select
    using (
      exists (
        select 1
        from public.profiles
        where profiles.id = auth.uid()
          and profiles.is_admin = true
      )
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_ai_entitlements'
      and policyname = 'Admins can manage AI entitlements'
  ) then
    create policy "Admins can manage AI entitlements"
    on public.user_ai_entitlements
    for all
    using (
      exists (
        select 1
        from public.profiles
        where profiles.id = auth.uid()
          and profiles.is_admin = true
      )
    )
    with check (
      exists (
        select 1
        from public.profiles
        where profiles.id = auth.uid()
          and profiles.is_admin = true
      )
    );
  end if;
end $$;

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  feature_key text not null,
  target_type text,
  target_id uuid,
  provider text,
  model_name text,
  cached boolean not null default false,
  success boolean not null default true,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_events_user_id_idx
on public.ai_usage_events(user_id);

create index if not exists ai_usage_events_feature_key_idx
on public.ai_usage_events(feature_key);

create index if not exists ai_usage_events_created_at_idx
on public.ai_usage_events(created_at);

alter table public.ai_usage_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ai_usage_events'
      and policyname = 'Users can read their own AI usage'
  ) then
    create policy "Users can read their own AI usage"
    on public.ai_usage_events
    for select
    using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ai_usage_events'
      and policyname = 'Users can insert their own AI usage'
  ) then
    create policy "Users can insert their own AI usage"
    on public.ai_usage_events
    for insert
    with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ai_usage_events'
      and policyname = 'Admins can read AI usage events'
  ) then
    create policy "Admins can read AI usage events"
    on public.ai_usage_events
    for select
    using (
      exists (
        select 1
        from public.profiles
        where profiles.id = auth.uid()
          and profiles.is_admin = true
      )
    );
  end if;
end $$;

-- Tighten summary reads now that AI summaries are Premium-only.
drop policy if exists "Anyone can read discussion summaries"
on public.discussion_summaries;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'discussion_summaries'
      and policyname = 'Premium members and admins can read discussion summaries'
  ) then
    create policy "Premium members and admins can read discussion summaries"
    on public.discussion_summaries
    for select
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
  end if;
end $$;

comment on table public.user_ai_entitlements is
'Premium AI-Assisted Layer entitlements for Loombus members.';

comment on table public.ai_usage_events is
'Usage log for Premium AI-Assisted Layer features.';

comment on column public.ai_usage_events.feature_key is
'AI feature used, such as thread_summary, writing_assist, research_mode, discovery, or moderation_assist.';
