-- Loombus identity verification foundation
-- Date: 2026-06-01
--
-- Purpose:
-- - Add provider-agnostic verification metadata to public.profiles.
-- - Prepare for ID.me without storing raw ID images, selfies, biometric material, or full provider payloads.
-- - Keep application behavior unchanged until API/UI gates are added separately.

alter table public.profiles
  add column if not exists identity_verification_status text not null default 'unverified';

alter table public.profiles
  add column if not exists identity_verification_provider text;

alter table public.profiles
  add column if not exists identity_provider_subject text;

alter table public.profiles
  add column if not exists identity_verified_at timestamptz;

alter table public.profiles
  add column if not exists identity_verification_last_checked_at timestamptz;

alter table public.profiles
  add column if not exists legal_name_verified boolean not null default false;

alter table public.profiles
  add column if not exists identity_restriction_reason text;

alter table public.profiles
  drop constraint if exists profiles_identity_verification_status_check;

alter table public.profiles
  add constraint profiles_identity_verification_status_check
  check (
    identity_verification_status in (
      'unverified',
      'pending',
      'verified',
      'failed',
      'restricted'
    )
  );

alter table public.profiles
  drop constraint if exists profiles_identity_verification_provider_check;

alter table public.profiles
  add constraint profiles_identity_verification_provider_check
  check (
    identity_verification_provider is null
    or identity_verification_provider in (
      'manual',
      'idme'
    )
  );

alter table public.profiles
  drop constraint if exists profiles_identity_restriction_reason_length;

alter table public.profiles
  add constraint profiles_identity_restriction_reason_length
  check (
    identity_restriction_reason is null
    or char_length(identity_restriction_reason) <= 500
  );

create index if not exists profiles_identity_verification_status_idx
on public.profiles(identity_verification_status);

create index if not exists profiles_identity_verification_provider_idx
on public.profiles(identity_verification_provider);

create index if not exists profiles_identity_provider_subject_idx
on public.profiles(identity_provider_subject)
where identity_provider_subject is not null;

create index if not exists profiles_identity_verified_at_idx
on public.profiles(identity_verified_at)
where identity_verified_at is not null;

comment on column public.profiles.identity_verification_status is
'Provider-agnostic Loombus identity verification state: unverified, pending, verified, failed, or restricted.';

comment on column public.profiles.identity_verification_provider is
'Identity verification provider used for the current verification state. Expected values include manual or idme.';

comment on column public.profiles.identity_provider_subject is
'External provider subject/reference identifier. Do not store raw identity documents, selfies, biometric data, or full provider payloads here.';

comment on column public.profiles.identity_verified_at is
'Timestamp when Loombus accepted the user as identity verified.';

comment on column public.profiles.identity_verification_last_checked_at is
'Timestamp when Loombus last checked or refreshed the user identity verification state.';

comment on column public.profiles.legal_name_verified is
'True when the user legal name has been verified by an approved provider or admin process.';

comment on column public.profiles.identity_restriction_reason is
'Short admin/provider reason for failed or restricted identity verification. Do not store sensitive identity-document details.';
