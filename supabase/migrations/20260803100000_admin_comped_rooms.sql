-- Allow Rooms created by verified Loombus administrators to carry paid-plan
-- entitlements without creating or requiring a Stripe subscription.

begin;

alter table public.rooms
  add column if not exists admin_comped boolean not null default false;

comment on column public.rooms.admin_comped is
  'True when Loombus grants the Room plan directly to an administrator without Stripe billing.';

commit;
