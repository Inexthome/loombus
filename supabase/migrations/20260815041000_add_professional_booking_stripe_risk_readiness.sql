-- Professional Booking Stripe risk-readiness foundation.
--
-- Adds:
-- 1. append-only provider payment-eligibility reviews completed before Stripe
--    payout onboarding is allowed;
-- 2. server-only Stripe dispute lifecycle state for Professional Booking payments.
--
-- This migration does not create Stripe accounts, enable payments, submit dispute
-- evidence, accept Stripe platform acknowledgements, or perform money movement.

begin;

create table if not exists public.professional_booking_provider_payment_reviews (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references auth.users(id) on delete restrict,
  decision text not null,
  policy_version text not null,
  reviewed_business_ids uuid[] not null default '{}'::uuid[],
  reviewed_service_ids uuid[] not null default '{}'::uuid[],
  scope_fingerprint text not null,
  basis_note text not null,
  reviewed_by uuid not null references auth.users(id) on delete restrict,
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint professional_booking_provider_payment_reviews_decision_check
    check (decision in ('approved', 'rejected')),
  constraint professional_booking_provider_payment_reviews_policy_version_check
    check (char_length(policy_version) between 1 and 120),
  constraint professional_booking_provider_payment_reviews_business_scope_check
    check (cardinality(reviewed_business_ids) >= 1),
  constraint professional_booking_provider_payment_reviews_service_scope_check
    check (cardinality(reviewed_service_ids) >= 1),
  constraint professional_booking_provider_payment_reviews_fingerprint_check
    check (scope_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint professional_booking_provider_payment_reviews_basis_check
    check (char_length(basis_note) between 10 and 4000)
);

create index if not exists professional_booking_provider_payment_reviews_provider_idx
  on public.professional_booking_provider_payment_reviews(provider_id, reviewed_at desc);

create or replace function public.protect_professional_booking_provider_payment_review()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'Professional Booking provider payment reviews are append-only.'
    using errcode = '22023';
end;
$$;

revoke all on function public.protect_professional_booking_provider_payment_review()
  from public, anon, authenticated;

grant execute
  on function public.protect_professional_booking_provider_payment_review()
  to service_role;

drop trigger if exists professional_booking_provider_payment_review_immutable
  on public.professional_booking_provider_payment_reviews;

create trigger professional_booking_provider_payment_review_immutable
before update or delete on public.professional_booking_provider_payment_reviews
for each row execute function public.protect_professional_booking_provider_payment_review();

create table if not exists public.professional_booking_payment_disputes (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null
    references public.professional_booking_payments(id) on delete restrict,
  stripe_dispute_id text not null unique,
  stripe_charge_id text not null,
  stripe_payment_intent_id text not null,
  livemode boolean not null,
  amount_cents bigint not null,
  currency text not null,
  reason text not null,
  status text not null,
  is_charge_refundable boolean not null,
  evidence_due_at timestamptz,
  evidence_has_evidence boolean not null default false,
  evidence_past_due boolean not null default false,
  evidence_submission_count integer not null default 0,
  stripe_created_at timestamptz not null,
  last_stripe_event_id text not null,
  last_event_created_at timestamptz not null,
  first_seen_at timestamptz not null default now(),
  last_synced_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint professional_booking_payment_disputes_dispute_id_check
    check (char_length(stripe_dispute_id) between 1 and 255),
  constraint professional_booking_payment_disputes_charge_id_check
    check (char_length(stripe_charge_id) between 1 and 255),
  constraint professional_booking_payment_disputes_intent_id_check
    check (char_length(stripe_payment_intent_id) between 1 and 255),
  constraint professional_booking_payment_disputes_amount_check
    check (amount_cents > 0),
  constraint professional_booking_payment_disputes_currency_check
    check (currency = 'usd'),
  constraint professional_booking_payment_disputes_reason_check
    check (char_length(reason) between 1 and 200),
  constraint professional_booking_payment_disputes_status_check
    check (
      status in (
        'lost',
        'needs_response',
        'prevented',
        'under_review',
        'warning_closed',
        'warning_needs_response',
        'warning_under_review',
        'won'
      )
    ),
  constraint professional_booking_payment_disputes_submission_count_check
    check (evidence_submission_count >= 0),
  constraint professional_booking_payment_disputes_event_id_check
    check (char_length(last_stripe_event_id) between 1 and 255)
);

create index if not exists professional_booking_payment_disputes_payment_idx
  on public.professional_booking_payment_disputes(payment_id, stripe_created_at desc);

create index if not exists professional_booking_payment_disputes_status_idx
  on public.professional_booking_payment_disputes(status, evidence_due_at);

create or replace function public.protect_professional_booking_payment_dispute_identity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.id is distinct from old.id
     or new.payment_id is distinct from old.payment_id
     or new.stripe_dispute_id is distinct from old.stripe_dispute_id
     or new.stripe_charge_id is distinct from old.stripe_charge_id
     or new.stripe_payment_intent_id is distinct from old.stripe_payment_intent_id
     or new.livemode is distinct from old.livemode
     or new.stripe_created_at is distinct from old.stripe_created_at
     or new.first_seen_at is distinct from old.first_seen_at
     or new.created_at is distinct from old.created_at then
    raise exception 'Professional Booking Stripe dispute identity fields are immutable.'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_professional_booking_payment_dispute_identity()
  from public, anon, authenticated;

grant execute
  on function public.protect_professional_booking_payment_dispute_identity()
  to service_role;

drop trigger if exists professional_booking_payment_dispute_identity_immutable
  on public.professional_booking_payment_disputes;

create trigger professional_booking_payment_dispute_identity_immutable
before update on public.professional_booking_payment_disputes
for each row execute function public.protect_professional_booking_payment_dispute_identity();

alter table public.professional_booking_provider_payment_reviews enable row level security;
alter table public.professional_booking_provider_payment_reviews force row level security;
alter table public.professional_booking_payment_disputes enable row level security;
alter table public.professional_booking_payment_disputes force row level security;

revoke all privileges
  on table public.professional_booking_provider_payment_reviews
  from public, anon, authenticated, service_role;

revoke all privileges
  on table public.professional_booking_payment_disputes
  from public, anon, authenticated, service_role;

grant select, insert
  on table public.professional_booking_provider_payment_reviews
  to service_role;

grant select, insert, update
  on table public.professional_booking_payment_disputes
  to service_role;

-- The administrator payment-eligibility resolver uses the canonical
-- service-role server client to inspect the provider's current commercial
-- scope. Preserve the existing public/authenticated revocations while
-- granting only the server-side reads required for that review.
grant select
  on table public.business_services
  to service_role;

grant select
  on table public.marketplace_listings
  to service_role;


update public.account_deletion_resource_registry
set
  data_class =
    'Professional Booking provider payment-term acceptances, payment eligibility reviews, immutable payment contracts, Stripe authorization/capture/refund attempt history, and Stripe dispute lifecycle records',
  detail = jsonb_set(
    jsonb_set(
      detail,
      '{tables}',
      '[
        "professional_booking_payment_provider_terms",
        "professional_booking_provider_payment_reviews",
        "professional_booking_payments",
        "professional_booking_payment_attempts",
        "professional_booking_payment_disputes"
      ]'::jsonb,
      true
    ),
    '{default_rule}',
    to_jsonb(
      'Account deletion must not automatically delete or rewrite Professional Booking payment terms, provider payment-eligibility reviews, payment contracts, Stripe attempt history, or Stripe dispute records.'
      ::text
    ),
    true
  ),
  updated_at = now()
where resource_key = 'professional_booking_payment_records';

comment on table public.professional_booking_provider_payment_reviews is
  'Append-only administrator decisions for Professional Booking provider payment eligibility. Approval is product-specific and separate from business verification, Commerce Integrity classification, enforcement decisions, Stripe onboarding, and connected-account status.';

comment on column public.professional_booking_provider_payment_reviews.scope_fingerprint is
  'SHA-256 fingerprint of the payment-eligibility review scope used by runtime to detect relevant business or appointment-service changes after review.';

comment on table public.professional_booking_payment_disputes is
  'Server-only current Stripe dispute lifecycle for Professional Booking payments. Stripe evidence contents are not copied into this table; only operational deadline and evidence-state metadata is retained.';

comment on column public.professional_booking_payment_disputes.status is
  'Stripe dispute status stored verbatim from the installed Stripe API contract. This is separate from the Professional Booking payment authorization/capture/refund status.';

comment on column public.professional_booking_payment_disputes.evidence_due_at is
  'Stripe evidence response deadline when one exists. Null means Stripe supplied no actionable deadline.';

commit;
