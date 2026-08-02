-- Issue #668 profile disposition map.
-- This migration does not anonymize a profile or enable a destructive handler.

insert into public.account_deletion_resource_registry (
  resource_key, data_class, system_of_record, disposition, handler_key,
  execution_mode, sort_order, detail
) values (
  'profile_and_preferences',
  'Public profile identity and presentation fields',
  'Supabase Database',
  'anonymize',
  'profile_data',
  'manual_review',
  30,
  jsonb_build_object(
    'status', 'field_map_defined_handler_not_approved',
    'automatic_execution', false,
    'anonymize_fields', jsonb_build_array(
      'username', 'full_name', 'bio', 'avatar_url', 'perspective_marker',
      'creator_website_url', 'creator_support_url', 'creator_support_label',
      'local_city', 'local_region', 'local_postal_code', 'local_country_code',
      'local_mode', 'local_location_text', 'local_business_id',
      'local_remote_available', 'local_remote_only', 'local_starts_at',
      'local_ends_at', 'local_price_text', 'local_attribution', 'local_image_url'
    ),
    'preserve_until_prerequisites_clear', jsonb_build_array(
      'id', 'account_status', 'is_admin', 'enforcement_reason',
      'enforcement_note', 'enforced_by', 'enforced_at', 'suspended_until',
      'identity_verification_status', 'identity_verification_provider',
      'identity_provider_subject', 'identity_verified_at',
      'identity_verification_last_checked_at', 'legal_name_verified',
      'identity_restriction_reason'
    ),
    'prerequisites', jsonb_build_array(
      'Room and organization ownership transferred or resolved',
      'commerce and local ownership or attribution resolved',
      'administrator role safely transferred or removed',
      'trust-and-safety and legal-hold review completed',
      'profile avatar and local image Storage objects inventoried',
      'search and cache propagation behavior verified',
      'Supabase Auth and minimum tombstone decision approved'
    ),
    'excludes', jsonb_build_array(
      'profile_sensitive', 'Supabase Auth metadata', 'Storage objects',
      'search indexes and caches', 'public content', 'Rooms',
      'commerce records', 'moderation evidence', 'vendor copies'
    )
  )
),
(
  'profile_sensitive_safety',
  'Protected age-safety and sensitive profile state',
  'Supabase Database',
  'manual_review',
  'profile_sensitive_safety',
  'manual_review',
  31,
  jsonb_build_object(
    'automatic_execution', false,
    'tables', jsonb_build_array('profile_sensitive'),
    'fields', jsonb_build_array(
      'date_of_birth', 'age_band', 'teen_safety_mode', 'guardian_required'
    ),
    'gap', 'Retention and deletion rules require trust-and-safety, legal-hold, and age-correction evidence review.',
    'prerequisites', jsonb_build_array(
      'underage-account reports reviewed',
      'open age-correction requests resolved',
      'minimum safety evidence and retention period approved',
      'Supabase Auth deletion sequence approved'
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
'Executable account-deletion inventory. Profile resources remain manual-review only until their recorded prerequisites are satisfied.';
