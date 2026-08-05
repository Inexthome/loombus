-- Issue #668 AI prompts, outputs, derivatives, provenance, and provider-copy disposition.
-- This migration does not delete or rewrite AI data, call an AI provider deletion API,
-- mutate a source record, add an account-deletion worker dispatch, or enable a
-- destructive handler.

insert into public.account_deletion_resource_registry (
  resource_key, data_class, system_of_record, disposition, handler_key,
  execution_mode, sort_order, detail
) values (
  'ai_prompts_outputs_and_provider_copies',
  'AI prompts, grounded source payloads, generated outputs, summaries, analyses, ratings references, traces, provenance, and provider copies',
  'Supabase Database, application runtime, infrastructure logs, and AI providers',
  'manual_review',
  'ai_prompts_outputs_and_provider_copies',
  'manual_review',
  90,
  jsonb_build_object(
    'status', 'disposition_defined_handler_not_approved',
    'automatic_execution', false,
    'reviewed_first_party_examples', jsonb_build_array(
      jsonb_build_object(
        'resource', 'floor_thesis_analyses',
        'role', 'Stored AI red-team analysis linked to a Floor thesis.',
        'disposition_dependency', 'The parent thesis, public attribution, moderation, investment-research integrity, and provider-copy decisions must be resolved first.'
      ),
      jsonb_build_object(
        'resource', 'Research Desk generation provenance',
        'role', 'Administrator-only generation method, model, prompt version, generating administrator, and approving administrator evidence.',
        'disposition_dependency', 'Publication, audit, approval, safety, and institutional research-record requirements must be resolved first.'
      ),
      jsonb_build_object(
        'resource', 'discussion_summaries and other source-linked AI derivatives',
        'role', 'Derived outputs coupled to Discussions or other owning records.',
        'disposition_dependency', 'The owning source, recipient continuity, moderation evidence, Search, cache, and legal-hold decisions must be resolved first.'
      ),
      jsonb_build_object(
        'resource', 'ai_output_ratings',
        'role', 'Member-owned helpfulness metadata governed by the separately gated product-feedback deletion handler.',
        'disposition_dependency', 'Deleting a rating is not proof that the rated prompt, output, source payload, trace, or provider copy was deleted.'
      )
    ),
    'feature_paths_reviewed', jsonb_build_array(
      'Ask Loombus AI grounded Search responses',
      'Discussion summaries and analysis features',
      'Floor thesis red-team analysis through Anthropic',
      'Research Desk drafting through the OpenAI Responses API and web search',
      'moderation and safety model calls',
      'feature-specific AI output ratings'
    ),
    'required_sequence', jsonb_build_array(
      'identify the exact feature, member linkage, source records, stored prompt or output rows, logs, caches, and provider request identifiers',
      'complete the owning source and public-attribution disposition before changing a source-linked AI derivative',
      'preserve outputs or provenance required for moderation, safety, fraud, dispute, research approval, audit, recipient continuity, or legal hold',
      'decide delete, anonymize, retain, or detach for each first-party prompt, output, derivative, trace, and provenance record',
      'verify downstream Search, summaries, briefs, caches, logs, backups, replicas, and exports separately',
      'request provider-side deletion only through a verified provider contract or API and record provider evidence',
      'record before-and-after identifiers, verification queries, provider responses, unresolved copies, and exceptions on the account deletion disposition'
    ),
    'provider_boundary', jsonb_build_object(
      'providers_observed', jsonb_build_array('OpenAI', 'Anthropic'),
      'provider_retention_verified', false,
      'provider_deletion_api_verified', false,
      'training_and_abuse_monitoring_settings_verified', false,
      'gap', 'Production account settings, contractual terms, request logging, retention controls, deletion capabilities, and subprocessor behavior require separate read-only verification. Repository call sites are not proof of provider retention or deletion behavior.'
    ),
    'storage_inventory_boundary', jsonb_build_object(
      'canonical_platform_wide_prompt_table_found', false,
      'canonical_platform_wide_output_table_found', false,
      'canonical_platform_wide_trace_table_found', false,
      'meaning', 'AI persistence is feature-specific. Absence of one canonical table is not proof that prompts, outputs, traces, logs, or provider copies are not retained.'
    ),
    'do_not_use_as_proof', jsonb_build_array(
      'deleting an ai_output_ratings row as proof that the rated output or provider copy was deleted',
      'deleting or anonymizing an owning source without verifying its AI derivatives',
      'deleting a first-party AI row as proof that application logs, provider logs, caches, backups, replicas, or web-search provider copies expired',
      'receiving a successful provider API response without verifying the exact request, object, project, and retention scope',
      'removing member access as proof of data deletion'
    ),
    'separate_resources', jsonb_build_array(
      'owning Discussions, Replies, Floor theses, Research Desk reports, Search documents, and other source records',
      'member product-feedback ratings',
      'moderation, enforcement, safety, fraud, dispute, support, and legal-hold evidence',
      'web-search queries and retrieved source payloads',
      'application and CDN caches',
      'Vercel, Supabase, and provider logs',
      'security, analytics, cost, and incident telemetry',
      'backups and replicas',
      'exports and administrator evidence',
      'external provider and subprocessor copies'
    ),
    'blockers', jsonb_build_array(
      'the owning source disposition is unresolved',
      'public attribution, Auth sequencing, or recipient continuity is unresolved',
      'moderation, safety, fraud, dispute, research approval, audit, security, or legal-hold evidence remains open',
      'first-party prompt, output, trace, provenance, or cache inventory is incomplete',
      'provider retention, deletion, logging, training, abuse-monitoring, backup, or subprocessor behavior remains unverified'
    ),
    'feature_flags', jsonb_build_object(
      'account_deletion', 'ACCOUNT_DELETION_DESTRUCTIVE_HANDLERS_ENABLED is unchanged and does not authorize AI mutation or provider deletion.'
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
'Executable account-deletion inventory. AI remains manual-review only until source, first-party storage, safety, audit, provider, log, cache, backup, and verification prerequisites are satisfied.';
