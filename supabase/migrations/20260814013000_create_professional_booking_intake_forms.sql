-- Premium Pro Professional Booking client-intake configuration foundation.
--
-- This table stores service-level intake questions only. Public requester
-- rendering and intake-response capture are intentionally deferred to the
-- next controlled slice.
--
-- Access is API-only. Current subscription authorization and service ownership
-- are enforced by the provider-neutral server boundary before service-role
-- writes.

begin;

create table if not exists public.professional_booking_intake_forms (
  service_id uuid primary key
    references public.business_appointment_services(id)
    on delete cascade,
  provider_id uuid not null
    references public.profiles(id)
    on delete cascade,
  questions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint professional_booking_intake_questions_array_check
    check (jsonb_typeof(questions) = 'array')
);

create index if not exists professional_booking_intake_forms_provider_idx
  on public.professional_booking_intake_forms (provider_id, updated_at desc);

comment on table public.professional_booking_intake_forms is
  'Premium Pro service-level Professional Booking client-intake question configuration.';

comment on column public.professional_booking_intake_forms.questions is
  'Validated array of intake questions: id, label, required.';

alter table public.professional_booking_intake_forms
  enable row level security;

alter table public.professional_booking_intake_forms
  force row level security;

revoke all
  on table public.professional_booking_intake_forms
  from public, anon, authenticated;

grant select, insert, update, delete
  on table public.professional_booking_intake_forms
  to service_role;

commit;
