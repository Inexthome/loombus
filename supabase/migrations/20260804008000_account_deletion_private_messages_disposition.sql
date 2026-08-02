-- Issue #668 private messages and attachments disposition.
-- This migration does not delete, rewrite, anonymize, or revoke access to any
-- message resource and does not enable a destructive handler.

insert into public.account_deletion_resource_registry (
  resource_key, data_class, system_of_record, disposition, handler_key,
  execution_mode, sort_order, detail
) values (
  'private_messages',
  'Private-message conversations, participants, and message content',
  'Supabase Database',
  'manual_review',
  'private_messages',
  'manual_review',
  50,
  jsonb_build_object(
    'status', 'disposition_defined_handler_not_approved',
    'automatic_execution', false,
    'tables', jsonb_build_array(
      'private_conversations', 'private_conversation_members', 'private_messages'
    ),
    'current_member_delete_behavior', 'Sets only the requesting conversation member deleted_at; it does not erase the shared conversation or moderation evidence.',
    'preserve', jsonb_build_array(
      'conversation container', 'remaining participant membership and access',
      'message bodies', 'stable message identifiers', 'thread relationships',
      'created and updated timestamps'
    ),
    'departing_member_access', 'Revoke only in the approved finalization sequence without removing the remaining participant membership or access.',
    'attribution', 'Remove through approved profile anonymization after Auth foreign keys, recipient continuity, reports, and legal-hold prerequisites clear; this phase does not rewrite message rows.',
    'unsafe_auth_cascades', jsonb_build_array(
      'private_conversation_members.user_id references auth.users(id) on delete cascade',
      'private_messages.sender_id references auth.users(id) on delete cascade'
    ),
    'prerequisites', jsonb_build_array(
      'replace unsafe Auth cascades with an approved attribution or tombstone strategy',
      'approve shared-message retention and recipient-continuity behavior',
      'review open reports, safety evidence, disputes, and legal holds',
      'approve profile anonymization and Auth deletion sequencing',
      'disposition attachments and Storage objects separately'
    ),
    'excludes', jsonb_build_array(
      'private_message_attachments', 'message-attachments Storage objects',
      'public attachment URLs', 'reports', 'trust-and-safety evidence',
      'audit records', 'vendor copies'
    )
  )
),
(
  'private_message_attachments_and_evidence',
  'Private-message attachment metadata, Storage objects, reports, and evidence',
  'Supabase Database, Storage, Trust and Safety, and external processors',
  'manual_review',
  'private_message_attachments_and_evidence',
  'manual_review',
  51,
  jsonb_build_object(
    'status', 'disposition_requires_storage_and_evidence_review',
    'automatic_execution', false,
    'resources', jsonb_build_array(
      'private_message_attachments', 'message-attachments Storage objects',
      'stored public_url values', 'message and conversation reports',
      'trust-and-safety evidence', 'vendor copies'
    ),
    'cascade_warning', 'Attachment metadata cascades from messages and conversations, but a database cascade is not proof that a Storage object or public URL was removed.',
    'storage_rule', 'Use a verified object manifest and record per-object deletion evidence; preserve excepted evidence under approved access and retention controls.',
    'prerequisites', jsonb_build_array(
      'verify message-attachments bucket visibility and access controls',
      'inventory every account-owned attachment object and public URL',
      'approve reported-content, safety-evidence, dispute, and legal-hold exceptions',
      'verify administrator evidence coverage for attachments',
      'verify Storage and vendor deletion behavior'
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
'Executable account-deletion inventory. Private messages, attachments, and evidence remain manual-review only until their recorded prerequisites are satisfied.';
