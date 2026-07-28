# Teen Safety Production Verification

Status: production verification
Scope: Issues #666, #680, and #683
Prepared: July 28, 2026

## Purpose

This runbook verifies that the teen-safety controls deployed through PRs #681 and #685 operate in production and cannot be bypassed through direct links, notifications, alternate clients, or direct API requests.

Do not close #683, #680, or #666 solely because the migrations applied successfully.

## Required controlled accounts

Use non-production-content test accounts only:

- `ADULT_A`: age band `adult`, active account
- `ADULT_B`: age band `adult`, active account
- `TEEN_A`: age band `teen`, active account
- `TEEN_B`: age band `teen`, active account
- `UNKNOWN_A`: age band `unknown`

Do not use a real child account. Under-13 behavior must be tested with a controlled synthetic account or transaction rollback.

## Gate 1: database readiness

Run `scripts/verification/teen-safety-production-readiness.sql` in Supabase SQL Editor.

Pass conditions:

- all required tables exist
- all required functions exist
- all required triggers exist and are enabled
- no teen owns a Room
- no teen has an elevated Room role
- no under-13 or unknown-age member has active Room membership
- every active teen Room member belongs to a Room that allows minors
- every active teen Room member has an approved Room application

Any nonzero violation count is a release blocker.

## Gate 2: account defaults

For `TEEN_A` confirm:

- `/account/age-safety` shows age band `teen`
- Teen Safety Mode is on
- account is private
- discoverability is off
- future Discussion audience is Followers
- unsolicited adult contact is blocked
- personalized recommendations and commerce discovery are limited

For `ADULT_A` confirm ordinary adult behavior remains available.

## Gate 3: Everything Search and Ask Loombus AI

As `TEEN_A`, search for known test records in each category:

- Business
- Service
- Request
- Job
- Marketplace
- product/company record
- public Event
- Room that allows minors
- Room that blocks minors

Pass conditions:

- protected commercial records do not appear while commerce discovery is disabled
- a Room that blocks minors and its Room-scoped records do not appear
- a Room that allows minors may appear when otherwise eligible
- public Event information may appear
- Ask Loombus AI does not cite, summarize, or transmit excluded records as context

Repeat the same searches as `ADULT_A` and confirm normal eligible results remain available.

## Gate 4: Local Discovery

As `TEEN_A`, confirm Local Discovery excludes:

- Businesses
- Services
- Jobs
- Marketplace
- Requests

Public Event information may remain visible.

Attempt to publish or change a public Local location through the UI and direct API. Both must fail with a teen restriction response.

## Gate 5: protected commercial actions

As `TEEN_A`, test both UI and direct API requests for:

- create or republish Business
- create or republish Job
- create, update, reopen, or mark Marketplace listing sold
- create or update Service and send inquiry
- create or update Request, respond, or select response
- create or update Event and respond to attendance
- create Appointment service or request Appointment

Pass condition: every protected mutation fails server-side. Hiding a button is not sufficient.

Confirm safety and cleanup paths remain available where supported:

- report
- remove
- cancel
- close
- archive
- unsave
- withdraw

## Gate 6: Room creation and ownership

As `TEEN_A`:

- attempt `/rooms/new`
- submit a direct request to `/api/rooms/provision`
- attempt ownership transfer through any available Admin or Room route

Pass condition: Room creation and ownership fail server-side.

## Gate 7: Room admission

Create two controlled Rooms owned by `ADULT_A`:

- `CLASSROOM_TEST`: Classroom model, default minor admission expected to be approval required
- `COMMUNITY_TEST`: Community model, default minor admission expected to be blocked

Confirm `/rooms/[roomId]/age-safety` loads in Light, Dark, and System appearance.

For `CLASSROOM_TEST`:

- invite `TEEN_A`
- confirm invitation redemption creates a pending application
- confirm no immediate membership exists
- approve the application as the adult owner
- confirm membership becomes active with role `member`

For `COMMUNITY_TEST`:

- invite `TEEN_B`
- confirm admission is blocked until the adult owner explicitly enables minors
- enable minors as the adult owner
- confirm admission remains approval-only

## Gate 8: prohibited Room roles

Attempt to assign `TEEN_A` each role through UI and direct database/API paths:

- moderator
- administrator
- owner

Pass condition: all fail. The only permitted role is ordinary member.

Attempt the same with `UNKNOWN_A` and an under-13 synthetic account. Active membership must fail.

## Gate 9: direct links and notifications

For every protected module:

1. Generate or reuse a notification pointing to a protected record.
2. Open the notification as `TEEN_A`.
3. Confirm informational public content may load only where it is also available signed out.
4. Submit the protected mutation from the destination.
5. Confirm the server rejects it.

Repeat by copying the destination URL into a new browser session and by calling the API directly with the teen access token.

## Gate 10: turning 18

Using a controlled account near the age boundary:

- run the approved age refresh process
- confirm age band changes from teen to adult
- confirm Teen Safety Mode disables
- confirm private-account and non-discoverable choices remain unchanged
- confirm no automatic Room role elevation or ownership occurs

## Gate 11: privacy and audit

Confirm:

- age data remains in `profile_sensitive`
- Room owners cannot see dates of birth
- member-facing pages do not expose reporter identity, internal notes, or sensitive age evidence
- Room minor-safety changes create audit events
- blocked actions do not leak whether another member is a teen

## Closure rule

Close #683 only after all gates pass and the result is recorded on the issue.

Close #680 only after #683 passes plus all direct-link and notification destinations are verified.

Close #666 only after Phase 1 verification, cross-module verification, turning-18 behavior, appearance checks, and the parent acceptance criteria are complete.
