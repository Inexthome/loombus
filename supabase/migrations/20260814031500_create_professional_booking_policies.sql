-- Premium Pro Professional Booking policy configuration foundation.
--
-- This table stores service-level booking/cancellation policy configuration
-- only. Public disclosure, requester acknowledgment, immutable request policy
-- snapshots, and late-cancellation classification are intentionally deferred
-- to the next controlled slice.
--
-- Access is API-only. Current subscription authorization and service ownership
-- are enforced by the provider-neutral server boundary before service-role
-- writes.

begin;

create table if not exists public.professional_booking_policies (
  service_id uuid primary key
    references public.business_appointment_services(id)
    on delete cascade,
  provider_id uuid not null
    references public.profiles(id)
    on delete cascade,
  policy_text text not null default '',
  cancellation_notice_hours integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint professional_booking_policy_text_length_check
    check (char_length(policy_text) <= 3000),
  constraint professional_booking_cancellation_notice_hours_check
    check (cancellation_notice_hours between 0 and 168)
);

create index if not exists professional_booking_policies_provider_idx
  on public.professional_booking_policies (provider_id, updated_at desc);

comment on table public.professional_booking_policies is
  'Premium Pro service-level Professional Booking policy configuration.';

comment on column public.professional_booking_policies.policy_text is
  'Provider-authored booking and cancellation policy text, maximum 3000 characters.';

comment on column public.professional_booking_policies.cancellation_notice_hours is
  'Preferred requester cancellation notice window in hours. Configuration alone never blocks cancellation.';

alter table public.professional_booking_policies
  enable row level security;

alter table public.professional_booking_policies
  force row level security;

revoke all
  on table public.professional_booking_policies
  from public, anon, authenticated;

grant select, insert, update, delete
  on table public.professional_booking_policies
  to service_role;

commit;
