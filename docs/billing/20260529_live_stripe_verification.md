# Loombus Live Stripe Verification

Date: 2026-05-29

## Summary

Live Stripe billing was verified for Loombus.

## Verified

- Live Premium checkout opens from Loombus.
- Live Premium payment completed successfully.
- Stripe Billing Portal opens from the logged-in Loombus account.
- Billing Portal shows subscription management, subscription details, receipts, and invoices.
- Billing Portal returns back to Loombus successfully.
- Premium checkout success banner displays on `/premium?checkout=success`.
- Premium checkout cancelled banner displays on `/premium?checkout=cancelled`.
- Billing API route protections remain active.

## Route protection checks

- Unauthenticated `/api/billing/create-checkout-session` returns `401`.
- Unauthenticated `/api/billing/create-portal-session` returns `401`.
- Unsigned `/api/billing/stripe-webhook` returns `400`.
- `/premium` returns `200`.
- `/settings?billing=returned` returns `200`.

## Notes

- Automatic Stripe email receipts may still need to be enabled in Stripe Dashboard customer email settings.
- Cancellation/downgrade behavior should be tested separately.
- Premium Plus and Extra AI Pack should be tested separately.
- No Stripe secrets, card details, payment IDs, or customer IDs are recorded in this file.
