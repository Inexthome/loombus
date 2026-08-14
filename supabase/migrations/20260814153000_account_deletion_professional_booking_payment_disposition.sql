-- Issue #668 / Phase 3B.8F Professional Booking financial-record disposition.
-- This migration is registry-only. It does not delete, anonymize, transfer,
-- refund, cancel, or otherwise mutate Professional Booking payment records and
-- it does not enable any account-deletion destructive handler.

insert into public.account_deletion_resource_registry (
  resource_key, data_class, system_of_record, disposition, handler_key,
  execution_mode, sort_order, detail
) values (
  'professional_booking_payment_records',
  'Professional Booking provider payment-term acceptances, immutable payment contracts, and Stripe authorization/capture/refund attempt history',
  'Supabase Database and Stripe Connect',
  'manual_review',
  'professional_booking_payment_records',
  'manual_review',
  71,
  jsonb_build_object(
    'status', 'disposition_defined_handler_not_approved',
    'automatic_execution', false,
    'tables', jsonb_build_array(
      'professional_booking_payment_provider_terms',
      'professional_booking_payments',
      'professional_booking_payment_attempts'
    ),
    'default_rule', 'Account deletion must not automatically delete or rewrite Professional Booking payment terms, payment contracts, or Stripe attempt history.',
    'preserve_until_resolved', jsonb_build_array(
      'provider payment-terms version and acceptance timestamp',
      'appointment, service, provider, and requester linkage required for transaction integrity',
      'gross amount, fee schedule, platform fee, provider net, and payout destination contract',
      'authorization, capture, cancellation, refund, and reconciliation state',
      'Stripe Checkout Session and PaymentIntent attempt linkage',
      'dispute, fraud, accounting, tax, support, audit, and legal-hold evidence'
    ),
    'required_review', jsonb_build_array(
      'applicable accounting, tax, dispute, chargeback, fraud, and legal-hold obligations',
      'whether participant identifiers should be retained, tombstoned, or separately mapped after profile/Auth disposition',
      'Stripe Connect and other processor retention/deletion behavior',
      'appointment and service continuity before any parent record disposition',
      'minimum retention schedule approved by Privacy, Finance, Trust and Safety, and qualified counsel where required'
    ),
    'foreign_key_guard', jsonb_build_object(
      'policy', 'restrict_no_implicit_cascade',
      'detail', 'Phase 3B.8F financial and provider-terms foreign keys use ON DELETE RESTRICT so Auth, appointment, service, or payment deletion cannot silently erase these records.'
    ),
    'separate_resources', jsonb_build_array(
      'business appointment request disposition',
      'appointment service/business ownership disposition',
      'profile and Supabase Auth disposition',
      'Stripe processor/vendor disposition',
      'notifications, logs, backups, replicas, and legal-hold evidence'
    ),
    'feature_flags', jsonb_build_object(
      'account_deletion', 'ACCOUNT_DELETION_DESTRUCTIVE_HANDLERS_ENABLED is unchanged and does not authorize Professional Booking financial-record mutation.',
      'professional_booking_payments', 'Professional Booking payment rollout flags do not authorize account-deletion mutation.'
    )
  )
)
on conflict (resource_key) do update set
  data_class = excluded.data_class,
  system_of_record = excluded.system_of_record,
  disposition = excluded.disposition,
  handler_key = excluded.handler_key,
  execution_mode = excluded.execution_mode,
  enabled = true,
  sort_order = excluded.sort_order,
  detail = excluded.detail,
  updated_at = now();

comment on table public.account_deletion_resource_registry is
'Executable account-deletion inventory. Professional Booking financial and payment-terms records are manual-review only and cannot be erased through implicit parent cascades.';
