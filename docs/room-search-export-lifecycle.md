# Room Search, Export, and Lifecycle Contract

This release keeps Room data private while adding search, export, archive, restore, and safe deletion controls.

- Search must respect active membership, module entitlements, directory visibility, and Customer Support case isolation.
- Export is owner-only and may include temporary signed attachment links.
- Archiving pauses ordinary Room access without deleting content.
- Restoring reactivates an archived Room.
- Deletion requires prior archive, exact Room-name confirmation, and an ended Stripe subscription.
- Deletion is a soft-delete operation that removes member access while preserving recoverable records.
- Export, archive, restore, and deletion actions are written to the audit log.
