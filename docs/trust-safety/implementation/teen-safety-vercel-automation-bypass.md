# Teen-safety verification: Vercel automation bypass

Status: production verification support

## Purpose

The production verifier sends authenticated, non-destructive HTTP probes to `https://loombus.com`. Vercel Security Checkpoint can challenge command-line automation before requests reach the Loombus application. A challenged request is verification infrastructure evidence, not proof that an application safety boundary passed or failed.

## Required Vercel configuration

Create a project-scoped Protection Bypass for Automation secret in the Loombus Vercel project. Give it a narrow note such as `teen-safety-production-verifier`.

Store the generated value only in the local ignored file:

```text
.env.teen-safety.local
```

Add:

```bash
VERCEL_AUTOMATION_BYPASS_SECRET=replace-with-the-generated-secret
```

Do not commit, paste into issues, include in reports, or expose the secret to browser code.

## Runtime behavior

`npm run verify:teen-safety` loads the local secret before the existing HTTP throttle. The verifier adds:

```text
x-vercel-protection-bypass: <secret>
```

only when the request origin exactly matches `LOOMBUS_BASE_URL`. It does not attach the secret to Supabase or other external requests, and it never logs the secret value.

The existing pacing, retry, and fail-incomplete behavior remains active. If Vercel still returns a Security Checkpoint after a valid bypass is configured, do not weaken application safeguards. Record the run as incomplete and inspect Vercel Firewall activity for an active attack mitigation or project rule that the automation bypass cannot override.
