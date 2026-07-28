# Issue #680 Cross-Module Teen Safeguards

Status: implementation phase
Prepared: July 28, 2026
Tracking: #666, #680, #683

## Purpose

This phase extends the database-backed age state from #679 into Search, Ask Loombus AI, Local Discovery, Rooms, and public commercial modules.

The implementation follows a conservative rule: public informational pages may remain readable because they are also available to signed-out visitors, but authenticated teen accounts cannot use a direct link, notification, alternate client, or API call to bypass protected transactional actions.

## Shared server contract

`src/lib/teen-safety-server.ts` becomes the server-authoritative contract for:

- resolving an authenticated member's age band and teen settings
- failing closed when age eligibility cannot be verified for a protected action
- blocking adult-only organizational and commercial mutations
- excluding ineligible commerce and Room sources from teen Search and AI context
- excluding commerce categories from authenticated teen Local Discovery
- loading Room minor-admission settings

Client state and hidden buttons are not treated as enforcement.

## Search and AI

For teen accounts with commerce discovery disabled, Everything Search excludes:

- Businesses and company records
- Services
- Requests
- Jobs
- Marketplace and product records

Room and Room-scoped results are returned only when the Room explicitly allows teen members.

Ask Loombus AI receives the already-filtered source set. Excluded commercial or Room material is not sent to the AI provider as grounded context.

Public Discussions, people, educational material, and Events remain eligible subject to their existing visibility, blocking, moderation, and account rules.

## Local Discovery

Authenticated teen Local Discovery removes Business, Service, Job, Marketplace, and Request results while commerce discovery remains disabled. Event results may remain visible, but event response actions are adult-only in this phase.

Teens cannot publish or change a public Local Discovery location. Existing owners may still clear a legacy location so a protected account is not trapped in a public state.

## Rooms containing minors

The migration adds `room_minor_safety_settings`.

Default behavior:

- Classroom Rooms allow teen admission through approval-only join requests.
- All other existing and new Room models block teen admission until an adult owner explicitly enables it.
- Under-13 and unknown-age accounts cannot apply for or receive active Room membership.
- Teen members require a pending or approved Room application before active membership is inserted.
- Teen members are limited to the ordinary member role.
- Teen accounts cannot own a Room or become an administrator or moderator.
- Sharing a Room does not grant private-message permission. The mutual-follow and block rules remain authoritative.

Room owners and administrators can review the setting at `/rooms/[roomId]/age-safety`. Only the adult Room owner can change it. Disabling teen admission is blocked while active or pending teen membership still exists.

## Commercial and organizational actions

The following new or republishing actions are adult-only in this phase:

- create, claim, or update a Business
- create, update, or reopen a Job
- create, update, or reopen a Marketplace listing
- create, update, activate, reopen, save, or inquire about a Service
- create, update, reopen, save, respond to, or select a response for a Request
- create, update, reopen, or respond to an Event
- create an Appointment service, update its availability, request an Appointment, or respond as provider
- publish a Local Discovery location
- create or own a Room

Safety reporting, removal, cancellation, closure, archival, unsaving, and withdrawal paths remain available where the module already supports them. This allows a teen or newly corrected account to report harm or safely close legacy records without creating new exposure.

## Direct-link and notification boundary

A public record may remain readable through a direct public route because the same record is available without an authenticated age profile. The protected mutation endpoint still checks age state server-side. A notification or copied URL therefore cannot bypass the restriction.

Private Rooms are different: teen admission and membership are enforced in the database as well as the invitation route.

## Deployment

1. Deploy the application changes.
2. Apply `supabase/migrations/20260802110000_teen_cross_module_safeguards.sql`.
3. Verify the migration creates one `room_minor_safety_settings` row per Room.
4. Confirm Classroom defaults are approval-only and other models default to blocked.

## Production verification

Use controlled adult, teen, unknown-age, and under-13 test accounts.

### Search and AI

- Teen Everything Search excludes commerce and ineligible Rooms.
- Adult Search remains unchanged.
- Ask Loombus AI source citations never include excluded teen commerce or Room sources.
- A missing Room minor-safety record fails closed for teen Room discovery.

### Rooms

- A teen invite to a blocked Room returns `room_teen_admission_blocked`.
- A teen invite to an eligible Room creates a pending application instead of membership.
- Approval creates member-role access.
- A teen cannot receive moderator, administrator, or owner authority through an API or direct database write.
- An adult owner can enable or disable teen admission through `/rooms/[roomId]/age-safety`.
- Disabling is rejected while active or pending teen accounts exist.
- Adult Room creation still works; teen Room creation is rejected.

### Commercial modules

For every named module, verify the normal UI and a direct API request:

- teen creation, republishing, response, inquiry, appointment, and location actions return `teen_action_restricted`
- adult actions remain unchanged
- reporting and safe closure actions remain available
- turning 18 does not automatically change privacy, but protected actions become eligible after the scheduled age refresh recalculates the age band

## Completion boundary

This phase implements #683 but does not close #680 or #666 until production verification passes and notification destinations are checked against every supported module client.
