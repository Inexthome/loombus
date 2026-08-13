-- Premium Pro Professional Booking structured availability foundation.
--
-- This table stores provider-level Professional Booking preferences only.
-- It does not alter ordinary Appointment creation, requesting, acceptance,
-- rescheduling, cancellation, or existing appointment conflict checks.
--
-- Access is intentionally API-only. Subscription authorization is enforced
-- by the provider-neutral server boundary before service-role writes.

begin;

create table if not exists public.professional_booking_settings (
  provider_id uuid primary key
    references public.profiles(id)
    on delete cascade,
  timezone text not null default 'UTC',
  weekly_availability jsonb not null default '[]'::jsonb,
  minimum_notice_minutes integer not null default 60,
  maximum_advance_days integer not null default 60,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint professional_booking_timezone_check
    check (char_length(timezone) between 1 and 100),

  constraint professional_booking_weekly_availability_array_check
    check (jsonb_typeof(weekly_availability) = 'array'),

  constraint professional_booking_minimum_notice_check
    check (minimum_notice_minutes between 0 and 43200),

  constraint professional_booking_maximum_advance_check
    check (maximum_advance_days between 1 and 365)
);

comment on table public.professional_booking_settings is
  'Premium Pro provider-level structured Professional Booking availability preferences.';

comment on column public.professional_booking_settings.weekly_availability is
  'Validated array of recurring windows: dayOfWeek, startMinute, endMinute.';

alter table public.professional_booking_settings
  enable row level security;

alter table public.professional_booking_settings
  force row level security;

revoke all
  on table public.professional_booking_settings
  from public, anon, authenticated;

grant select, insert, update, delete
  on table public.professional_booking_settings
  to service_role;

commit;
