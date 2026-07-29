# Room cleanup activity-trigger repair

## Failure

Deleting a Room cascades into child tables that use `log_room_activity()` as an `AFTER DELETE` trigger. PostgreSQL may remove the parent `rooms` row before those child triggers execute. The trigger then attempts to insert a `room_activity_log` row whose `room_id` no longer exists, violating `room_activity_log_room_id_fkey`.

## Repair

- `20260803101000_remove_specified_test_rooms.sql` now replaces `log_room_activity()` with a cascade-safe version before running the cleanup.
- `20260803102000_harden_room_activity_cascade_delete.sql` applies the same guard as a permanent forward migration.
- The trigger skips activity insertion only when the referenced Room no longer exists. Ordinary child-row operations continue to generate activity events.

## Production recovery

The failed cleanup ran inside a transaction, so its deletes were rolled back. After this repair is merged, rerun `20260803101000_remove_specified_test_rooms.sql`. The migration remains protected against matching Stripe subscriptions and Room resource storage objects.
