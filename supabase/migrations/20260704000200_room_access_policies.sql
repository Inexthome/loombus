create policy "Room owner add access"
on public.room_members
for insert
to authenticated
with check (
  public.is_room_owner(room_id)
  and user_id <> auth.uid()
);

notify pgrst, 'reload schema';
