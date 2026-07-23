-- Prevent service-role and legacy routes from bypassing the Room announcement entitlement.
-- Existing announcements remain readable. This trigger controls new and changed records.

begin;

create or replace function public.enforce_room_announcement_entitlement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  room_plan text;
  room_subscription_status text;
begin
  select
    room.subscription_plan,
    room.subscription_status
  into
    room_plan,
    room_subscription_status
  from public.rooms room
  where room.id = new.room_id;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'The Room for this announcement does not exist.';
  end if;

  if room_plan in (
    'starter',
    'pro',
    'organization',
    'organization-plus',
    'enterprise'
  )
  and coalesce(lower(room_subscription_status), 'active') in (
    'active',
    'trialing',
    'past_due'
  ) then
    return new;
  end if;

  raise exception using
    errcode = '42501',
    message = 'Announcements are not included in the current Room plan.';
end;
$$;

drop trigger if exists enforce_room_announcement_entitlement_trigger
  on public.room_announcements;
create trigger enforce_room_announcement_entitlement_trigger
before insert or update on public.room_announcements
for each row execute function public.enforce_room_announcement_entitlement();

notify pgrst, 'reload schema';

commit;
