# Loombus Security Runbook

This runbook documents the current security baseline for Loombus and the rules to follow before shipping future changes.

## Current baseline

- main is protected and changes should go through pull requests.
- Vercel must pass before merging.
- Admin APIs require server-side admin checks before returning or changing admin data.
- Sensitive helper modules that use service credentials are marked with import "server-only";.
- Runtime and full dependency audits currently report zero vulnerabilities.
- Public API routes have been reviewed for unexpected exposure.
- Service-role usage has been reviewed and patched where needed.

## Branch protection

The main branch should stay protected with:

- Pull request required before merging.
- Status checks required before merging.
- Branch required to be up to date before merging.
- Conversation resolution required before merging.
- Force pushes disabled.
- Branch deletion disabled.
- Admin bypass disabled when available.

Do not push directly to main for normal changes.

## Secret handling

Never commit or paste real secrets.

Local secret files must remain ignored by Git:

- .env.local
- .env.*
- .vercel/
- Apple private keys
- Firebase service account files
- Android signing keys
- Local backup folders that contain credentials

When checking environment variables, verify presence only. Do not print values.

## Service-role rules

SUPABASE_SERVICE_ROLE_KEY is server-only.

It may be used only in:

- API routes.
- Server-side helper modules.
- Background jobs or cron routes.
- Admin-only diagnostics.

Before using the service role, routes must perform the relevant access check:

- Signed-in user check.
- Admin check for admin routes.
- Ownership check for user-owned records.
- Membership or participant check for messages.
- Token validation for public token-based routes.

Never import service-role helpers into client components.

Sensitive server helper files should include import "server-only";.

## Admin route rules

Admin API routes must verify the current user server-side and confirm profiles.is_admin.

Client-side admin guards are useful for user experience, but they are not a replacement for server-side admin checks.

If route-level middleware/proxy protection is reintroduced, it must be tested carefully before relying on it for admin enforcement.

## Public API routes

Public routes are allowed only when intentionally designed for public use.

Reviewed safe public routes include:

- /api/app-version
- /api/profiles/badges
- /api/discussions/view
- /api/email/unsubscribe

Public routes must not return secrets, private user records, billing identifiers, or admin-only data.

## Digest cron

The notification digest cron route uses:

- CRON_SECRET as the primary secret.
- DIGEST_CRON_SECRET as fallback.

Manual testing of the digest route can send real emails and update digest timestamps, so avoid manual triggering unless intentionally testing email delivery.

## Dependency checks

Before merging security-sensitive changes, run:

- npm audit --omit=dev --audit-level=low
- npm audit --audit-level=low
- npm run build

Expected result: found 0 vulnerabilities.

## Pull request checklist

Before merging:

- No real secrets in the diff.
- No .env files committed.
- No service-role helper imported by client code.
- Admin API routes check admin status server-side.
- User-owned writes check ownership or membership.
- Public routes expose only intentionally public data.
- npm run build passes.
- Vercel passes.
