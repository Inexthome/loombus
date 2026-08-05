# Notification, Email, and Push Account-Deletion Disposition

## Status

Disposition is defined for Issue #668. Automatic mutation is not approved.

Account deletion must not be treated as proof that every in-app notification, email delivery record, push delivery record, device token, suppression entry, provider log, retry queue, cache, backup, or recipient-controlled copy has been deleted.

## Resource boundary

This resource covers:

- in-app notification rows and read state
- notification preferences and channel settings
- email delivery requests, templates, provider message identifiers, delivery events, bounces, complaints, and suppression state
- APNs device tokens, delivery responses, invalid-token feedback, and Apple-held operational copies
- FCM registration tokens, delivery responses, invalid-token feedback, and Google-held operational copies
- retry queues, dead-letter state, scheduled delivery state, and idempotency records
- administrator broadcast and report-notification delivery evidence
- application, provider, security, and observability logs containing recipient or device identifiers
- caches, exports, backups, replicas, and vendor copies

## Systems of record

The repository does not establish one canonical notification table that proves disposition across every channel. Relevant systems may include Supabase Database, application runtime, Resend or another email provider, Apple Push Notification service, Firebase Cloud Messaging, Vercel logs, Supabase logs, device operating systems, recipient inboxes, and member-controlled devices.

## Required distinctions

Account deletion review must distinguish:

1. Notification content from delivery evidence.
2. Recipient-facing history from sender, administrator, moderation, or security evidence.
3. Channel preferences from device registration tokens.
4. Token invalidation from deletion of historical provider logs.
5. Email suppression records from ordinary marketing or product-message history.
6. First-party database state from provider dashboards, logs, queues, backups, and recipient-controlled copies.

## Required sequence

Before any terminal disposition is approved:

1. Resolve legal hold, safety, fraud, dispute, billing, support, and administrator-accountability exceptions.
2. Inventory every notification, email, and push system linked to the member by account ID, email address, device identifier, provider message ID, or token.
3. Disable future non-required delivery before mutating historical records.
4. Revoke or detach active device tokens only through an approved channel-specific contract.
5. Preserve suppression entries where deletion would cause unlawful or unwanted redelivery.
6. Preserve delivery evidence required for abuse investigation, security, dispute, compliance, or recipient continuity.
7. Reconcile first-party state with provider-side logs, queues, exports, caches, backups, and replicas.
8. Verify future sends no longer target deleted-account identifiers except where an approved legal or operational exception applies.
9. Record unresolved provider copies and expected expiration behavior in the account-deletion exception report.

## Do not use as proof

The following are not sufficient proof of deletion:

- deleting an in-app notification row
- clearing a notification badge or read state
- removing one APNs or FCM token
- receiving a provider success response
- disabling email or push preferences
- deleting a provider message from one dashboard view
- deleting first-party rows while logs, queues, backups, exports, or recipient copies remain

## Manual-review blockers

Automatic execution remains blocked when:

- the owning notification or delivery table is not conclusively identified
- the member has unresolved safety, fraud, billing, support, dispute, or legal-hold records
- suppression-list treatment is unresolved
- recipient continuity requires retained delivery evidence
- APNs, FCM, email-provider, Vercel, Supabase, backup, cache, or replica behavior is unverified
- no verification test proves future sends no longer target the deleted account

## Safety boundary

This disposition adds no deletion, anonymization, detachment, token revocation, preference mutation, provider API call, queue purge, cache purge, or worker dispatch. `ACCOUNT_DELETION_DESTRUCTIVE_HANDLERS_ENABLED` remains unchanged.