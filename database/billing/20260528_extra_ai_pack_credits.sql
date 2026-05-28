-- Loombus Extra AI Pack credits
-- Adds one-time add-on credit packs for additional metered AI actions.
--
-- Supabase Data API policy:
-- This migration explicitly grants/revokes table access.
-- Anonymous users receive no table privileges.
-- Authenticated users may read only their own credit packs/ledger rows through RLS.
-- Writes are intended to be service-role/API controlled through Stripe webhook
-- and server-side AI consumption helpers.

create table if not exists public.ai_extra_credit_packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  stripe_customer_id text,
  purchased_credits integer not null default 25,
  remaining_credits integer not null default 25,
  status text not null default 'active',
  source text not null default 'stripe',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_extra_credit_packs_purchased_nonnegative
    check (purchased_credits >= 0),
  constraint ai_extra_credit_packs_remaining_nonnegative
    check (remaining_credits >= 0),
  constraint ai_extra_credit_packs_remaining_not_over_purchased
    check (remaining_credits <= purchased_credits),
  constraint ai_extra_credit_packs_status_check
    check (status in ('active', 'depleted', 'refunded', 'void')),
  constraint ai_extra_credit_packs_source_check
    check (source in ('stripe', 'admin', 'system'))
);

create table if not exists public.ai_extra_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid references public.ai_extra_credit_packs(id) on delete set null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  feature_key text,
  target_type text,
  target_id uuid,
  credits_delta integer not null,
  reason text not null,
  ai_usage_event_id uuid references public.ai_usage_events(id) on delete set null,
  stripe_checkout_session_id text,
  created_at timestamptz not null default now(),
  constraint ai_extra_credit_ledger_delta_not_zero
    check (credits_delta <> 0),
  constraint ai_extra_credit_ledger_reason_check
    check (reason in ('purchase', 'consume', 'refund', 'admin_adjustment', 'system_adjustment'))
);

create index if not exists ai_extra_credit_packs_user_status_idx
on public.ai_extra_credit_packs(user_id, status, created_at desc);

create index if not exists ai_extra_credit_packs_stripe_checkout_idx
on public.ai_extra_credit_packs(stripe_checkout_session_id);

create index if not exists ai_extra_credit_ledger_user_created_idx
on public.ai_extra_credit_ledger(user_id, created_at desc);

create index if not exists ai_extra_credit_ledger_pack_created_idx
on public.ai_extra_credit_ledger(pack_id, created_at desc);

alter table public.ai_extra_credit_packs enable row level security;
alter table public.ai_extra_credit_ledger enable row level security;

drop policy if exists "Users can read their own extra AI credit packs"
on public.ai_extra_credit_packs;

create policy "Users can read their own extra AI credit packs"
on public.ai_extra_credit_packs
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Admins can read extra AI credit packs"
on public.ai_extra_credit_packs;

create policy "Admins can read extra AI credit packs"
on public.ai_extra_credit_packs
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

drop policy if exists "Users can read their own extra AI credit ledger"
on public.ai_extra_credit_ledger;

create policy "Users can read their own extra AI credit ledger"
on public.ai_extra_credit_ledger
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Admins can read extra AI credit ledger"
on public.ai_extra_credit_ledger;

create policy "Admins can read extra AI credit ledger"
on public.ai_extra_credit_ledger
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
revoke all on table public.ai_extra_credit_packs from anon;
revoke all on table public.ai_extra_credit_ledger from anon;

revoke insert, update, delete on table public.ai_extra_credit_packs from authenticated;
revoke insert, update, delete on table public.ai_extra_credit_ledger from authenticated;

grant select on table public.ai_extra_credit_packs to authenticated;
grant select on table public.ai_extra_credit_ledger to authenticated;

comment on table public.ai_extra_credit_packs is
'One-time Extra AI Pack purchases and remaining credit balances.';

comment on table public.ai_extra_credit_ledger is
'Audit ledger for Extra AI Pack purchases, consumption, refunds, and adjustments.';

comment on column public.ai_extra_credit_packs.remaining_credits is
'Credits remaining from this purchased Extra AI Pack.';

comment on column public.ai_extra_credit_ledger.credits_delta is
'Positive for purchases/adjustments, negative for consumed credits.';

-- Verification helper:
-- select table_name, column_name, data_type
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name in ('ai_extra_credit_packs', 'ai_extra_credit_ledger')
-- order by table_name, ordinal_position;
--
-- select table_name, grantee, privilege_type
-- from information_schema.role_table_grants
-- where table_schema = 'public'
--   and table_name in ('ai_extra_credit_packs', 'ai_extra_credit_ledger')
--   and grantee in ('anon', 'authenticated')
-- order by table_name, grantee, privilege_type;
--
-- select tablename, policyname, cmd
-- from pg_policies
-- where schemaname = 'public'
--   and tablename in ('ai_extra_credit_packs', 'ai_extra_credit_ledger')
-- order by tablename, policyname;
