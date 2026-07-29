# Validation notes

- The original cleanup failure occurred inside `begin` / `commit`, so PostgreSQL rolled back the attempted deletes.
- The activity trigger now verifies that `public.rooms.id = target_room_id` still exists before inserting into `public.room_activity_log`.
- Normal inserts, updates, and explicit child-row deletes still produce Room activity events while the parent Room exists.
- Cascading child deletes after parent removal return without writing an invalid activity row.
- Existing Stripe-subscription and private-storage safety checks remain unchanged.
