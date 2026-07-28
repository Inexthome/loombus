-- Issue #680 / #686 / #687: preserve Room context on admission notifications.

begin;

create or replace function public.populate_teen_safety_notification_room_context()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if new.room_id is not null or new.target_id is null then
    return new;
  end if;

  if new.target_type = 'room_application' then
    select application.room_id
    into new.room_id
    from public.room_applications application
    where application.id = new.target_id;
  elsif new.target_type = 'room_invite' then
    select invitation.room_id
    into new.room_id
    from public.room_invites invitation
    where invitation.id = new.target_id;
  elsif new.target_type = 'room' then
    new.room_id := new.target_id;
  end if;

  return new;
end;
$$;

drop trigger if exists populate_teen_safety_notification_room_context_trigger
  on public.notifications;
create trigger populate_teen_safety_notification_room_context_trigger
before insert or update of target_type, target_id, room_id
on public.notifications
for each row execute function public.populate_teen_safety_notification_room_context();

update public.notifications notification
set room_id = application.room_id
from public.room_applications application
where notification.room_id is null
  and notification.target_type = 'room_application'
  and notification.target_id = application.id;

update public.notifications notification
set room_id = invitation.room_id
from public.room_invites invitation
where notification.room_id is null
  and notification.target_type = 'room_invite'
  and notification.target_id = invitation.id;

update public.notifications notification
set room_id = notification.target_id
where notification.room_id is null
  and notification.target_type = 'room'
  and notification.target_id is not null;

revoke all on function public.populate_teen_safety_notification_room_context()
  from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
