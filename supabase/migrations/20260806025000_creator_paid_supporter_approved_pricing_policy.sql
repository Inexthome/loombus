-- Creator Supporters Phase 2B approved pricing policy.
-- Locks the controlled beta to a 15% Loombus platform fee and a $5 minimum
-- monthly paid tier. Free supporter tiers remain available.

begin;

alter table public.creator_supporter_tiers
  add constraint creator_supporter_tiers_approved_price_policy_check
  check (
    access_mode <> 'paid'
    or (
      price_cents is not null
      and price_cents between 500 and 100000
    )
  );

alter table public.creator_supporter_checkout_intents
  add constraint creator_supporter_checkout_intents_approved_amount_policy_check
  check (amount_cents between 500 and 100000),
  add constraint creator_supporter_checkout_intents_approved_fee_policy_check
  check (platform_fee_bps = 1500);

alter table public.creator_supporter_subscriptions
  add constraint creator_supporter_subscriptions_approved_amount_policy_check
  check (amount_cents between 500 and 100000),
  add constraint creator_supporter_subscriptions_approved_fee_policy_check
  check (platform_fee_bps = 1500);

create or replace function public.enforce_creator_supporter_approved_pricing_policy()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if new.access_mode = 'paid'
    and (
      new.price_cents is null
      or new.price_cents not between 500 and 100000
    )
  then
    raise exception 'Paid supporter tiers must be priced between $5 and $1,000 per month.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists zz_enforce_creator_supporter_approved_pricing_policy_trigger
  on public.creator_supporter_tiers;
create trigger zz_enforce_creator_supporter_approved_pricing_policy_trigger
before insert or update of access_mode, price_cents
on public.creator_supporter_tiers
for each row execute function public.enforce_creator_supporter_approved_pricing_policy();

revoke all on function public.enforce_creator_supporter_approved_pricing_policy()
  from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
