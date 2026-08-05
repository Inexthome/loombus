-- Issue #668 Room ownership, shared data, and staged-deletion disposition.
-- This migration does not transfer ownership, change Room access, schedule or
-- finalize Room deletion, delete Storage objects, or enable a handler.

insert into public.account_deletion_resource_registry (
  resource_key, data_class, system_of_record, disposition, handler_key,
  execution_mode, sort_order, detail
) values (
  'rooms',
  'Rooms, organizations, membership, shared content, files, calendars, governance, billing references, and lifecycle records',
  'Supabase Database, Storage, Stripe, and Room lifecycle services',
  'staged_delete',
  'rooms',
  'manual_review',
  60,
  jsonb_build_object(
    'status', 'disposition_defined_handler_not_approved',
    'automatic_execution', false,
    'default_rule', 'A member account request must not directly delete a Room or inherit Room deletion from Supabase Auth cascades.',
    'ownership_decision', jsonb_build_object(
      'transfer_when', jsonb_build_array(
        'an approved eligible successor accepts ownership',
        'the Room has remaining members or an ongoing community, business, support, classroom, HOA, or organization purpose',
        'organization, governance, billing, retention, or evidence obligations require continuity'
      ),
      'staged_delete_when', 'No approved successor or continuing purpose remains and Room deletion is separately approved after billing, retention, evidence, and legal-hold review.',
      'block_when', jsonb_build_array(
        'a pending ownership transfer is unaccepted or expired',
        'Room or organization ownership is unresolved',
        'active billing or a billing-owner mismatch remains',
        'an active retention or legal hold exists',
        'moderation, support, dispute, or safety evidence remains unresolved'
      )
    ),
    'transfer_sequence', jsonb_build_array(
      'select the canonical transfer contract and verify the recipient is an active eligible adult Room member',
      'resolve Room and organization ownership plus Stripe customer and subscription responsibility',
      'require recipient acceptance and verify rooms.owner_id, rooms.created_by, organization ownership, and owner membership consistently changed',
      'cancel or resolve stale pending transfers',
      'explicitly revoke the departing member role and access only after transfer success is durable',
      'record structured transfer and access-revocation evidence on the account deletion disposition'
    ),
    'transfer_contract_gap', jsonb_build_array(
      'transfer_room_ownership blocks active paid billing and rewrites owner, creator, membership, and local Stripe references',
      'accept_room_ownership_transfer changes owner_id and membership roles but does not reconcile created_by, organization ownership, or billing references',
      'an accepted governance transfer leaves the former owner as an administrator until a separate access action occurs'
    ),
    'staged_deletion_sequence', jsonb_build_array(
      'use the Room lifecycle independently from the member account request',
      'archive and schedule the Room through its recovery state',
      'verify inactive billing, Room and organization retention, legal holds, and unresolved evidence',
      'build and reconcile the persisted Storage object manifest',
      'finalize only through the Room deletion job after the recovery period and every preflight passes',
      'record the completed Room deletion job as evidence before allowing the member request to advance'
    ),
    'auth_cascade_blockers', jsonb_build_array(
      'room_members membership',
      'room_posts and room_post_replies authored content',
      'room_events and Room module responses',
      'room_resources uploader attribution',
      'room_organizations ownership and organization membership',
      'room_ownership_transfers',
      'Room moderation reports and other shared participation records'
    ),
    'preserve_until_resolved', jsonb_build_array(
      'Room and organization rows', 'remaining member access',
      'shared Room content and thread relationships', 'governance and policy records',
      'moderation, audit, support, retention, and lifecycle evidence',
      'billing references', 'Storage metadata and objects'
    ),
    'separate_resources', jsonb_build_array(
      'Room Storage objects and public URLs', 'Stripe records and vendor copies',
      'search documents and caches', 'AI derivatives',
      'moderation and trust-and-safety evidence', 'backups and replicas',
      'Floor research rooms'
    ),
    'feature_flags', jsonb_build_object(
      'account_deletion', 'ACCOUNT_DELETION_DESTRUCTIVE_HANDLERS_ENABLED remains required for separately approved automatic handlers.',
      'room_permanent_deletion', 'ROOM_PERMANENT_DELETION_ENABLED remains independently required by the Room deletion worker.'
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
'Executable account-deletion inventory. Rooms remain manual-review only until ownership, access, billing, retention, evidence, Storage, and staged-deletion prerequisites are satisfied.';
