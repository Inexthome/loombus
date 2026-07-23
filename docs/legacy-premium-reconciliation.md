# Legacy Premium subscription reconciliation

The Settings subscription API repairs older Premium entitlement rows that contain a Stripe customer ID but no Stripe subscription ID.

On the next authenticated subscription-center load, Loombus lists the customer's Stripe subscriptions, identifies the Premium or Premium Plus subscription by product metadata or configured Price ID, returns it immediately to the UI, and persists the recovered billing identity to `user_ai_entitlements`.

This avoids a manual SQL backfill for subscriptions created before Stripe subscription identity fields were stored locally.
