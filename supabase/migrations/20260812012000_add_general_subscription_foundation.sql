-- General Loombus subscription foundation.
--
-- Billing identity belongs here. AI quotas remain in user_ai_entitlements.
-- This migration is intentionally additive: existing Stripe/Apple compatibility
-- columns are preserved until every legacy reader has moved to the new source.
--
-- A member can briefly hold subscriptions through more than one provider, so
-- rows represent provider subscriptions rather than one mutable row per user.

create table if not exists public.user_general_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_key text not null default 'free'
    check (plan_key in ('free', 'premium', 'pro')),
  provider text
    check (provider is null or provider in ('stripe', 'apple')),
  provider_customer_id text,
  provider_subscription_id text,
  provider_product_id text,
  original_transaction_id text,
  app_account_token uuid,
  environment text
    check (environment is null or environment in ('Production', 'Sandbox')),
  status text not null default 'inactive',
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists user_general_subscriptions_provider_subscription_uidx
  on public.user_general_subscriptions (provider, provider_subscription_id)
  where provider is not null and provider_subscription_id is not null;

create unique index if not exists user_general_subscriptions_apple_original_transaction_uidx
  on public.user_general_subscriptions (provider, original_transaction_id)
  where provider = 'apple' and original_transaction_id is not null;

create index if not exists user_general_subscriptions_user_idx
  on public.user_general_subscriptions (user_id, updated_at desc);

create index if not exists user_general_subscriptions_plan_status_idx
  on public.user_general_subscriptions (plan_key, status);

alter table public.user_general_subscriptions enable row level security;

revoke all on table public.user_general_subscriptions from anon;
revoke insert, update, delete on table public.user_general_subscriptions from authenticated;
grant select on table public.user_general_subscriptions to authenticated;

drop policy if exists "Members can read own general subscription" on public.user_general_subscriptions;
create policy "Members can read own general subscription"
  on public.user_general_subscriptions
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Backfill active paid members after the AI allowance rebalance migration.
-- 300+ understanding actions is now the stable legacy Pro discriminator.
insert into public.user_general_subscriptions (
  user_id,
  plan_key,
  provider,
  provider_customer_id,
  provider_subscription_id,
  provider_product_id,
  original_transaction_id,
  status,
  current_period_end,
  last_verified_at,
  created_at,
  updated_at
)
select
  e.user_id,
  case
    when coalesce(e.monthly_summary_limit, 0) >= 300
      or lower(coalesce(e.notes, '')) like '%premium pro%'
      or lower(coalesce(e.notes, '')) like '%premium plus%'
      then 'pro'
    else 'premium'
  end as plan_key,
  case
    when e.stripe_customer_id = 'apple'
      or e.stripe_price_id like 'loombus_%'
      then 'apple'
    when e.stripe_customer_id is not null
      or e.stripe_subscription_id is not null
      or e.stripe_price_id is not null
      then 'stripe'
    else null
  end as provider,
  case when e.stripe_customer_id = 'apple' then null else e.stripe_customer_id end,
  e.stripe_subscription_id,
  e.stripe_price_id,
  case
    when e.stripe_customer_id = 'apple' then e.stripe_subscription_id
    else null
  end,
  case
    when lower(coalesce(e.stripe_subscription_status, '')) in ('active', 'trialing', 'past_due')
      then lower(e.stripe_subscription_status)
    when e.ai_assisted_enabled is true then 'active'
    else 'inactive'
  end,
  e.stripe_current_period_end,
  now(),
  coalesce(e.created_at, now()),
  now()
from public.user_ai_entitlements e
where e.ai_assisted_enabled is true
  and lower(coalesce(e.tier, '')) <> 'admin'
  and (
    lower(coalesce(e.tier, '')) in ('premium', 'pro', 'premium_pro', 'premium_plus')
    or coalesce(e.monthly_summary_limit, 0) > 0
  )
on conflict do nothing;

comment on table public.user_general_subscriptions is
  'Provider-neutral source of truth for general Loombus Free/Premium/Premium Pro billing state. Multiple provider subscriptions may coexist; effective access resolves from active rows. AI quotas remain in user_ai_entitlements.';
