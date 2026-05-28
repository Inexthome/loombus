# Rollback Process

Rollback should be controlled, verified, and documented.

## Preferred rollback order

1. If a simple code patch fixes the issue safely, patch forward.
2. If the latest deployment is bad and previous deployment is known good, use Vercel rollback.
3. If a database migration caused the issue, prefer a targeted repair migration over a full database restore.
4. Use full database restore only for severe incidents where targeted repair is unsafe.

## Code rollback checklist

Before rollback:
- Confirm current commit.
- Confirm last known good commit.
- Confirm whether database schema changed after that commit.
- Confirm whether rolling code back will mismatch the database.

After rollback:
- Verify key pages.
- Verify protected APIs.
- Verify login/session behavior.
- Verify admin health.
- Verify billing/webhook routes if billing touched.
- Record final live status.

## Database rollback checklist

Before database rollback:
- Identify affected tables.
- Identify exact migration or SQL change.
- Determine whether rollback SQL is possible.
- Preserve audit, moderation, billing, and support records.
- Avoid deleting user activity without explicit decision.

## Never rollback blindly when changes involve

- billing entitlements;
- Stripe webhooks;
- account deletion/deactivation;
- moderation/audit logs;
- RLS/security policies;
- support requests;
- notifications;
- AI usage ledger;
- Extra AI Pack ledger.
