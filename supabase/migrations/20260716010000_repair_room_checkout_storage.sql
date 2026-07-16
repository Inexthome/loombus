-- Repairs and verifies the durable storage required before starting paid Room checkout.
-- Safe to run after 20260716003000_activate_room_billing.sql or independently.

begin;

create extension if not exists pgcrypto with schema extensions;

alter table public.rooms
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_price_id text,
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_current_period_end timestamptz,
  add column if not exists billing_updated_at timestamptz;

create unique index if not exists rooms_stripe_subscription_unique_idx
  on public.rooms (stripe_subscription_id)
  where stripe_subscription_id is not null;

create unique index if not exists rooms_stripe_checkout_session_unique_idx
  on public.rooms (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create index if not exists rooms_subscription_status_idx
  on public.rooms (subscription_status, subscription_plan);

create table if not exists public.room_checkout_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  room_name text not null,
  room_description text not null default '',
  room_type text not null default 'community',
  template_key text,
  plan_key text not null,
  member_limit integer,
  stripe_checkout_session_id text,
  status text not null default 'pending',
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.room_checkout_intents
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists room_name text,
  add column if not exists room_description text not null default '',
  add column if not exists room_type text not null default 'community',
  add column if not exists template_key text,
  add column if not exists plan_key text,
  add column if not exists member_limit integer,
  add column if not exists stripe_checkout_session_id text,
  add column if not exists status text not null default 'pending',
  add column if not exists last_error text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists room_checkout_intents_session_unique_idx
  on public.room_checkout_intents (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create index if not exists room_checkout_intents_user_status_idx
  on public.room_checkout_intents (user_id, status, created_at desc);

alter table public.room_checkout_intents enable row level security;

revoke all on table public.room_checkout_intents from anon;
revoke all on table public.room_checkout_intents from authenticated;

grant usage on schema public to service_role;
grant select, insert, update, delete on table public.room_checkout_intents to service_role;
grant select, insert, update, delete on table public.rooms to service_role;
grant select, insert, update, delete on table public.room_members to service_role;

-- Force PostgREST to recognize the table and newly-added Room billing columns immediately.
notify pgrst, 'reload schema';

commit;
