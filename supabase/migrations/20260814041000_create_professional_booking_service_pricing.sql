-- Professional Booking 3B.8A paid-service pricing foundation.
-- Stores a structured fixed USD amount for an owned appointment service.
-- This migration does not create a Stripe product, checkout, charge, transfer,
-- payout, platform fee, tax calculation, refund, or payment obligation.
-- Existing business_appointment_services.price_text remains unchanged.

begin;

create table if not exists public.professional_booking_service_pricing (
  service_id uuid primary key
    references public.business_appointment_services(id) on delete cascade,
  provider_id uuid not null
    references public.profiles(id) on delete cascade,
  amount_cents bigint not null,
  currency text not null default 'usd',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint professional_booking_service_pricing_amount_check
    check (amount_cents > 0),
  constraint professional_booking_service_pricing_currency_check
    check (currency = 'usd')
);

create index if not exists professional_booking_service_pricing_provider_idx
  on public.professional_booking_service_pricing (provider_id);

alter table public.professional_booking_service_pricing enable row level security;
alter table public.professional_booking_service_pricing force row level security;

revoke all on table public.professional_booking_service_pricing
  from public, anon, authenticated;
grant select, insert, update, delete
  on table public.professional_booking_service_pricing
  to service_role;

comment on table public.professional_booking_service_pricing is
  'Premium Pro Professional Booking structured fixed-price configuration. Storage only; no payment or payout occurs from this table.';
comment on column public.professional_booking_service_pricing.amount_cents is
  'Exact positive fixed service amount stored in integer cents. Not derived from business_appointment_services.price_text.';
comment on column public.professional_booking_service_pricing.currency is
  'Initial Professional Booking structured-pricing currency. 3B.8A supports USD configuration only.';

notify pgrst, 'reload schema';

commit;
