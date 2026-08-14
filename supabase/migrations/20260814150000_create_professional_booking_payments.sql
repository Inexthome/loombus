-- Phase 3B.8F: controlled one-time Professional Booking payment lifecycle.
-- Stores immutable service-commerce economics and Stripe authorization attempts.
-- Money movement remains feature-flagged and is service-role only.
-- Financial and terms records deliberately use RESTRICT rather than implicit
-- parent cascades so account/service/appointment deletion cannot erase them
-- outside the approved account-deletion disposition workflow.

create table if not exists public.professional_booking_payment_provider_terms (
  provider_id uuid not null references auth.users(id) on delete restrict,
  terms_version text not null,
  accepted_at timestamptz not null default now(),
  accepted_ip inet,
  primary key (provider_id, terms_version),
  constraint professional_booking_payment_provider_terms_version_check
    check (char_length(terms_version) between 1 and 120)
);

create index if not exists professional_booking_payment_provider_terms_provider_idx
  on public.professional_booking_payment_provider_terms(provider_id, accepted_at desc);

create table if not exists public.professional_booking_payments (
  id uuid primary key default gen_random_uuid(),
  appointment_request_id uuid not null unique references public.business_appointment_requests(id) on delete restrict,
  service_id uuid not null references public.business_appointment_services(id) on delete restrict,
  provider_id uuid not null references auth.users(id) on delete restrict,
  requester_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'checkout_pending',
  gross_amount_cents bigint not null,
  currency text not null default 'usd',
  fee_schedule_version text not null,
  platform_fee_bps integer not null,
  platform_fee_cents bigint not null,
  provider_net_before_processing_cents bigint not null,
  provider_plan text not null,
  reduced_service_fee_applied boolean not null default false,
  provider_payment_terms_version text not null,
  provider_payment_terms_accepted_at timestamptz not null,
  stripe_destination_account_id text not null,
  stripe_refund_id text unique,
  authorized_at timestamptz,
  authorization_expires_at timestamptz,
  captured_at timestamptz,
  canceled_at timestamptz,
  refunded_at timestamptz,
  latest_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint professional_booking_payments_status_check check (
    status in (
      'checkout_pending',
      'authorized',
      'authorization_expired',
      'capture_pending',
      'captured',
      'cancel_pending',
      'canceled',
      'refund_pending',
      'refunded',
      'failed'
    )
  ),
  constraint professional_booking_payments_amount_check check (
    gross_amount_cents > 0
    and platform_fee_cents >= 0
    and platform_fee_cents <= gross_amount_cents
    and provider_net_before_processing_cents = gross_amount_cents - platform_fee_cents
  ),
  constraint professional_booking_payments_currency_check check (currency = 'usd'),
  constraint professional_booking_payments_fee_bps_check check (
    platform_fee_bps >= 0 and platform_fee_bps <= 10000
  ),
  constraint professional_booking_payments_plan_check check (
    provider_plan in ('free', 'premium', 'pro')
  ),
  constraint professional_booking_payments_terms_version_check check (
    char_length(provider_payment_terms_version) between 1 and 120
  ),
  constraint professional_booking_payments_provider_terms_fkey
    foreign key (provider_id, provider_payment_terms_version)
    references public.professional_booking_payment_provider_terms(provider_id, terms_version)
    on delete restrict
);

create index if not exists professional_booking_payments_provider_idx
  on public.professional_booking_payments(provider_id, updated_at desc);
create index if not exists professional_booking_payments_requester_idx
  on public.professional_booking_payments(requester_id, updated_at desc);

create table if not exists public.professional_booking_payment_attempts (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.professional_booking_payments(id) on delete restrict,
  status text not null default 'checkout_pending',
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  livemode boolean,
  authorization_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint professional_booking_payment_attempts_status_check check (
    status in (
      'checkout_pending',
      'authorized',
      'captured',
      'canceled',
      'expired',
      'failed'
    )
  )
);

create index if not exists professional_booking_payment_attempts_payment_idx
  on public.professional_booking_payment_attempts(payment_id, created_at desc);

create unique index if not exists professional_booking_payment_attempts_one_active_idx
  on public.professional_booking_payment_attempts(payment_id)
  where status in ('checkout_pending', 'authorized');

create or replace function public.protect_professional_booking_payment_contract()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if row(
    new.id,
    new.appointment_request_id,
    new.service_id,
    new.provider_id,
    new.requester_id,
    new.gross_amount_cents,
    new.currency,
    new.fee_schedule_version,
    new.platform_fee_bps,
    new.platform_fee_cents,
    new.provider_net_before_processing_cents,
    new.provider_plan,
    new.reduced_service_fee_applied,
    new.provider_payment_terms_version,
    new.provider_payment_terms_accepted_at,
    new.stripe_destination_account_id,
    new.created_at
  ) is distinct from row(
    old.id,
    old.appointment_request_id,
    old.service_id,
    old.provider_id,
    old.requester_id,
    old.gross_amount_cents,
    old.currency,
    old.fee_schedule_version,
    old.platform_fee_bps,
    old.platform_fee_cents,
    old.provider_net_before_processing_cents,
    old.provider_plan,
    old.reduced_service_fee_applied,
    old.provider_payment_terms_version,
    old.provider_payment_terms_accepted_at,
    old.stripe_destination_account_id,
    old.created_at
  ) then
    raise exception 'Professional Booking payment contract fields are immutable.'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function public.protect_professional_booking_payment_contract() from public;
revoke all on function public.protect_professional_booking_payment_contract() from anon;
revoke all on function public.protect_professional_booking_payment_contract() from authenticated;
grant execute on function public.protect_professional_booking_payment_contract() to service_role;

drop trigger if exists professional_booking_payment_contract_immutable
  on public.professional_booking_payments;
create trigger professional_booking_payment_contract_immutable
before update on public.professional_booking_payments
for each row execute function public.protect_professional_booking_payment_contract();

create or replace function public.protect_professional_booking_payment_attempt_identity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.id is distinct from old.id
     or new.payment_id is distinct from old.payment_id
     or new.created_at is distinct from old.created_at
     or (
       old.stripe_checkout_session_id is not null
       and new.stripe_checkout_session_id is distinct from old.stripe_checkout_session_id
     )
     or (
       old.stripe_payment_intent_id is not null
       and new.stripe_payment_intent_id is distinct from old.stripe_payment_intent_id
     )
     or (
       old.livemode is not null
       and new.livemode is distinct from old.livemode
     ) then
    raise exception 'Professional Booking Stripe attempt identity is immutable once assigned.'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function public.protect_professional_booking_payment_attempt_identity() from public;
revoke all on function public.protect_professional_booking_payment_attempt_identity() from anon;
revoke all on function public.protect_professional_booking_payment_attempt_identity() from authenticated;
grant execute on function public.protect_professional_booking_payment_attempt_identity() to service_role;

drop trigger if exists professional_booking_payment_attempt_identity_immutable
  on public.professional_booking_payment_attempts;
create trigger professional_booking_payment_attempt_identity_immutable
before update on public.professional_booking_payment_attempts
for each row execute function public.protect_professional_booking_payment_attempt_identity();

alter table public.professional_booking_payment_provider_terms enable row level security;
alter table public.professional_booking_payment_provider_terms force row level security;
alter table public.professional_booking_payments enable row level security;
alter table public.professional_booking_payments force row level security;
alter table public.professional_booking_payment_attempts enable row level security;
alter table public.professional_booking_payment_attempts force row level security;

revoke all on table public.professional_booking_payment_provider_terms from public;
revoke all on table public.professional_booking_payment_provider_terms from anon;
revoke all on table public.professional_booking_payment_provider_terms from authenticated;
revoke all on table public.professional_booking_payments from public;
revoke all on table public.professional_booking_payments from anon;
revoke all on table public.professional_booking_payments from authenticated;
revoke all on table public.professional_booking_payment_attempts from public;
revoke all on table public.professional_booking_payment_attempts from anon;
revoke all on table public.professional_booking_payment_attempts from authenticated;

grant select, insert on table public.professional_booking_payment_provider_terms to service_role;
grant select, insert, update, delete on table public.professional_booking_payments to service_role;
grant select, insert, update, delete on table public.professional_booking_payment_attempts to service_role;

comment on table public.professional_booking_payment_provider_terms is
  'Immutable versioned provider acceptance of the Professional Booking payment economics and lifecycle. This is separate from Creator Supporter product terms and blocks parent deletion until dispositioned.';
comment on column public.professional_booking_payment_provider_terms.accepted_ip is
  'Request IP recorded at explicit provider acceptance when available. No acceptance is inferred from Stripe onboarding or another Loombus product.';
comment on table public.professional_booking_payments is
  'Server-only immutable Professional Booking payment economics plus aggregate authorization/capture/refund state. No browser-supplied money values are trusted and parent deletion cannot cascade through this financial record.';
comment on column public.professional_booking_payments.provider_payment_terms_version is
  'Immutable current Professional Booking payment terms version explicitly accepted by the provider before this payment contract was created.';
comment on column public.professional_booking_payments.provider_payment_terms_accepted_at is
  'Immutable acceptance timestamp copied from the provider terms record when this payment contract was created.';
comment on column public.professional_booking_payments.provider_net_before_processing_cents is
  'Gross amount less only the Loombus platform fee. Stripe processing, taxes, disputes, and other settlement costs are not represented here.';
comment on table public.professional_booking_payment_attempts is
  'Server-only Stripe Checkout/PaymentIntent attempts for Professional Booking. Only one checkout_pending or authorized attempt may be active per payment, and payment deletion cannot cascade through attempt history.';
comment on index public.professional_booking_payment_attempts_one_active_idx is
  'Prevents concurrent active Checkout/authorization attempts for the same Professional Booking payment contract.';
comment on function public.protect_professional_booking_payment_contract() is
  'Prevents post-insert mutation of the appointment, participant, price, fee-schedule, plan, provider terms acceptance, and payout-destination contract for a Professional Booking payment.';
comment on function public.protect_professional_booking_payment_attempt_identity() is
  'Allows Stripe attempt identifiers to be assigned once, then prevents rebinding an attempt to a different Checkout Session, PaymentIntent, payment, or livemode.';
