-- Reconcile stored Room member limits with the current plan contract.
-- This migration does not remove or deactivate members when a Room is over capacity.

begin;

update public.rooms
set
  member_limit = case subscription_plan
    when 'free' then 10
    when 'starter' then 50
    when 'pro' then 250
    when 'organization' then 500
    when 'organization-plus' then 2000
    when 'enterprise' then member_limit
    else member_limit
  end,
  updated_at = now()
where subscription_plan in (
  'free',
  'starter',
  'pro',
  'organization',
  'organization-plus'
)
and member_limit is distinct from case subscription_plan
  when 'free' then 10
  when 'starter' then 50
  when 'pro' then 250
  when 'organization' then 500
  when 'organization-plus' then 2000
  else member_limit
end;

notify pgrst, 'reload schema';

commit;
