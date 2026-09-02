# Library tax readiness

Loombus Library paid-book checkout uses Stripe Checkout with Connect destination charges. Tax responsibility must be explicitly determined before paid checkout is allowed in production.

## Tax modes

`LOOMBUS_LIBRARY_TAX_MODE` is server-only and fail-closed.

- `external_acknowledged` — paid Library checkout may use the existing checkout flow only after Loombus has explicitly determined that Stripe Tax is not the tax mechanism for this flow and has accepted the resulting tax/compliance responsibility outside this code path.
- `platform_stripe_tax` — reserved for a future platform-liable Stripe Tax flow. This value intentionally blocks checkout until destination-charge tax withholding and refund/transfer reversal behavior are implemented and verified end-to-end.
- unset or any other value — paid Library checkout is blocked.

## Why platform Stripe Tax is not enabled yet

Stripe's current Connect marketplace guidance requires the platform to first determine who is legally liable for indirect tax. When the platform is liable and uses Checkout with destination charges, Stripe Tax can calculate tax with automatic tax liability assigned to the platform, but the collected tax must also be withheld from the connected account. For Checkout destination charges, Stripe documents transfer reversal as the withholding mechanism after completion.

The current Library payment lifecycle records refunds and disputes for entitlement purposes, but it does not yet initiate the Stripe-side refund and connected-account transfer reversal itself. Enabling automatic tax without completing those money-movement controls would create a misleading partial implementation.

## Requirements before `platform_stripe_tax` can become active

1. Determine and document whether Loombus is the marketplace facilitator/deemed seller for the relevant transactions and jurisdictions.
2. Configure the Stripe platform tax head-office location, registrations, and product tax classification.
3. Enable Checkout automatic tax with platform liability for the existing destination-charge flow.
4. Snapshot tax amounts and tax mode against the Library purchase ledger.
5. Withhold collected tax from the connected author using an idempotent transfer reversal tied to the Checkout Session.
6. Implement platform-owned refund operations that correctly reverse the seller transfer, application fee, and tax effects.
7. Verify disputes, chargebacks, partial refunds, retries, and webhook idempotency.
8. Add production reconciliation for Stripe payment, transfer, tax, refund, and Library entitlement states.

## Deployment rule

Do not set `LOOMBUS_LIBRARY_TAX_MODE=external_acknowledged` merely to bypass this guard. It is an explicit production acknowledgement. If the legal/tax posture has not been determined, leave the variable unset and paid Library checkout will remain unavailable.
