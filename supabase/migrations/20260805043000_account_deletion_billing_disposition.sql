-- Issue #668 billing, subscription, invoice, entitlement, and payment-vendor disposition.
-- This migration does not cancel a subscription, delete a customer, remove an
-- entitlement, alter an invoice, invoke a payment-provider API, add an
-- account-deletion worker dispatch, or enable a destructive handler.

insert into public.account_deletion_resource_registry (
  resource_key, data_class, system_of_record, disposition, handler_key,
  execution_mode, sort_order, detail
) values (
  'billing_and_payment_records',
  'Stripe, mobile-store, Room, Floor, premium-entitlement, invoice, payment, refund, webhook, and dispute records',
  'Supabase Database, Stripe, Apple App Store, Google Play, application runtime, and infrastructure providers',
  'manual_review',
  'billing_and_payment_records',
  'manual_review',
  82,
  jsonb_build_object(
    'status', 'disposition_defined_handler_not_approved',
    'automatic_execution', false,
    'first_party_scope', jsonb_build_array(
      'local customer and subscription identifiers',
      'premium and AI entitlement state',
      'Floor subscription state',
      'Room billing and ownership references',
      'checkout and purchase-verification metadata',
      'webhook-derived subscription lifecycle metadata',
      'invoice, payment, refund, cancellation, trial, grace-period, and renewal references',
      'support, dispute, chargeback, fraud, tax, accounting, and audit evidence linked to billing'
    ),
    'external_processors', jsonb_build_array(
      'Stripe',
      'Apple App Store',
      'Google Play',
      'email and push providers used for billing notices',
      'Vercel and Supabase logs, backups, and replicas'
    ),
    'required_sequence', jsonb_build_array(
      'identify every active subscription, trial, grace period, pending cancellation, Room billing relationship, Floor entitlement, premium entitlement, and mobile-store purchase linked to the member',
      'separate access revocation and subscription cancellation from deletion or retention of transaction evidence',
      'preserve invoices, payments, refunds, chargebacks, disputes, fraud evidence, tax records, accounting records, and legally required audit proof until an approved schedule permits disposal',
      'resolve Room ownership and billing continuity before changing an owner or billing reference',
      'resolve Floor and premium access independently so one product cancellation does not mutate another product record',
      'verify webhook-derived local state against the applicable provider before recording a terminal disposition',
      'record provider object identifiers, local row identifiers, cancellation state, retention exception, evidence, reviewer, and unresolved vendor copies on the account deletion disposition',
      'verify caches, logs, backups, replicas, exports, support systems, and notification-vendor copies separately'
    ),
    'prohibited_shortcuts', jsonb_build_array(
      'treating account restriction as subscription cancellation',
      'treating subscription cancellation as deletion of invoices or payment history',
      'deleting a local entitlement while leaving provider billing active',
      'deleting a Stripe customer or mobile-store reference before disputes, refunds, taxes, accounting, fraud, and ownership obligations clear',
      'removing Room billing references before ownership transfer or staged Room deletion is complete',
      'using a webhook event or local status alone as proof of provider-side deletion',
      'using database deletion as proof that logs, caches, backups, replicas, exports, or vendor copies expired'
    ),
    'decision_classes', jsonb_build_object(
      'access_and_entitlements', 'Revoke or expire access only after provider and local lifecycle state are reconciled.',
      'active_subscriptions', 'Cancel or allow scheduled cancellation under the approved product workflow; do not delete transaction evidence.',
      'customer_profiles', 'Delete optional presentation metadata only after all subscriptions, invoices, disputes, refunds, fraud, tax, accounting, and ownership dependencies clear.',
      'invoices_and_transactions', 'Retain minimum required transaction evidence under an approved legal and accounting schedule.',
      'webhook_and_audit_metadata', 'Retain the minimum proof needed to reconcile provider and local state under an approved schedule.',
      'mobile_store_records', 'Reconcile App Store and Google Play entitlement and receipt state using provider-specific controls before local disposition.',
      'room_billing', 'Transfer ownership and billing continuity or complete independent staged Room deletion before member finalization.'
    ),
    'exceptions', jsonb_build_array(
      'tax and accounting retention',
      'refund, chargeback, payment, or subscription dispute',
      'fraud, abuse, security, or ban-evasion investigation',
      'legal hold, litigation, regulator, or audit request',
      'Room ownership or organization continuity',
      'active trial, grace period, renewal, cancellation, or unpaid balance',
      'support case or delivery dispute requiring billing evidence'
    ),
    'verification_requirements', jsonb_build_array(
      'inventory local billing and entitlement tables from production metadata',
      'inventory active and historical Stripe objects associated with each local identifier',
      'inventory Apple and Google purchase and entitlement records associated with the account',
      'verify no active provider billing remains when access is recorded as cancelled',
      'verify retained transaction rows no longer grant product access',
      'verify Room and Floor billing references remain internally consistent',
      'verify deletion or minimization of optional metadata without altering required transaction evidence',
      'verify unresolved logs, backups, replicas, exports, notifications, and vendor copies are recorded as exceptions'
    ),
    'unverified', jsonb_build_array(
      'complete production table and foreign-key inventory',
      'Stripe customer deletion and redaction controls',
      'Stripe invoice, payment, refund, dispute, and event retention behavior',
      'Apple App Store receipt and transaction retention behavior',
      'Google Play purchase-token and transaction retention behavior',
      'webhook log and retry retention',
      'tax, accounting, dispute, and fraud retention periods',
      'backup, replica, cache, export, and support-system propagation'
    ),
    'feature_flags', jsonb_build_object(
      'account_deletion', 'ACCOUNT_DELETION_DESTRUCTIVE_HANDLERS_ENABLED is unchanged and does not authorize billing cancellation, entitlement mutation, customer deletion, invoice mutation, or provider API calls.'
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
'Executable account-deletion inventory. Billing and payment records remain manual-review only until provider, entitlement, ownership, transaction-retention, dispute, tax, accounting, vendor, and verification prerequisites are satisfied.';
