-- Issue #674: separate disclosure preparation authority from export authority.
-- This migration does not enable either capability for any operator.

begin;

alter table public.legal_operations_authorizations
  add column if not exists can_prepare_disclosure boolean not null default false;

comment on column public.legal_operations_authorizations.can_prepare_disclosure is
'Allows restricted draft disclosure metadata and least-data manifest preparation only. Does not authorize export generation, disclosure approval, emergency approval, member notice sending, or external transmission.';

commit;
