# Room resource reservations

## Purpose

Room facilities and shared resources use a Room-native reservation ledger rather than the business appointment tables. This preserves Room membership, role, privacy, lifecycle, and ownership boundaries without creating synthetic business records.

## Canonical records

- `room_reservable_resources`: manager-configured facilities or time-based resources.
- `room_resource_reservations`: member requests and their lifecycle.

## Roles

- Active Room members may view active resources and request time.
- Room managers may create, pause, archive, approve, decline, reschedule, cancel, and complete reservations.
- The Room owner remains the final authority under the existing Room role hierarchy.

## Lifecycle

Reservations use the shared scheduling states:

- `pending`
- `accepted`
- `declined`
- `reschedule_proposed`
- `cancelled`
- `completed`

Accepted reservations are protected by a database-level overlap check for the same resource.

## Appointments hub integration

`/appointments` should aggregate Room reservations as a second scheduling source. It should not copy Room reservations into `business_appointment_requests`, because those records require business ownership and would weaken Room privacy and authorization semantics.

The shared presentation contract is:

- source type: `room_resource`
- source id: resource id
- source label: resource name
- source href: `/rooms/{roomId}/reservations`
- provider authority: current Room management role, not a single permanent provider account

## Deployment order

1. Deploy the application support for Room reservations.
2. Apply `20260803220000_create_room_resource_reservations.sql`.
3. Verify resource creation, member requests, manager decisions, overlap rejection, cancellation, and Room access removal.
4. Enable `/appointments` aggregation only after the Room reservation API is live.
