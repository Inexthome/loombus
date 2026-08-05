-- Issue #668 Trust and Safety records disposition.
-- This migration does not delete or rewrite reports, cases, evidence, decisions,
-- appeals, notes, support records, Storage objects, or provider copies. It does
-- not add an account-deletion worker dispatch or enable a destructive handler.

insert into public.account_deletion_resource_registry (
  resource_key, data_class, system_of_record, disposition, handler_key,
  execution_mode, sort_order, detail
) values (
  'trust_safety_reports_enforcement_support',
  'Trust and Safety reports, cases, moderation evidence, enforcement decisions, appeals, safety notes, support escalations, legal holds, and audit history',
  'Supabase Database and Storage, application and infrastructure logs, notification and email providers, support systems, backups, replicas, caches, exports, and subprocessors',
  'manual_review',
  'trust_safety_reports_enforcement_support',
  'manual_review',
  100,
  jsonb_build_object(
    'status', 'disposition_defined_handler_not_approved',
    'automatic_execution', false,
    'core_rule', 'Account deletion is not evidence deletion. Trust and Safety records may contain multiple parties and may be required for investigation, appeals, enforcement consistency, severe-harm response, fraud prevention, administrator accountability, disputes, or legal obligations.',
    'record_families', jsonb_build_array(
      'trust and safety cases and moderation queues',
      'content, account, Room, commerce, age-safety, and underage reports',
      'moderation and safety-model review results',
      'enforcement decisions, restrictions, suspensions, bans, removals, and reasons',
      'appeals and administrator review actions',
      'safety notes, investigation notes, evidence references, and audit history',
      'support cases and escalations that become safety, fraud, billing, or legal evidence',
      'notification and email delivery records proving submission or outcome delivery',
      'Storage objects, exports, logs, and external attachments used as evidence'
    ),
    'member_roles', jsonb_build_array(
      'reporter', 'subject', 'witness', 'victim', 'recipient',
      'Room owner or moderator', 'administrator', 'support requester'
    ),
    'required_sequence', jsonb_build_array(
      'inventory every applicable case, report, note, decision, appeal, evidence object, support record, delivery record, export, log, and vendor copy linked to the member',
      'classify the member role in each record before deciding attribution or retention',
      'check open investigations, unresolved appeals, active restrictions, repeat-abuse links, severe-harm matters, fraud or payment disputes, legal requests, emergency reviews, and legal holds',
      'preserve the minimum record required for case integrity, recipient continuity, administrator accountability, enforcement consistency, fraud prevention, and legal obligations',
      'consider minimization only after closure, appeal and dispute windows, hold review, and downstream-copy inventory are complete',
      'handle public or member-visible attribution independently from restricted internal evidence',
      'verify Storage, notifications, email, logs, exports, caches, backups, replicas, and vendors separately',
      'record reviewer, basis, identifiers, exceptions, verification evidence, unresolved copies, and accountable owners in the account-deletion exception report'
    ),
    'preservation_exceptions', jsonb_build_array(
      'legal hold, litigation, law-enforcement request, regulatory inquiry, or emergency disclosure review',
      'child safety, sexual exploitation, credible threats, self-harm escalation, non-consensual intimate imagery, doxxing, or other severe-harm evidence',
      'fraud, spam, coordinated manipulation, account evasion, payment dispute, or security investigation',
      'pending or recently completed appeal, complaint, support escalation, or administrator review',
      'active suspension, ban, restriction, Room action, commerce action, or repeat-offender linkage',
      'records needed to protect reporters, victims, minors, witnesses, recipients, moderators, or administrators'
    ),
    'prohibited_shortcuts', jsonb_build_array(
      'treating account closure as authority to delete evidence',
      'treating a closed case as automatically eligible for immediate deletion',
      'removing public attribution and assuming restricted evidence was also handled',
      'deleting a database row without verifying linked Storage, notifications, email, logs, exports, caches, backups, replicas, and vendors',
      'breaking appeal, enforcement, legal-hold, fraud, severe-harm, or repeat-abuse relationships',
      'exposing reporter, victim, minor, witness, recipient, moderator, or administrator identities through minimization'
    ),
    'possible_future_actions', jsonb_build_array(
      'restrict access to approved roles',
      'pseudonymize subject references where case integrity permits',
      'redact unnecessary contact data under a case-specific rule',
      'expire duplicate operational copies after verified system-of-record preservation',
      'retain immutable decision and evidence lineage where required'
    ),
    'unresolved', jsonb_build_array(
      'case-family retention periods and appeal windows',
      'production table, field, bucket, export, and vendor coverage',
      'Storage and evidence-object lifecycle',
      'support-system, notification, email, application-log, and infrastructure-log retention',
      'backup, replica, cache, and vendor expiration',
      'legal and regulatory requirements by record family and jurisdiction',
      'quarterly owner, approval authority, and verification query set'
    ),
    'verification_requirements', jsonb_build_array(
      'prove every applicable case family and member role was inventoried',
      'prove open cases, appeals, restrictions, holds, severe-harm, fraud, and dispute exceptions were checked',
      'prove public attribution and restricted evidence were handled independently',
      'prove preserved evidence objects and delivery records remain linked and access-restricted',
      'prove Storage, logs, exports, backups, replicas, caches, and vendors were separately reviewed',
      'list every preserved or unresolved copy and accountable owner in the exception report'
    ),
    'public_disclosure_boundary', 'Privacy, Retention, Reporting, Enforcement, Appeals, Teen Safety, and Support documents must not publish a Trust and Safety deletion timeline until case-family schedules and vendor behavior are approved and verified.',
    'feature_flags', jsonb_build_object(
      'account_deletion', 'ACCOUNT_DELETION_DESTRUCTIVE_HANDLERS_ENABLED is unchanged and does not authorize case, report, evidence, appeal, enforcement, support, Storage, or provider mutation.'
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
'Executable account-deletion inventory. Trust and Safety records remain manual-review only until case-family retention, evidence, appeals, legal holds, Storage, support, logging, backup, vendor, access, and verification prerequisites are approved.';