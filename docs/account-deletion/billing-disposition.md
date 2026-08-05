# Billing and payment account-deletion disposition

Status: engineering disposition only. This document does not approve retention periods, legal bases, customer deletion, subscription cancellation, entitlement mutation, invoice mutation, or payment-provider API calls.

Issue: #668
Evidence date: 2026-08-04
Owner: Loombus Privacy and Trust Operations with Finance and Billing Operations

## Scope

This phase covers billing-related data and references associated with a member account across:

- Stripe customers, subscriptions, checkout sessions, invoices, payments, refunds, disputes, chargebacks, and webhook events
- Apple App Store purchases, receipts, transactions, subscription status, grace periods, and renewal state
- Google Play purchases, purchase tokens, transactions, subscription status, grace periods, and renewal state
- local premium, AI, Floor, and other product-entitlement state
- Room billing, ownership, organization, and subscription references
- cancellation, trial, renewal, grace-period, delinquency, refund, and access-revocation metadata
- billing support, fraud, security, accounting, tax, audit, and legal-hold evidence
- logs, caches, backups, replicas, exports, notifications, and vendor copies linked to billing operations

The complete production table, foreign-key, provider-object, and vendor inventory remains subject to read-only verification. Repository evidence is not proof that an unreferenced production object or provider copy does not exist.

## Core distinction

Account deletion, product access, subscription lifecycle, and transaction retention are separate controls.

- Restricting an account does not cancel a subscription.
- Cancelling a subscription does not delete invoices, payments, refunds, disputes, or accounting evidence.
- Deleting a local entitlement does not prove provider billing stopped.
- Deleting a provider customer profile does not automatically remove transaction records that the provider or Loombus must retain.
- Removing a member from a Room cannot break Room ownership or billing continuity.
- Expiring Floor access cannot rewrite an invoice or erase an accountable transaction record.

## Current disposition

The registered resource is `billing_and_payment_records` with `manual_review` execution.

No automatic account-deletion handler exists for this resource. Deployment of this phase cannot:

- cancel a Stripe, App Store, or Google Play subscription
- delete or redact a Stripe customer
- revoke, expire, grant, or rewrite an entitlement
- alter an invoice, payment, refund, dispute, chargeback, receipt, or purchase token
- transfer Room ownership or billing responsibility
- change Floor or premium access
- invoke a provider deletion, cancellation, refund, or redaction API
- add an account-deletion worker dispatch
- enable `ACCOUNT_DELETION_DESTRUCTIVE_HANDLERS_ENABLED`

## Required review sequence

1. Identify every active and historical provider object and local billing or entitlement record linked to the member.
2. Reconcile provider state and local state before recording any cancellation or access outcome.
3. Separate active access from transaction evidence so retained invoices or payments cannot continue granting access.
4. Resolve active trials, grace periods, renewals, scheduled cancellations, delinquency, unpaid balances, refunds, disputes, chargebacks, and fraud reviews.
5. Resolve Room ownership, organization, and billing continuity before removing or anonymizing the member's billing references.
6. Resolve Floor and general Loombus subscription products independently.
7. Retain only the approved minimum transaction, tax, accounting, dispute, fraud, audit, and legal-hold evidence.
8. Evaluate optional customer-profile and presentation metadata separately from required transaction records.
9. Record provider identifiers, local identifiers, reviewed state, evidence, exceptions, and unresolved copies in the account-deletion disposition.
10. Verify logs, caches, webhook retries, notifications, support systems, exports, backups, replicas, and vendor copies separately.

## Evidence that is not sufficient

The following must not be accepted as deletion proof:

- a local entitlement row was removed
- a local subscription status says cancelled
- a webhook was received
- a checkout session expired
- the member lost application access
- a Stripe customer was deleted while invoices, payments, or disputes remain
- a database row was deleted while App Store, Google Play, Stripe, logs, backups, replicas, or support copies remain
- a Room owner record changed without verifying billing and organization continuity

## Exceptions requiring an approved basis

- tax and accounting retention
- active or threatened litigation, legal hold, regulator request, or audit
- refund, chargeback, payment, subscription, or delivery dispute
- fraud, security, abuse, or ban-evasion investigation
- unpaid balance, delinquency, grace period, or pending renewal or cancellation
- Room, organization, or business ownership continuity
- support evidence necessary to explain a billing decision

No duration is approved by this phase.

## Provider and production verification gaps

Before a billing disposition can become automatic, Loombus must verify:

- the complete local billing and entitlement schema and all account-linked foreign keys
- Stripe customer, subscription, invoice, payment, refund, dispute, event, and redaction behavior
- Apple App Store receipt, transaction, subscription, refund, grace-period, and retention behavior
- Google Play purchase-token, transaction, subscription, refund, grace-period, and retention behavior
- webhook-event storage, retries, dead-letter handling, and log retention
- tax, accounting, fraud, dispute, support, and audit retention requirements
- Room ownership and billing transfer contracts
- Floor and premium entitlement independence
- notification delivery records, infrastructure logs, caches, exports, backups, replicas, and vendor copies

## Completion boundary

This resource remains unresolved until an administrator records an evidence-backed terminal disposition or exception. The account-deletion processor must remain blocked and cannot mark the request completed while billing or payment review is pending.
