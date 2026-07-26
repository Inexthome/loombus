# Room subscription ladder

## Customer-facing plans

### Single-Room plans

- Free Room: $0, one Room, up to 10 members
- Room Starter: $19/month, one Room, up to 50 members
- Room Pro: $49/month, one Room, up to 250 members
- Room Business: $79/month, one Room, up to 750 members

### Organization plans

- Organization: $99/month, up to 3 Rooms, up to 500 members per Room
- Organization Plus: $199/month, up to 10 Rooms, up to 2,000 members per Room
- Organization Enterprise: custom agreement and sales-assisted provisioning

## Stripe configuration

Self-service checkout requires the existing Room billing environment variables plus:

- `STRIPE_ROOM_BUSINESS_MONTHLY_PRICE_ID` for the $79 monthly Room Business price
- `STRIPE_ROOM_ORGANIZATION_PLUS_MONTHLY_PRICE_ID` updated to the new $199 monthly price for new purchases and future plan changes

Keep `STRIPE_ROOM_ORGANIZATION_ENTERPRISE_MONTHLY_PRICE_ID` only while legacy self-service Enterprise subscriptions still exist. New Enterprise purchases do not use that price or self-service checkout.

Existing Organization Plus and Enterprise subscriptions remain on their current Stripe Price until the customer deliberately changes plans. Billing displays the actual Stripe subscription price for the active Room, so grandfathered subscribers continue to see their contracted amount.

## Database

No Supabase migration is required. Room plan keys and checkout intent plan keys are stored as text. Room Business is a single-Room tier and is intentionally excluded from Organization Console grouping and included-Room provisioning.
