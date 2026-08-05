# Issue #790 Phase 2: Booking source wiring

## Existing system

Loombus appointments remain backed by `business_appointment_services` and `business_appointment_requests`. The existing business flow, age safety, blocking, provider conflict detection, lifecycle controls, notifications, and calendar integration remain authoritative.

## Phase 2 contract

The shared appointment types now expose optional source metadata:

- `sourceType`
- `sourceId`
- `sourceLabel`
- `sourceHref`

The fields remain optional in the TypeScript contract during the compatibility phase so deployed application nodes can continue reading records while the production migration is applied.

## Persistence guarantees

The migration adds two database triggers:

1. Business-backed appointment services receive canonical source identity from the connected published business.
2. New appointment requests copy their source identity from the selected appointment service at insert time.

The request trigger also verifies that the submitted business and provider attribution match the selected service. This prevents callers from pairing an appointment service with a different business or provider.

## Deployment order

1. Deploy the application changes.
2. Apply `supabase/migrations/20260803211000_wire_appointment_booking_sources.sql`.
3. Verify creation of a business appointment service.
4. Verify creation of an appointment request.
5. Confirm the request contains the same source fields as its service.

## Boundaries

This phase does not add Marketplace, Room, Request, Event, or Local buttons. It does not change appointment status behavior, payments, availability policy, calendar rendering, or notifications. Those integrations follow after the source contract is fully wired and verified.
