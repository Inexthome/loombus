-- Loombus billing portal Stripe identity foundation
-- Stores Stripe customer/subscription identifiers needed to open
-- Stripe Billing Portal sessions for members.
--
-- Supabase Data API policy:
-- This migration explicitly preserves grants/revokes for user_ai_entitlements.
-- Normal members may read only their own entitlement through RLS.
-- Admins may manage entitlements through existing admin RLS/API routes.
-- Anonymous users receive no table privileges.

alter table public.user_ai_entitlements
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_price_id text,
  add column if not exists stripe_current_period_end timestamptz,
  add column if not exists stripe_subscription_status text;

create index if not exists user_ai_entitlements_stripe_customer_idx
on public.user_ai_entitlements(stripe_customer_id);

create index if not exists user_ai_entitlements_stripe_subscription_idx
on public.user_ai_entitlements(stripe_subscription_id);

alter table public.user_ai_entitlements enable row level security;

-- Explicit Supabase Data API grants/revokes.
revoke all on table public.user_ai_entitlements from anon;

-- Authenticated clients may read only rows allowed by RLS.
-- Writes should stay admin/API controlled by existing RLS and server routes.
grant select on table public.user_ai_entitlements to authenticated;

comment on column public.user_ai_entitlements.stripe_customer_id is
'Stripe customer id used to open Billing Portal sessions.';

comment on column public.user_ai_entitlements.stripe_subscription_id is
'Current Stripe subscription id for the member, when available.';

comment on column public.user_ai_entitlements.stripe_price_id is
'Current Stripe price id for the active subscription item, when available.';

comment on column public.user_ai_entitlements.stripe_current_period_end is
'Current Stripe subscription period end, when available.';

comment on column public.user_ai_entitlements.stripe_subscription_status is
'Latest known Stripe subscription status for billing portal/account display.';

-- Verification helper:
-- select column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'user_ai_entitlements'
--   and column_name in (
--     'stripe_customer_id',
--     'stripe_subscription_id',
--     'stripe_price_id',
--     'stripe_current_period_end',
--     'stripe_subscription_status'
--   )
-- order by ordinal_position;
--
-- select grantee, privilege_type
-- from information_schema.role_table_grants
-- where table_schema = 'public'
--   and table_name = 'user_ai_entitlements'
--   and grantee in ('anon', 'authenticated')
-- order by grantee, privilege_type;
