-- Consolidate legacy Rooms policies into the canonical private read-only client boundary.
-- All room mutations are handled by authenticated server routes using the service role
-- after account, membership, and role verification.

begin;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'rooms',
        'room_members',
        'room_posts',
        'room_events',
        'room_announcements',
        'room_applications'
      )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end;
$$;

create policy "Live room records are visible to active members"
on public.rooms for select to authenticated
using (public.user_is_active_room_member(id));

create policy "Live room members are visible inside the room"
on public.room_members for select to authenticated
using (public.user_is_active_room_member(room_id));

create policy "Live room posts are visible inside the room"
on public.room_posts for select to authenticated
using (deleted_at is null and public.user_is_active_room_member(room_id));

create policy "Live room events are visible inside the room"
on public.room_events for select to authenticated
using (public.user_is_active_room_member(room_id));

create policy "Live room announcements are visible inside the room"
on public.room_announcements for select to authenticated
using (public.user_is_active_room_member(room_id));

create policy "Live room applications are visible to applicant or managers"
on public.room_applications for select to authenticated
using (
  applicant_id = auth.uid()
  or public.user_can_manage_live_room(room_id)
);

revoke all on table public.rooms from anon;
revoke all on table public.room_members from anon;
revoke all on table public.room_posts from anon;
revoke all on table public.room_events from anon;
revoke all on table public.room_announcements from anon;
revoke all on table public.room_applications from anon;

revoke insert, update, delete on table public.rooms from authenticated;
revoke insert, update, delete on table public.room_members from authenticated;
revoke insert, update, delete on table public.room_posts from authenticated;
revoke insert, update, delete on table public.room_events from authenticated;
revoke insert, update, delete on table public.room_announcements from authenticated;
revoke insert, update, delete on table public.room_applications from authenticated;

grant select on table public.rooms to authenticated;
grant select on table public.room_members to authenticated;
grant select on table public.room_posts to authenticated;
grant select on table public.room_events to authenticated;
grant select on table public.room_announcements to authenticated;
grant select on table public.room_applications to authenticated;

notify pgrst, 'reload schema';

commit;
