-- Issue #668 notification, email, and push delivery disposition.
-- This migration does not delete or rewrite notifications, preferences, device
-- tokens, email records, push records, queues, suppressions, provider copies,
-- logs, caches, backups, or replicas. It adds no provider API call or worker dispatch.

insert into public.account_deletion_resource_registry (
  resource_key, data_class, system_of_record, disposition, handler_key,
  execution_mode, sort_order, detail
) values (
  'notification_email_push_delivery',
  'In-app notifications, notification preferences, email delivery records, push tokens and delivery evidence, suppressions, queues, logs, caches, backups, replicas, and vendor copies',
  'Supabase Database, application runtime, email provider, Apple Push Notification service, Firebase Cloud Messaging, infrastructure logs, recipient inboxes, and member-controlled devices',
  'manual_review',
  'notification_email_push_delivery',
  'manual_review',
  110,
  jsonb_build_object(
    'status', 'disposition_defined_handler_not_approved',
    'automatic_execution', false,
    'covered_records', jsonb_build_array(
      'in-app notification rows and read state',
      'notification preferences and channel settings',
      'email requests, provider message identifiers, delivery events, bounces, complaints, and suppressions',
      'APNs device tokens, delivery responses, and invalid-token feedback',
      'FCM registration tokens, delivery responses, and invalid-token feedback',
      'retry queues, dead-letter state, scheduled delivery state, and idempotency records',
      'administrator broadcast and report-notification delivery evidence',
      'application, provider, security, and observability logs',
      'caches, exports, backups, replicas, recipient inboxes, and device copies'
    ),
    'required_distinctions', jsonb_build_array(
      'notification content versus delivery evidence',
      'recipient history versus sender, administrator, moderation, security, or support evidence',
      'channel preferences versus device registration tokens',
      'token invalidation versus historical provider-log retention',
      'suppression records versus ordinary delivery history',
      'first-party state versus provider and recipient-controlled copies'
    ),
    'required_sequence', jsonb_build_array(
      'resolve legal-hold, safety, fraud, dispute, billing, support, and administrator-accountability exceptions',
      'inventory every channel linked by account ID, email address, device identifier, provider message ID, or token',
      'disable future non-required delivery before historical mutation',
      'revoke or detach active device tokens only through an approved channel-specific contract',
      'preserve suppression entries where deletion would cause unlawful or unwanted redelivery',
      'preserve delivery evidence required for abuse investigation, security, dispute, compliance, or recipient continuity',
      'reconcile first-party state with provider logs, queues, exports, caches, backups, and replicas',
      'verify future sends no longer target deleted-account identifiers except for approved exceptions',
      'record unresolved provider copies and expected expiration in the exception report'
    ),
    'do_not_use_as_proof', jsonb_build_array(
      'deleting an in-app notification row',
      'clearing a badge or read state',
      'removing one APNs or FCM token',
      'receiving a provider success response',
      'disabling email or push preferences',
      'deleting a provider message from one dashboard view',
      'deleting first-party rows while logs, queues, backups, exports, or recipient copies remain'
    ),
    'exceptions', jsonb_build_array(
      'legal hold', 'safety and abuse investigation', 'fraud and security',
      'billing and dispute evidence', 'support continuity',
      'administrator accountability', 'recipient continuity',
      'suppression and consent compliance'
    ),
    'vendor_boundaries', jsonb_build_object(
      'email_provider', 'Retention, deletion controls, suppression behavior, logs, backups, exports, and subprocessors require provider-specific verification.',
      'apns', 'Token invalidation or delivery failure is not proof that Apple operational records, logs, or backups are deleted.',
      'fcm', 'Token invalidation or delivery failure is not proof that Google operational records, logs, or backups are deleted.',
      'infrastructure', 'Vercel, Supabase, observability, cache, backup, and replica behavior requires separate verification.',
      'recipient_copies', 'Loombus cannot delete messages already delivered to recipient inboxes, operating systems, or member-controlled devices.'
    ),
    'blockers', jsonb_build_array(
      'owning notification or delivery tables are not conclusively inventoried',
      'safety, fraud, billing, support, dispute, or legal-hold records remain open',
      'suppression-list treatment is unresolved',
      'recipient continuity requires retained evidence',
      'provider, infrastructure, cache, backup, or replica behavior is unverified',
      'future-send verification has not passed'
    ),
    'verification', jsonb_build_array(
      'query first-party records by account ID, email, device identifier, provider message ID, and token',
      'confirm active delivery targets are revoked or detached under an approved contract',
      'confirm future non-required sends no longer target deleted-account identifiers',
      'review provider dashboards, logs, queues, suppressions, exports, caches, backups, and replicas',
      'record retained exceptions, unresolved copies, owners, and expected expiration'
    ),
    'feature_flags', jsonb_build_object(
      'account_deletion', 'ACCOUNT_DELETION_DESTRUCTIVE_HANDLERS_ENABLED is unchanged and does not authorize notification, preference, token, email, push, queue, suppression, provider, log, cache, backup, or replica mutation.'
    )
  )
)
on conflict (resource_key) do update set
  data_class = excluded.data_class,
  system_of_record = excluded.system_of_record,
  disposition = excluded.disposition,
  handler_key = excluded.handler_key,
  execution_mode = excluded.execution_mode,
  enabled = true,
  sort_order = excluded.sort_order,
  detail = excluded.detail,
  updated_at = now();

comment on table public.account_deletion_resource_registry is
'Executable account-deletion inventory. Notification, email, and push delivery remains manual-review only until channel ownership, exceptions, suppressions, providers, logs, queues, caches, backups, replicas, recipient copies, and future-send verification are resolved.';
