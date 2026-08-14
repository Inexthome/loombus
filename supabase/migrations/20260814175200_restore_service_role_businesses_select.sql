-- Restore the least-privilege service-role read grant required by the
-- canonical Appointments runtime when verifying and hydrating businesses.
grant select on table public.businesses to service_role;
