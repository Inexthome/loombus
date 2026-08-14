begin;

revoke all privileges
on table public.member_payout_accounts
from public, anon, authenticated, service_role;

revoke all privileges
on table public.professional_booking_intake_forms
from public, anon, authenticated, service_role;

revoke all privileges
on table public.professional_booking_policies
from public, anon, authenticated, service_role;

revoke all privileges
on table public.professional_booking_service_pricing
from public, anon, authenticated, service_role;

revoke all privileges
on table public.professional_booking_payment_provider_terms
from public, anon, authenticated, service_role;

revoke all privileges
on table public.professional_booking_payments
from public, anon, authenticated, service_role;

revoke all privileges
on table public.professional_booking_payment_attempts
from public, anon, authenticated, service_role;

grant select, insert, update, delete
on table public.member_payout_accounts
to service_role;

grant select, insert, update, delete
on table public.professional_booking_intake_forms
to service_role;

grant select, insert, update, delete
on table public.professional_booking_policies
to service_role;

grant select, insert, update, delete
on table public.professional_booking_service_pricing
to service_role;

grant select, insert
on table public.professional_booking_payment_provider_terms
to service_role;

grant select, insert, update, delete
on table public.professional_booking_payments
to service_role;

grant select, insert, update, delete
on table public.professional_booking_payment_attempts
to service_role;

commit;
