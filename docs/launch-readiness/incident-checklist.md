# Incident Checklist

Use this when Loombus has broken functionality, unexpected data behavior, payment issues, auth problems, security concerns, or user-impacting downtime.

## First five minutes

1. Do not make random patches.
2. Record the current time.
3. Record the current git commit.
4. Identify the affected area:
   - auth/login
   - discussions/replies
   - profile/settings
   - payments/billing
   - AI tools
   - notifications/email
   - reports/moderation
   - database/RLS
   - Vercel deployment
   - Supabase service
5. Check whether the issue is live-only, local-only, or both.

## Immediate checks

Run:
- `git log -1 --oneline`
- `git status --short`
- `npm run build`
- live route HEAD checks for impacted pages
- unauthenticated API checks for protected APIs
- Supabase logs if database/auth/storage related
- Vercel deployment logs if route/runtime related

## Severity levels

Severity 1:
- site is down;
- login broken for all users;
- data exposure suspected;
- billing/webhook malfunction that grants/removes access incorrectly;
- destructive data issue.

Severity 2:
- important protected pages broken;
- Premium AI broken;
- reports/moderation broken;
- support/contact broken;
- email digest/welcome email failing repeatedly.

Severity 3:
- isolated UI bug;
- copy issue;
- minor broken link;
- non-critical admin display problem.

## Response rules

- For Severity 1: stop feature work and fix/rollback immediately.
- For Severity 2: patch or rollback after confirming cause.
- For Severity 3: batch with normal improvements unless user trust is impacted.

## Incident record

Record:
- date/time;
- commit;
- symptoms;
- affected routes/APIs;
- first failing command/output;
- suspected cause;
- fix or rollback action;
- verification output;
- final commit/checkpoint.
