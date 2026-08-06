-- Creator Supporters Phase 2B.
-- Adds controlled web subscription billing, Stripe Connect payout identities,
-- recurring subscription state, refund review, and billing reconciliation.
-- Paid checkout remains disabled unless the production feature, platform fee,
-- automatic-tax decision, Stripe, and Supabase requirements are configured.

begin;

alter table public.creator_supporter_programs
  add column if not exists accepting_new_supporters boolean not null default true,
  add column if not exists billing_hold boolean not null default false,
  add column if not exists billing_hold_reason text;

alter table public.creator_supporter_tiers
  add column if not exists access_mode text not null default 'free',
  add column if not exists price_cents integer,
  add column if not exists currency text,
  add column if not exists billing_interval text,
  add column if not exists stripe_product_id text,
  add column if not exists stripe_price_id text,
  add column if not exists price_version integer not null default 0;

alter table public.creator_supporter_tiers
  drop constraint if exists creator_supporter_tiers_access_mode_check;
alter table public.creator_supporter_tiers
  add constraint creator_supporter_tiers_access_mode_check
  check (access_mode in ('free', 'paid'));

alter table public.creator_supporter_tiers
  drop constraint if exists creator_supporter_tiers_paid_configuration_check;
alter table public.creator_supporter_tiers
  add constraint creator_supporter_tiers_paid_configuration_check
  check (
    (
      access_mode = 'free'
      and price_cents is null
      and currency is null
      and billing_interval is null
      and stripe_product_id is null
      and stripe_price_id is null
    )
    or
    (
      access_mode = 'paid'
      and price_cents between 100 and 100000
      and currency = 'usd'
      and billing_interval = 'month'
      and nullif(stripe_product_id, '') is not null
      and nullif(stripe_price_id, '') is not null
    )
  );

create table if not exists public.creator_payout_accounts (
  creator_id uuid primary key references auth.users(id) on delete cascade,
  stripe_account_id text not null unique,
  account_type text not null default 'express',
  country text,
  default_currency text,
  details_submitted boolean not null default false,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  requirements_due text[] not null default '{}'::text[],
  platform_terms_version text,
  platform_terms_accepted_at timestamptz,
  platform_terms_ip inet,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_payout_accounts_type_check
    check (account_type = 'express')
);

create table if not exists public.creator_supporter_customers (
  supporter_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creator_supporter_checkout_intents (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  supporter_id uuid not null references auth.users(id) on delete cascade,
  tier_id uuid not null references public.creator_supporter_tiers(id) on delete restrict,
  payout_account_id text not null,
  stripe_checkout_session_id text unique,
  amount_cents integer not null,
  currency text not null default 'usd',
  platform_fee_bps integer not null,
  status text not null default 'pending',
  last_error text,
  expires_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_supporter_checkout_intents_distinct_users_check
    check (creator_id <> supporter_id),
  constraint creator_supporter_checkout_intents_amount_check
    check (amount_cents between 100 and 100000),
  constraint creator_supporter_checkout_intents_currency_check
    check (currency = 'usd'),
  constraint creator_supporter_checkout_intents_fee_check
    check (platform_fee_bps between 0 and 5000),
  constraint creator_supporter_checkout_intents_status_check
    check (status in ('pending', 'completed', 'expired', 'failed', 'cancelled'))
);

create index if not exists creator_supporter_checkout_intents_supporter_idx
  on public.creator_supporter_checkout_intents (supporter_id, created_at desc);
create index if not exists creator_supporter_checkout_intents_creator_idx
  on public.creator_supporter_checkout_intents (creator_id, created_at desc);

create table if not exists public.creator_supporter_subscriptions (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  supporter_id uuid not null references auth.users(id) on delete cascade,
  tier_id uuid not null references public.creator_supporter_tiers(id) on delete restrict,
  stripe_subscription_id text not null unique,
  stripe_customer_id text not null,
  stripe_price_id text not null,
  stripe_checkout_session_id text,
  payout_account_id text not null,
  status text not null,
  billing_hold boolean not null default false,
  billing_hold_reason text,
  cancel_at_period_end boolean not null default false,
  current_period_start timestamptz,
  current_period_end timestamptz,
  amount_cents integer not null,
  currency text not null default 'usd',
  platform_fee_bps integer not null,
  last_invoice_id text,
  last_payment_intent_id text,
  last_payment_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_supporter_subscriptions_distinct_users_check
    check (creator_id <> supporter_id),
  constraint creator_supporter_subscriptions_status_check
    check (status in (
      'incomplete', 'incomplete_expired', 'trialing', 'active',
      'past_due', 'canceled', 'unpaid', 'paused'
    )),
  constraint creator_supporter_subscriptions_amount_check
    check (amount_cents between 100 and 100000),
  constraint creator_supporter_subscriptions_currency_check
    check (currency = 'usd'),
  constraint creator_supporter_subscriptions_fee_check
    check (platform_fee_bps between 0 and 5000),
  unique (creator_id, supporter_id)
);

create index if not exists creator_supporter_subscriptions_creator_status_idx
  on public.creator_supporter_subscriptions (creator_id, status, current_period_end);
create index if not exists creator_supporter_subscriptions_supporter_status_idx
  on public.creator_supporter_subscriptions (supporter_id, status, current_period_end);
create index if not exists creator_supporter_subscriptions_payment_intent_idx
  on public.creator_supporter_subscriptions (last_payment_intent_id)
  where last_payment_intent_id is not null;

create table if not exists public.creator_supporter_refund_requests (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.creator_supporter_subscriptions(id) on delete cascade,
  creator_id uuid not null references auth.users(id) on delete cascade,
  supporter_id uuid not null references auth.users(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  requested_amount_cents integer,
  status text not null default 'pending_review',
  provider_refund_id text,
  resolution_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_supporter_refund_requests_reason_check
    check (char_length(reason) between 5 and 1000),
  constraint creator_supporter_refund_requests_amount_check
    check (requested_amount_cents is null or requested_amount_cents > 0),
  constraint creator_supporter_refund_requests_status_check
    check (status in (
      'pending_review', 'approved_manual', 'declined', 'refunded', 'closed'
    ))
);

create unique index if not exists creator_supporter_refund_requests_open_unique_idx
  on public.creator_supporter_refund_requests (subscription_id, requested_by)
  where status = 'pending_review';
create index if not exists creator_supporter_refund_requests_creator_idx
  on public.creator_supporter_refund_requests (creator_id, status, created_at desc);

create table if not exists public.creator_supporter_billing_reconciliation (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  action_key text not null default 'cancel_creator_subscriptions',
  reason text not null,
  status text not null default 'queued',
  attempt_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint creator_supporter_billing_reconciliation_action_check
    check (action_key in ('cancel_creator_subscriptions')),
  constraint creator_supporter_billing_reconciliation_status_check
    check (status in ('queued', 'processing', 'completed', 'failed'))
);

create unique index if not exists creator_supporter_billing_reconciliation_open_unique_idx
  on public.creator_supporter_billing_reconciliation (creator_id, action_key)
  where status in ('queued', 'processing');

alter table public.creator_payout_accounts enable row level security;
alter table public.creator_supporter_customers enable row level security;
alter table public.creator_supporter_checkout_intents enable row level security;
alter table public.creator_supporter_subscriptions enable row level security;
alter table public.creator_supporter_refund_requests enable row level security;
alter table public.creator_supporter_billing_reconciliation enable row level security;

revoke all on table public.creator_payout_accounts from public, anon, authenticated;
revoke all on table public.creator_supporter_customers from public, anon, authenticated;
revoke all on table public.creator_supporter_checkout_intents from public, anon, authenticated;
revoke all on table public.creator_supporter_subscriptions from public, anon, authenticated;
revoke all on table public.creator_supporter_refund_requests from public, anon, authenticated;
revoke all on table public.creator_supporter_billing_reconciliation from public, anon, authenticated;

grant all on table public.creator_payout_accounts to service_role;
grant all on table public.creator_supporter_customers to service_role;
grant all on table public.creator_supporter_checkout_intents to service_role;
grant all on table public.creator_supporter_subscriptions to service_role;
grant all on table public.creator_supporter_refund_requests to service_role;
grant all on table public.creator_supporter_billing_reconciliation to service_role;

create or replace function public.touch_creator_supporter_billing_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger touch_creator_payout_accounts_updated_at
before update on public.creator_payout_accounts
for each row execute function public.touch_creator_supporter_billing_updated_at();

create trigger touch_creator_supporter_customers_updated_at
before update on public.creator_supporter_customers
for each row execute function public.touch_creator_supporter_billing_updated_at();

create trigger touch_creator_supporter_checkout_intents_updated_at
before update on public.creator_supporter_checkout_intents
for each row execute function public.touch_creator_supporter_billing_updated_at();

create trigger touch_creator_supporter_subscriptions_updated_at
before update on public.creator_supporter_subscriptions
for each row execute function public.touch_creator_supporter_billing_updated_at();

create trigger touch_creator_supporter_refund_requests_updated_at
before update on public.creator_supporter_refund_requests
for each row execute function public.touch_creator_supporter_billing_updated_at();

create trigger touch_creator_supporter_reconciliation_updated_at
before update on public.creator_supporter_billing_reconciliation
for each row execute function public.touch_creator_supporter_billing_updated_at();

create or replace function public.creator_supporter_paid_subscription_allows_access(
  p_creator_id uuid,
  p_supporter_id uuid,
  p_tier_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.creator_supporter_subscriptions subscription
    where subscription.creator_id = p_creator_id
      and subscription.supporter_id = p_supporter_id
      and (p_tier_id is null or subscription.tier_id = p_tier_id)
      and subscription.billing_hold = false
      and (
        subscription.status in ('active', 'trialing')
        or (
          subscription.status = 'past_due'
          and subscription.current_period_end is not null
          and subscription.current_period_end > now()
        )
      )
  );
$$;

create or replace function public.creator_supporter_membership_is_active(
  p_creator_id uuid,
  p_supporter_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.creator_supporter_memberships membership
    join public.creator_supporter_programs program
      on program.creator_id = membership.creator_id
     and program.enabled = true
     and program.billing_hold = false
    join public.creator_supporter_tiers tier
      on tier.id = membership.tier_id
     and tier.creator_id = membership.creator_id
     and tier.is_active = true
    where membership.creator_id = p_creator_id
      and membership.supporter_id = p_supporter_id
      and membership.status = 'active'
      and (
        tier.access_mode = 'free'
        or public.creator_supporter_paid_subscription_allows_access(
          membership.creator_id,
          membership.supporter_id,
          tier.id
        )
      )
  );
$$;

create or replace function public.validate_creator_supporter_tier_billing()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  new.access_mode := lower(coalesce(nullif(new.access_mode, ''), 'free'));

  if new.access_mode = 'free' then
    new.price_cents := null;
    new.currency := null;
    new.billing_interval := null;
    new.stripe_product_id := null;
    new.stripe_price_id := null;
  elsif new.access_mode = 'paid' then
    new.currency := lower(coalesce(nullif(new.currency, ''), 'usd'));
    new.billing_interval := lower(coalesce(nullif(new.billing_interval, ''), 'month'));

    if new.price_cents is null or new.price_cents not between 100 and 100000 then
      raise exception 'Paid supporter tiers must be priced between $1 and $1,000 per month.'
        using errcode = '23514';
    end if;
    if new.currency <> 'usd' or new.billing_interval <> 'month' then
      raise exception 'The paid supporter beta supports USD monthly subscriptions only.'
        using errcode = '23514';
    end if;
    if nullif(new.stripe_product_id, '') is null
      or nullif(new.stripe_price_id, '') is null
    then
      raise exception 'Paid supporter tiers require verified Stripe product and price identifiers.'
        using errcode = '23514';
    end if;
  else
    raise exception 'Choose Free or Paid supporter access.' using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' then
    if (
      old.access_mode is distinct from new.access_mode
      or old.price_cents is distinct from new.price_cents
      or old.currency is distinct from new.currency
      or old.billing_interval is distinct from new.billing_interval
      or old.stripe_price_id is distinct from new.stripe_price_id
      or (old.is_active = true and new.is_active = false)
    ) and exists (
      select 1
      from public.creator_supporter_subscriptions subscription
      where subscription.tier_id = old.id
        and subscription.status in ('incomplete', 'trialing', 'active', 'past_due', 'unpaid')
    ) then
      raise exception 'Cancel or move active paid subscriptions before changing this tier billing contract.'
        using errcode = '23514';
    end if;

    if old.access_mode = 'free'
      and new.access_mode = 'paid'
      and exists (
        select 1
        from public.creator_supporter_memberships membership
        where membership.tier_id = old.id
          and membership.status = 'active'
      )
    then
      raise exception 'Move existing free supporters before converting this tier to Paid.'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_creator_supporter_tier_billing_trigger
  on public.creator_supporter_tiers;
create trigger validate_creator_supporter_tier_billing_trigger
before insert or update on public.creator_supporter_tiers
for each row execute function public.validate_creator_supporter_tier_billing();

create or replace function public.validate_active_creator_supporter_membership()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  tier_mode text;
begin
  if new.status <> 'active' then
    return new;
  end if;

  if not exists (
    select 1
    from public.creator_supporter_programs program
    where program.creator_id = new.creator_id
      and program.enabled = true
      and program.billing_hold = false
  ) then
    raise exception 'This supporter program is not active.' using errcode = '23514';
  end if;

  if not public.creator_has_supporter_program_access(new.creator_id) then
    raise exception 'This creator supporter program is unavailable.' using errcode = '42501';
  end if;

  select tier.access_mode
  into tier_mode
  from public.creator_supporter_tiers tier
  where tier.id = new.tier_id
    and tier.creator_id = new.creator_id
    and tier.is_active = true;

  if tier_mode is null then
    raise exception 'Choose an active supporter tier.' using errcode = '23514';
  end if;

  if tier_mode = 'paid'
    and not public.creator_supporter_paid_subscription_allows_access(
      new.creator_id,
      new.supporter_id,
      new.tier_id
    )
  then
    raise exception 'Complete the paid supporter subscription before access is granted.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.queue_creator_supporter_billing_reconciliation(
  p_creator_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  insert into public.creator_supporter_billing_reconciliation (
    creator_id,
    action_key,
    reason,
    status
  ) values (
    p_creator_id,
    'cancel_creator_subscriptions',
    left(coalesce(nullif(trim(p_reason), ''), 'Creator billing reconciliation required.'), 1000),
    'queued'
  )
  on conflict do nothing;
end;
$$;

revoke all on function public.touch_creator_supporter_billing_updated_at()
  from public, anon, authenticated;
revoke all on function public.creator_supporter_paid_subscription_allows_access(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.creator_supporter_membership_is_active(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.validate_creator_supporter_tier_billing()
  from public, anon, authenticated;
revoke all on function public.validate_active_creator_supporter_membership()
  from public, anon, authenticated;
revoke all on function public.queue_creator_supporter_billing_reconciliation(uuid, text)
  from public, anon, authenticated;

grant execute on function public.queue_creator_supporter_billing_reconciliation(uuid, text)
  to service_role;

notify pgrst, 'reload schema';

commit;
