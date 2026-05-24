-- Loombus account enforcement foundation
--
-- Purpose:
-- Add durable account-level moderation/enforcement fields to public.profiles.
-- This is schema foundation only. App/API enforcement guards should be added
-- after this SQL is applied and verified.
--
-- Account statuses:
-- - active: normal account state
-- - warned: warning recorded; account remains usable
-- - suspended: temporarily restricted until suspended_until
-- - banned: permanently restricted unless restored by admin

alter table public.profiles
  add column if not exists account_status text not null default 'active';

alter table public.profiles
  add column if not exists enforcement_reason text;

alter table public.profiles
  add column if not exists enforcement_note text;

alter table public.profiles
  add column if not exists enforced_by uuid references public.profiles(id) on delete set null;

alter table public.profiles
  add column if not exists enforced_at timestamptz;

alter table public.profiles
  add column if not exists suspended_until timestamptz;

alter table public.profiles
  drop constraint if exists profiles_account_status_check;

alter table public.profiles
  add constraint profiles_account_status_check
  check (account_status in ('active', 'warned', 'suspended', 'banned'));

alter table public.profiles
  drop constraint if exists profiles_enforcement_reason_length;

alter table public.profiles
  add constraint profiles_enforcement_reason_length
  check (enforcement_reason is null or char_length(trim(enforcement_reason)) <= 240);

alter table public.profiles
  drop constraint if exists profiles_enforcement_note_length;

alter table public.profiles
  add constraint profiles_enforcement_note_length
  check (enforcement_note is null or char_length(trim(enforcement_note)) <= 2000);

create index if not exists profiles_account_status_idx
on public.profiles(account_status);

create index if not exists profiles_suspended_until_idx
on public.profiles(suspended_until);

create index if not exists profiles_enforced_by_idx
on public.profiles(enforced_by);

create index if not exists profiles_enforced_at_idx
on public.profiles(enforced_at);

comment on column public.profiles.account_status is
'Account enforcement status: active, warned, suspended, or banned.';

comment on column public.profiles.enforcement_reason is
'Short admin-facing reason for the latest account enforcement action.';

comment on column public.profiles.enforcement_note is
'Optional admin note for account enforcement context.';

comment on column public.profiles.enforced_by is
'Admin profile that last changed account enforcement status.';

comment on column public.profiles.enforced_at is
'Timestamp of the latest account enforcement status change.';

comment on column public.profiles.suspended_until is
'Timestamp when a temporary suspension ends. Null for non-suspended or indefinite states.';
