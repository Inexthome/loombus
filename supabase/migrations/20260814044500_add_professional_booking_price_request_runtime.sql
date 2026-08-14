-- Professional Booking 3B.8B requester quote runtime.
--
-- Stores the exact structured Professional Booking price shown to the requester
-- when a qualifying appointment request is sent. This is historical quote
-- metadata only. It does not create or authorize any payment.

begin;

alter table public.business_appointment_requests
  add column if not exists professional_booking_price_snapshot jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'business_appointment_requests_professional_booking_price_snapshot_check'
      and conrelid = 'public.business_appointment_requests'::regclass
  ) then
    alter table public.business_appointment_requests
      add constraint business_appointment_requests_professional_booking_price_snapshot_check
      check (
        professional_booking_price_snapshot is null
        or jsonb_typeof(professional_booking_price_snapshot) = 'object'
      );
  end if;
end;
$$;

comment on column public.business_appointment_requests.professional_booking_price_snapshot is
  'Immutable request-time Professional Booking structured-price quote shown to the requester. Historical metadata only; no payment or payout is created from this value.';

commit;
