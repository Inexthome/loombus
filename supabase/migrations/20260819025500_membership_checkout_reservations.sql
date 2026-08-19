-- Serializes recurring Loombus membership checkout creation per user.
-- The service role is the only runtime principal allowed to read or mutate
-- reservations. A reservation token is also used as the Stripe idempotency key.

begin;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.membership_checkout_reservations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reservation_id uuid not null default gen_random_uuid(),
  plan_key text not null check (
    plan_key in (
      'premium_monthly',
      'premium_annual',
      'premium_plus_monthly',
      'premium_plus_annual'
    )
  ),
  stripe_checkout_session_id text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists membership_checkout_reservations_reservation_unique_idx
  on public.membership_checkout_reservations (reservation_id);

create unique index if not exists membership_checkout_reservations_session_unique_idx
  on public.membership_checkout_reservations (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create index if not exists membership_checkout_reservations_expiry_idx
  on public.membership_checkout_reservations (expires_at);

alter table public.membership_checkout_reservations enable row level security;

revoke all on table public.membership_checkout_reservations from anon;
revoke all on table public.membership_checkout_reservations from authenticated;

grant usage on schema public to service_role;
grant select, insert, update, delete
  on table public.membership_checkout_reservations
  to service_role;

notify pgrst, 'reload schema';

commit;
