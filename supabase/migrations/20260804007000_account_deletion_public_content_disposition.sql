-- Issue #668 public Discussions and Replies disposition.
-- This migration does not delete, rewrite, or anonymize content and does not
-- enable a destructive handler.

insert into public.account_deletion_resource_registry (
  resource_key, data_class, system_of_record, disposition, handler_key,
  execution_mode, sort_order, detail
) values (
  'public_discussions_and_replies',
  'Published Discussions and Replies',
  'Supabase Database',
  'manual_review',
  'public_discussions_and_replies',
  'manual_review',
  32,
  jsonb_build_object(
    'status', 'disposition_defined_handler_not_approved',
    'automatic_execution', false,
    'tables', jsonb_build_array('discussions', 'replies'),
    'preserve', jsonb_build_array(
      'authored content', 'stable content identifiers', 'thread relationships',
      'created and updated timestamps', 'existing soft-deletion state'
    ),
    'public_attribution', 'Removed through approved profile anonymization after all profile prerequisites clear; authored rows are not rewritten.',
    'soft_deleted_content', 'Preserved under existing restricted administrator access for moderation and audit context.',
    'prerequisites', jsonb_build_array(
      'profile anonymization approved and ready',
      'open reports and enforcement evidence reviewed',
      'legal-hold and dispute checks completed',
      'search and cache propagation behavior verified',
      'attachments, Storage objects, and AI derivatives dispositioned separately'
    ),
    'excludes', jsonb_build_array(
      'discussion_attachments', 'Storage objects', 'discussion_summaries',
      'AI prompts and outputs', 'discussion metrics', 'search documents',
      'caches', 'reports', 'moderation and enforcement evidence', 'vendor copies'
    )
  )
),
(
  'discussion_attachments_and_derivatives',
  'Discussion media, generated derivatives, metrics, and indexed copies',
  'Supabase Database, Storage, Search, AI, and external processors',
  'manual_review',
  'discussion_attachments_and_derivatives',
  'manual_review',
  33,
  jsonb_build_object(
    'automatic_execution', false,
    'resources', jsonb_build_array(
      'discussion_attachments', 'Storage objects', 'discussion_summaries',
      'AI prompts and outputs', 'discussion metrics', 'search documents',
      'caches', 'vendor copies'
    ),
    'gap', 'These resources have independent storage, index, vendor, evidence, or retention lifecycles and cannot inherit the public-content rule.',
    'prerequisites', jsonb_build_array(
      'Storage object ownership and deletion behavior verified',
      'reported-content and legal-hold exceptions approved',
      'search and cache propagation verified',
      'AI and vendor retention controls verified'
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
'Executable account-deletion inventory. Public content and its derivatives remain manual-review only until their recorded prerequisites are satisfied.';
