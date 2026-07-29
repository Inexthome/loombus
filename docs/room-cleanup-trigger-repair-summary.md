# Room cleanup trigger fix summary

The failed test Room cleanup was caused by `log_room_activity()` attempting to write an activity row after an `ON DELETE CASCADE` had already removed the parent Room. The trigger now skips the activity insert when the referenced Room no longer exists. The original cleanup remains transactional and retains its Stripe and private-storage safety checks.
