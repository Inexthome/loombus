# Issue #671 Phase N: privacy-appropriate policy analytics

## Purpose

Satisfy the Issue #671 requirement for analytics that are limited to what is necessary and privacy-appropriate, without introducing reader profiling or a third-party analytics SDK.

## Baseline audit

The repository does not currently include Google Analytics, PostHog, `@vercel/analytics`, or another site-wide analytics SDK. The root application layout does not inject a site-wide analytics script.

Phase N therefore adds only a first-party aggregate counter for the public versioned-policy system.

## Data model

`public.policy_content_daily_analytics` stores one aggregate row per:

- UTC calendar day
- public surface: `current`, `history`, or `archive`
- immutable public policy document ID
- exact public version

The only metric is `view_count`.

The table does not contain reader-level event rows.

## Explicitly excluded data

Phase N does not collect or store:

- user/account ID
- IP address
- session ID or cookie identifier
- device identifier or user agent
- location
- referrer
- search query/text
- dwell time
- scroll depth
- a per-reader policy viewing history

The browser reporter sends only `surface`, `documentId`, and `version`, uses `credentials: "omit"`, and does not use cookies, local storage, or session storage.

## Public write boundary

The browser posts to the same-origin `/api/policy-content-analytics` endpoint.

The endpoint validates the submitted identity against the existing fail-closed public resolvers before counting it:

- `current` must equal the currently resolved public version
- `history` must be a currently visible public history family and is bound to its current public version
- `archive` must resolve as an exact publicly servable effective/superseded version

The endpoint never accepts arbitrary document/version analytics identities.

The server performs the aggregate increment using the existing Supabase service-role environment convention. The service-role credential is never exposed to the browser.

## Database access boundary

The aggregate table has RLS enabled and direct access is revoked from `anon` and `authenticated`.

`increment_policy_content_daily_analytics(...)` is a `SECURITY DEFINER` function whose execution is revoked from `public`, `anon`, and `authenticated` and granted only to `service_role`.

No exact retention period is introduced by this phase. Retention remains governed by the platform retention program rather than inventing a new period for this aggregate dataset.

## Administrator read path

`GET /api/admin/policy-content-analytics` is administrator-only using the existing request-account access check. It returns aggregate rows only and accepts a bounded date range of at most 93 days per request.

This is a read surface for aggregate operational measurement, not a reader-level analytics console.

## Instrumented public surfaces

- registry-managed canonical current policy route (`/accessibility` today)
- public version history
- exact public archive version

The reporter renders no UI and analytics failure never blocks policy content rendering.

## Unchanged boundaries

Phase N does not change:

- policy text or structured payloads
- registry lifecycle records
- approvals or reviewer evidence
- effective dates or scheduled transitions
- archive identities
- change notes
- first-20 draft import/public-routing controls
- search ranking or Support persistence
- Issue #667, #670, or #674 authorities

## Deployment note

This phase contains the additive migration:

`supabase/migrations/20260825075000_add_policy_content_daily_analytics.sql`

The migration must be applied to the target Supabase database before production analytics collection can succeed. The public policy pages themselves remain fail-open with respect to analytics: a failed counter request does not affect policy rendering.

## Verification

`scripts/verification/verify-policy-privacy-analytics.mjs` verifies the aggregate-only schema, RLS/grants, resolver validation, browser credential omission, absence of reader-level telemetry fields, administrator-only aggregate read path, instrumented surfaces, and unchanged first-20 publication locks.
