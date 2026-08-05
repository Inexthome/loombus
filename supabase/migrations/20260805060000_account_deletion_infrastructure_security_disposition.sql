-- Issue #668: infrastructure, security, fraud, access, and incident disposition.
--
-- This migration is disposition-only. It does not delete, rewrite, anonymize,
-- detach, archive, or hide logs, incidents, access records, fraud signals,
-- sessions, credentials, caches, backups, replicas, exports, or vendor copies.
-- It adds no provider API call and no account-deletion worker dispatch.

begin;

insert into public.account_deletion_resource_registry (
  resource_key,
  data_class,
  system_of_record,
  disposition,
  handler_key,
  execution_mode,
  sort_order,
  detail
)
values (
  'infrastructure_security_and_incident_records',
  'Infrastructure, security, fraud, access, abuse-prevention, incident, diagnostic, queue, cache, backup, replica, export, and vendor-copy records',
  'Supabase, Vercel, application runtime, observability, security, fraud, incident-management, support, queue, backup, and infrastructure providers',
  'manual_review',
  'infrastructure_security_and_incident_records',
  'manual_review',
  120,
  jsonb_build_object(
    'issue', 668,
    'phase', 'infrastructure_security_disposition',
    'systems_of_record', jsonb_build_array(
      'Supabase database and audit records',
      'Supabase Auth, API, database, Storage, Realtime, and platform logs',
      'Vercel request, function, build, deployment, edge, firewall, and runtime logs',
      'application diagnostics, tracing, performance, and operational telemetry',
      'administrator and privileged-action audit history',
      'security, fraud, abuse-prevention, and incident-management systems',
      'queues, schedulers, retries, dead-letter records, and idempotency state',
      'exports, caches, backups, replicas, and vendor copies'
    ),
    'record_classes', jsonb_build_array(
      'sign-in, session, IP, user-agent, device, and authentication-risk evidence',
      'rate-limit, spam, bot, scraping, credential-stuffing, and fraud indicators',
      'administrator access, impersonation, moderation, and configuration history',
      'security alerts, incident cases, investigation notes, containment, and remediation evidence',
      'runtime errors, diagnostics, traces, request logs, deployment logs, and operational telemetry',
      'webhook, queue, retry, dead-letter, scheduled-job, and idempotency records',
      'forensic snapshots, legal holds, audit exports, caches, backups, replicas, and vendor copies'
    ),
    'disposition_rules', jsonb_build_array(
      'account deletion is not log deletion, incident closure, fraud clearance, or audit-history removal',
      'future access revocation is separate from historical security evidence',
      'preserve event integrity, timestamps, actor relationships, evidence chains, and administrator accountability',
      'apply role-aware review where records involve other users, recipients, Rooms, administrators, incidents, transactions, reports, or legal matters',
      'do not claim immediate vendor or backup deletion without verified provider evidence',
      'require an exception report for retained records, legal holds, vendor copies, backup expiry, and verification results'
    ),
    'exceptions', jsonb_build_array(
      'active or suspected security incidents',
      'fraud, spam, abuse, bots, scraping, credential attacks, or account compromise',
      'billing disputes, chargebacks, refunds, or account takeover',
      'Trust and Safety investigations, appeals, severe-harm cases, or law-enforcement requests',
      'legal holds, preservation duties, litigation, regulation, or insurance matters',
      'administrator accountability and privileged-access history',
      'outage, reliability, debugging, and data-integrity investigations',
      'suppression, rate-limiting, credential-abuse prevention, and repeat-offender detection'
    ),
    'verification_required', jsonb_build_array(
      'complete production log, telemetry, incident, and vendor inventory',
      'direct and indirect identifier mapping',
      'normal retention and backup-expiration periods',
      'access roles and administrator permissions',
      'pseudonymization or detachment feasibility without breaking forensic integrity',
      'vendor deletion, export, immutable-audit, regional-storage, and subprocessor behavior',
      'first-party verification queries and exception-report output',
      'evidence that future access is revoked while historical evidence is handled under the approved contract'
    ),
    'blocked_actions', jsonb_build_array(
      'delete or rewrite logs, incidents, fraud signals, access history, or administrator evidence',
      'revoke sessions or mutate credentials through this resource',
      'purge caches, backups, replicas, exports, queues, or vendor copies',
      'call Vercel, Supabase, observability, support, or other provider deletion APIs',
      'dispatch an account-deletion worker handler',
      'change ACCOUNT_DELETION_DESTRUCTIVE_HANDLERS_ENABLED'
    ),
    'safety', jsonb_build_object(
      'mutation_added', false,
      'provider_api_call_added', false,
      'worker_dispatch_added', false,
      'destructive_flag_changed', false
    ),
    'notes', jsonb_build_array(
      'The production inventory and provider retention controls remain unverified.',
      'ACCOUNT_DELETION_DESTRUCTIVE_HANDLERS_ENABLED is unchanged and does not authorize log, incident, fraud, access, session, credential, provider, cache, backup, replica, export, or queue mutation.'
    )
  )
)
on conflict (resource_key) do update
set
  data_class = excluded.data_class,
  system_of_record = excluded.system_of_record,
  disposition = excluded.disposition,
  handler_key = excluded.handler_key,
  execution_mode = excluded.execution_mode,
  enabled = true,
  sort_order = excluded.sort_order,
  detail = excluded.detail,
  updated_at = now();

commit;
