-- Premium Pro Professional Booking policy request runtime.
--
-- Stores the exact booking/cancellation policy acknowledged when a qualifying
-- appointment request is sent, plus non-blocking requester cancellation timing
-- metadata for accepted appointments. Existing ordinary Appointments remain
-- null in both fields.

begin;

alter table public.business_appointment_requests
  add column if not exists professional_booking_policy_snapshot jsonb,
  add column if not exists professional_booking_requester_cancellation_timing text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'business_appointment_requests_professional_policy_snapshot_object_check'
      and conrelid = 'public.business_appointment_requests'::regclass
  ) then
    alter table public.business_appointment_requests
      add constraint business_appointment_requests_professional_policy_snapshot_object_check
      check (
        professional_booking_policy_snapshot is null
        or jsonb_typeof(professional_booking_policy_snapshot) = 'object'
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'business_appointment_requests_professional_cancellation_timing_check'
      and conrelid = 'public.business_appointment_requests'::regclass
  ) then
    alter table public.business_appointment_requests
      add constraint business_appointment_requests_professional_cancellation_timing_check
      check (
        professional_booking_requester_cancellation_timing is null
        or professional_booking_requester_cancellation_timing in ('on_time', 'late')
      );
  end if;
end;
$$;

comment on column public.business_appointment_requests.professional_booking_policy_snapshot is
  'Immutable-at-request-time Premium Pro booking/cancellation policy snapshot acknowledged by the requester; null for ordinary Appointments.';

comment on column public.business_appointment_requests.professional_booking_requester_cancellation_timing is
  'Non-blocking on_time/late classification for requester cancellation of an accepted appointment using the saved policy snapshot; null when not applicable.';

commit;
