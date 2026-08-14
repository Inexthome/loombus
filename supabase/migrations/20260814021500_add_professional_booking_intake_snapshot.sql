-- Premium Pro Professional Booking client-intake request snapshots.
--
-- The configured form remains provider-owned in professional_booking_intake_forms.
-- This nullable column stores the exact validated question/answer snapshot that
-- accompanied an appointment request while Professional Booking intake was
-- active. Existing and ordinary Free Appointment requests remain null.

begin;

alter table public.business_appointment_requests
  add column if not exists professional_booking_intake_snapshot jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'business_appointment_requests_professional_intake_array_check'
      and conrelid = 'public.business_appointment_requests'::regclass
  ) then
    alter table public.business_appointment_requests
      add constraint business_appointment_requests_professional_intake_array_check
      check (
        professional_booking_intake_snapshot is null
        or jsonb_typeof(professional_booking_intake_snapshot) = 'array'
      );
  end if;
end;
$$;

comment on column public.business_appointment_requests.professional_booking_intake_snapshot is
  'Immutable-at-request-time Premium Pro client-intake question/required/answer snapshot; null for ordinary Appointments.';

commit;
