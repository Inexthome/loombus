-- Professional Booking 3B.8C shared Stripe Connect payout identity foundation.
--
-- Establishes one canonical Stripe Express payout identity per Loombus member.
-- Existing Creator Supporter payout identities are adopted without changing
-- Creator Supporter pricing, terms, checkout, subscriptions, transfers, or
-- payout behavior. This migration creates no payment, transfer, payout, fee,
-- tax calculation, refund, dispute, or appointment payment obligation.

begin;

create table if not exists public.member_payout_accounts (
  member_id uuid primary key references auth.users(id) on delete cascade,
  stripe_account_id text not null unique,
  account_type text not null default 'express',
  country text,
  default_currency text,
  details_submitted boolean not null default false,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  requirements_due text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_payout_accounts_type_check
    check (account_type = 'express')
);

alter table public.member_payout_accounts enable row level security;
alter table public.member_payout_accounts force row level security;

revoke all on table public.member_payout_accounts
  from public, anon, authenticated;

grant select, insert, update, delete
  on table public.member_payout_accounts
  to service_role;

comment on table public.member_payout_accounts is
  'Canonical Loombus Stripe Connect Express payout identity. One member and one Stripe account per row. Identity only; product-specific fees, terms, checkout, transfers, and payout contracts remain separate.';

comment on column public.member_payout_accounts.member_id is
  'Loombus member who owns this canonical Stripe Connect payout identity.';

comment on column public.member_payout_accounts.stripe_account_id is
  'Canonical Stripe Connect Express account id. Unique across Loombus members.';

-- Fail closed if this migration is ever replayed against a partially-created
-- canonical table whose identity disagrees with the deployed Creator Supporter
-- payout mapping. Never silently replace one member's Stripe account with
-- another account or reassign one Stripe account to another member.
do $$
begin
  if exists (
    select 1
    from public.creator_payout_accounts creator
    join public.member_payout_accounts member
      on member.member_id = creator.creator_id
    where member.stripe_account_id <> creator.stripe_account_id
  ) then
    raise exception 'Creator payout identity conflicts with canonical member payout identity';
  end if;

  if exists (
    select 1
    from public.creator_payout_accounts creator
    join public.member_payout_accounts member
      on member.stripe_account_id = creator.stripe_account_id
    where member.member_id <> creator.creator_id
  ) then
    raise exception 'Stripe payout account is assigned to conflicting Loombus members';
  end if;
end;
$$;

-- Adopt every existing Creator Supporter payout identity into the canonical
-- shared identity without mutating or removing the legacy product table.
insert into public.member_payout_accounts (
  member_id,
  stripe_account_id,
  account_type,
  country,
  default_currency,
  details_submitted,
  charges_enabled,
  payouts_enabled,
  requirements_due,
  created_at,
  updated_at
)
select
  creator_id,
  stripe_account_id,
  account_type,
  country,
  default_currency,
  details_submitted,
  charges_enabled,
  payouts_enabled,
  requirements_due,
  created_at,
  updated_at
from public.creator_payout_accounts
on conflict (member_id) do update
set
  account_type = excluded.account_type,
  country = excluded.country,
  default_currency = excluded.default_currency,
  details_submitted = excluded.details_submitted,
  charges_enabled = excluded.charges_enabled,
  payouts_enabled = excluded.payouts_enabled,
  requirements_due = excluded.requirements_due,
  updated_at = excluded.updated_at;

-- Keep the deployed Creator Supporter payout table compatible while the
-- canonical identity is introduced. Inserts and status updates mirror into
-- member_payout_accounts. A conflicting second Stripe account for the same
-- member or reuse of one Stripe account by another member fails closed.
create or replace function public.sync_creator_payout_to_member_payout()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.member_payout_accounts
    where member_id = new.creator_id
      and stripe_account_id <> new.stripe_account_id
  ) then
    raise exception 'Canonical payout identity conflict for member %', new.creator_id;
  end if;

  if exists (
    select 1
    from public.member_payout_accounts
    where stripe_account_id = new.stripe_account_id
      and member_id <> new.creator_id
  ) then
    raise exception 'Stripe payout account % is already assigned to another Loombus member', new.stripe_account_id;
  end if;

  insert into public.member_payout_accounts (
    member_id,
    stripe_account_id,
    account_type,
    country,
    default_currency,
    details_submitted,
    charges_enabled,
    payouts_enabled,
    requirements_due,
    created_at,
    updated_at
  ) values (
    new.creator_id,
    new.stripe_account_id,
    new.account_type,
    new.country,
    new.default_currency,
    new.details_submitted,
    new.charges_enabled,
    new.payouts_enabled,
    new.requirements_due,
    coalesce(new.created_at, now()),
    coalesce(new.updated_at, now())
  )
  on conflict (member_id) do update
  set
    account_type = excluded.account_type,
    country = excluded.country,
    default_currency = excluded.default_currency,
    details_submitted = excluded.details_submitted,
    charges_enabled = excluded.charges_enabled,
    payouts_enabled = excluded.payouts_enabled,
    requirements_due = excluded.requirements_due,
    updated_at = excluded.updated_at;

  return new;
end;
$$;

revoke all on function public.sync_creator_payout_to_member_payout() from public;

drop trigger if exists creator_payout_accounts_sync_member_identity
  on public.creator_payout_accounts;

create trigger creator_payout_accounts_sync_member_identity
after insert or update of
  stripe_account_id,
  account_type,
  country,
  default_currency,
  details_submitted,
  charges_enabled,
  payouts_enabled,
  requirements_due,
  updated_at
on public.creator_payout_accounts
for each row
execute function public.sync_creator_payout_to_member_payout();

notify pgrst, 'reload schema';

commit;
