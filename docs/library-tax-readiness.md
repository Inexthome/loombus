# Library tax readiness

Loombus Library paid-book checkout uses Stripe Checkout with Connect destination charges. Tax responsibility must be explicitly determined before paid checkout is allowed in production.

## Tax modes

`LOOMBUS_LIBRARY_TAX_MODE` is server-only and fail-closed.

- `external_acknowledged` — paid Library checkout uses the existing destination-charge flow only after Loombus has explicitly determined that Stripe Tax is not the tax mechanism for this flow and has accepted the resulting tax/compliance responsibility outside this code path.
- `platform_stripe_tax` — Stripe Checkout calculates tax with platform liability. Loombus snapshots the calculated tax and creates an idempotent transfer reversal for the tax amount so the tax remains on the platform instead of the connected author account.
- unset or any other value — paid Library checkout is blocked.

Both modes also require `LOOMBUS_LIBRARY_TAX_LEDGER_READY=true`. Keep it false until `supabase/migrations/20260902082000_add_library_tax_audit.sql` has been applied successfully in production. The commerce ledger remains readable against the pre-migration schema, but paid checkout stays fail-closed so a buyer cannot be charged before Loombus can durably record the tax posture.

`platform_stripe_tax` additionally requires `LOOMBUS_LIBRARY_STRIPE_TAX_CODE`. The code must match the rights granted by the Library product. Stripe currently lists `txcd_10302000` for downloaded digital books with permanent rights; select the production code based on the actual Library rights and tax advice rather than treating that example as a legal determination.

## Platform-liable transaction flow

1. Checkout is created with `automatic_tax.enabled=true` and `automatic_tax.liability.type=self`.
2. The dynamic Stripe product is assigned the configured Library product tax code.
3. The connected author remains the destination of the PaymentIntent and the existing Loombus platform fee remains an `application_fee_amount`.
4. Fulfillment re-fetches the Checkout Session with the PaymentIntent's latest Charge expanded.
5. The canonical book subtotal must still match the snapshotted Library price. Stripe tax is stored separately and never included in author gross revenue or platform-fee calculations.
6. If Stripe calculated tax, Loombus creates an idempotent Transfer Reversal for exactly that tax amount and stores the reversal ID on the Library purchase ledger before granting the durable paid entitlement.
7. The purchase ledger snapshots `tax_mode`, `tax_amount_cents`, `stripe_tax_transfer_reversal_id`, and `tax_withheld_at`.

This follows Stripe's marketplace guidance for platform-liable destination-charge Checkout: the tax amount is initially part of the destination flow and must be withheld back to the platform for remittance.

## Refund and chargeback money movement

The canonical admin Library refund operation issues a full Stripe refund with both `reverse_transfer=true` and `refund_application_fee=true`. The webhook then verifies the destination economics before revoking entitlement.

For any full `charge.refunded` event, including a refund initiated in Stripe Dashboard, Loombus reconciles the destination transfer and application fee idempotently. Any remaining destination transfer is reversed and any remaining application fee is refunded before the purchase becomes `refunded`.

A lost dispute receives the same destination-transfer/application-fee reconciliation before the purchase becomes `chargeback`. Stripe Tax reporting does not automatically reduce collected tax for an upheld cardholder dispute, so dispute-tax reporting remains a platform compliance/accounting concern and must be reviewed in Stripe Tax reports.

Partial refunds are not exposed by the canonical Loombus Library refund operation. The current entitlement model revokes paid access only on a full refund or lost chargeback.

## Stripe Dashboard requirements

Before setting `LOOMBUS_LIBRARY_TAX_MODE=platform_stripe_tax` in production:

1. Confirm with qualified tax advice whether Loombus is liable to collect/remit tax for the relevant marketplace transactions and jurisdictions.
2. Configure the platform's Stripe Tax origin/head-office address.
3. Add the jurisdictions where the platform is registered to collect tax.
4. Set the appropriate default tax behavior for prices in Stripe Tax settings.
5. Select the correct Library product tax code and set `LOOMBUS_LIBRARY_STRIPE_TAX_CODE`.
6. Verify the Stripe webhook receives Checkout completion, refund, and dispute events.
7. Apply `supabase/migrations/20260902082000_add_library_tax_audit.sql`.
8. Set `LOOMBUS_LIBRARY_TAX_LEDGER_READY=true` only after the migration succeeds.
9. Run a live-mode controlled transaction only after test-mode tax, withholding, refund, and entitlement reconciliation have passed.

## Operational rule

Do not use `external_acknowledged` merely to bypass the tax gate. It is an explicit production acknowledgement. If the tax posture has not been determined, leave the mode unset and paid Library checkout remains unavailable.
