-- Standalone paid access for The Floor. Core Loombus remains free.
create table if not exists public.floor_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_key text not null check (plan_key in ('floor_monthly', 'floor_annual')),
  status text not null default 'incomplete' check (
    status in ('active', 'trialing', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused')
  ),
  stripe_customer_id text,
  stripe_subscription_id text unique,
  stripe_price_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists floor_subscriptions_status_idx
  on public.floor_subscriptions(status);

alter table public.floor_subscriptions enable row level security;

drop policy if exists "Members can view their Floor subscription" on public.floor_subscriptions;
create policy "Members can view their Floor subscription"
  on public.floor_subscriptions for select
  to authenticated
  using (auth.uid() = user_id);

revoke insert, update, delete on public.floor_subscriptions from anon, authenticated;
grant select on public.floor_subscriptions to authenticated;

comment on table public.floor_subscriptions is
  'Server-managed Stripe entitlement for the standalone Loombus Floor subscription.';
