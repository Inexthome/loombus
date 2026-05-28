# Rate Limit Review

## Current protections already present

Loombus already has durable cooldown/rate-limit foundations for:
- follow toggle;
- block toggle;
- report creation;
- Labs feature request creation;
- Premium AI monthly limits;
- Extra AI Pack credit consumption;
- account/profile validation paths.

The database includes `action_rate_events` and SQL trigger-based cooldowns for some workflows.

## Endpoints to keep reviewing

High-risk endpoints:
- `/api/replies/create`
- `/api/discussions/create`
- `/api/reports`
- `/api/contact`
- `/api/labs/requests`
- `/api/labs/requests/vote`
- `/api/topic-alerts`
- `/api/profile`
- `/api/profile/avatar`
- `/api/billing/create-checkout-session`
- `/api/email/welcome/send`
- `/api/email/unsubscribe`

## Early launch policy

Before 50–100 users:
- keep current durable cooldowns;
- monitor admin health and logs;
- add more rate limiting only when abuse appears or a route is obviously exposed.

Before broader launch:
- add route-level limits for support/contact;
- add stricter AI endpoint abuse protection;
- consider centralized API rate limiting;
- ensure all state-changing routes require auth except public support/contact and public unsubscribe token flow.

## Rate-limit design rule

Prefer durable database-backed limits for user actions that matter:
- report creation;
- follow/block changes;
- content creation;
- Labs requests;
- billing-related actions.

Prefer lightweight app-level throttles for:
- public contact form;
- unauthenticated bad-token unsubscribe attempts;
- repeated checkout attempts;
- repeated AI generation attempts before entitlement checks.
