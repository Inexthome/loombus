-- Remove test Rooms and abandoned checkout intents owned by the three
-- specified test accounts. The user accounts themselves are preserved.
--
-- Safety boundary: abort instead of deleting any Room that still carries a
-- Stripe subscription id. This prevents a database deletion from orphaning a
-- recurring Stripe subscription.

begin;

do $$
declare
  matching_subscription_count integer;
begin
  select count(*)
    into matching_subscription_count
  from public.rooms room
  where exists (
    select 1
    from auth.users account
    where lower(account.email) in (
      '1981saint@gmail.com',
      'loombus7@gmail.com',
      'reviewer@loombus.com'
    )
      and (account.id = room.owner_id or account.id = room.created_by)
  )
    and nullif(trim(coalesce(room.stripe_subscription_id, '')), '') is not null;

  if matching_subscription_count > 0 then
    raise exception
      'Test Room cleanup stopped: % matching Room(s) still have Stripe subscription ids. Cancel those subscriptions before deleting the Room records.',
      matching_subscription_count;
  end if;
end
$$;

delete from public.room_checkout_intents intent
using auth.users account
where intent.user_id = account.id
  and lower(account.email) in (
    '1981saint@gmail.com',
    'loombus7@gmail.com',
    'reviewer@loombus.com'
  );

delete from public.rooms room
where exists (
  select 1
  from auth.users account
  where lower(account.email) in (
    '1981saint@gmail.com',
    'loombus7@gmail.com',
    'reviewer@loombus.com'
  )
    and (account.id = room.owner_id or account.id = room.created_by)
);

commit;
