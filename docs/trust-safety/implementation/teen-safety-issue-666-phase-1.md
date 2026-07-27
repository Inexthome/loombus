# Issue #666 Phase 1: Teen Age-State Foundation

Status: implementation draft
Prepared: July 27, 2026

## Purpose

This phase establishes the database-backed age-state contract required before Loombus can truthfully describe Teen Safety Mode as a product-enforced system.

It covers:

- minimum age 13
- canonical age bands: unknown, under_13, teen, adult
- server-authoritative age derivation from date of birth
- immutable initial age declaration outside an approved correction workflow
- private-account and non-discoverable defaults for ages 13–17
- future-Discussion audience default of followers for teen accounts
- preservation of privacy settings when a member turns 18
- authenticated age-correction requests
- underage-account reporting without public disclosure
- database-backed private-conversation eligibility
- data minimization and restricted access for age records

## Existing behavior preserved

Loombus already blocks under-13 use at the age gate, requires known age before private messages, requires mutual following before a private conversation can start, and stores date of birth in `profile_sensitive` rather than `profiles`.

This phase preserves those rules and moves the critical defaults and interaction boundary into the database so a client or alternate server route cannot silently bypass them.

## New production contracts

### Teen defaults

When `profile_sensitive.age_band = 'teen'`:

- `member_privacy_settings.private_account` is set to `true`
- `member_privacy_settings.discoverable` is set to `false`
- the teen safety settings row records `future_discussion_audience = 'followers'`
- unsolicited adult contact remains disallowed
- personalized recommendation and commerce-discovery eligibility default to disabled pending module-specific verification

### Turning 18

A scheduled age refresh may change `age_band` from `teen` to `adult` and disable `teen_safety_mode`, but it does not make the member public, discoverable, or broadly messageable. Existing privacy choices remain in place until the member changes them.

### Age correction

A member cannot silently replace a stored date of birth through the normal age gate. A correction request records only the member ID, requested date of birth, derived requested age band, reason, workflow state, and timestamps. No identity document or biometric estimate is collected by this phase.

### Underage-account reports

An authenticated member may report an account believed to belong to a child under 13. The report does not publicly expose the reporter or target and does not automatically change the target account.

### Messaging

The database function `can_start_private_conversation` is the canonical eligibility check for new one-to-one conversations. It requires known eligible age bands, no guardian-required state, no block in either direction, mutual following, and active account standing.

The existing mutual-follow rule means an adult cannot send an unsolicited private message to a teen. Existing conversations remain available for review and safety actions; this phase does not silently delete conversation history.

## Deliberate boundaries

This phase does not close Issue #666. Follow-on work remains for Search and recommendation filtering, Room controls when minors participate, commercial-module eligibility, notification deep-link verification, parent and guardian information, and production test accounts covering all named modules.

Tracked follow-on: #680.

## Deployment order

1. Deploy the application changes.
2. Apply `supabase/migrations/20260802100000_teen_age_state_foundation.sql`.
3. Verify the migration backfill summary.
4. Test initial age declaration for adult, teen, and under-13 dates.
5. Test age-correction request creation and duplicate-open-request rejection.
6. Test underage-account reporting.
7. Test adult-to-teen and teen-to-adult conversation creation with and without mutual following.
8. Confirm existing teen accounts are private and non-discoverable.
9. Run the age-refresh function against a controlled test member turning 18 and confirm privacy remains unchanged.

## Production completion gate

Phase 1 is complete only after the migration and tests pass. Issue #666 remains open until #680 and the full acceptance criteria are complete.
