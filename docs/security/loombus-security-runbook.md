# Loombus Security Runbook

_Last updated: 2026-06-14_

This runbook records the operating security posture for Loombus. Do not store secret values, private keys, signing credentials, database credentials, API keys, or certificates in this document.

## Branch protection

The main branch is protected. Changes should move through branch, pull request, required checks, merge, then branch deletion.

Direct pushes to main should be blocked by GitHub rules.

## Standard checks

Before merging code changes, run:

npm audit --omit=dev
npm run build
git status --short

Expected results: zero vulnerabilities, passing build, clean git status.

Do not run npm audit fix --force unless the breaking change has been reviewed.

## Dependency security

Dependabot is enabled. Review vulnerable packages, patch on a branch, run audit and build, then open a pull request.

PostCSS is pinned through package overrides to avoid the moderate audit alert from the nested Next dependency.

## Secret handling

Never commit Apple p8 keys, Android jks upload keys, private key folders, app-store screenshots, local legal folders, local audit folders, or local backup folders.

Sensitive local files are stored outside the repo at:

~/Documents/Loombus-Sensitive-Local

Do not delete that folder.

The repo gitignore protects local secrets, signing keys, store artifacts, backup folders, final audit folders, and legal review folders.

## Supabase security

Current posture: RLS enabled, sensitive helper functions scoped through auth.uid, anonymous execute removed where needed, discussion_views insert hardened, anonymous discussion view inserts ignored client-side.

Recommended settings: confirm email on, anonymous sign-ins off, manual account linking off, tightened auth rate limits, audit logs to database on.

## Public identity rules

Loombus requires complete public identity before public contribution.

Rules: public name required, placeholder names blocked, username required, temporary generated usernames blocked from complete status, bio required, weak bios blocked.

Incomplete profiles may browse but cannot create discussions or replies.

Admin review path: /admin/users, then Public profile -> Incomplete.

## Age verification

Members with valid age verification should not see the age prompt. Members without date of birth should see it. Valid save hides the prompt. Under-13 users are blocked.

## Vercel security

Recommended posture: Bot Protection on, Attack Mode off unless under active attack, custom deny rules only for known malicious patterns or IPs, system bypasses empty unless intentionally configured.

## Emergency checklist

If a secret is accidentally committed: stop pushing, revoke or rotate the exposed secret, remove it from the repo, check GitHub secret scanning, and treat it as compromised.

If production breaks after a merge: check Vercel logs, check GitHub Actions, revert if needed, then patch forward after identifying the failure.

## Post-merge verification

After every merge: checkout main, pull origin main, run npm audit --omit=dev, run npm run build, check git status --short, then test affected live routes.
