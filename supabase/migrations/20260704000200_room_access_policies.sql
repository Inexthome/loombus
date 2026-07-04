create policy "Room owner add access"
on public.room_members
for insert
to authenticated
with check (
  public.is_room_owner(room_id)
  and user_id <> auth.uid()
);

create policy "Room owner revoke access"
on public.room_members
for delete
to authenticated
using (
  public.is_room_owner(room_id)
  and user_id <> auth.uid()
  and coalesce(role, 'member') <> 'owner'
);

notify pgrst, 'reload schema';
