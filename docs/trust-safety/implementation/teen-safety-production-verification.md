# Teen-safety production verification

Status: production verification package
Prepared: July 28, 2026
Tracking: #666, #680, #683, #686, #687

## Purpose

This package converts the teen-safety acceptance criteria into a repeatable production verification run. It does not treat a successful deployment or migration as proof that every runtime boundary works.

The verification covers:

- canonical adult, teen, unknown-age, and synthetic under-13 account states
- teen privacy and discovery defaults
- Everything Search, Ask Loombus AI, and Local Discovery filtering
- protected mutation APIs reached through direct requests rather than hidden controls
- Room minor-safety row coverage and consistency
- teen Room ownership and elevated-role exclusions
- Room-admission notification context
- representative reporting access that remains available to teen accounts

The test runner is intentionally non-destructive. Protected mutation probes use incomplete payloads and expect age safety to reject them before any record can be created. Adult probes also use incomplete payloads and confirm only that the request is not incorrectly rejected by age safety.

## Safety requirements

Use dedicated synthetic test accounts. Do not use an actual child account, a production member's password, or a real member's date of birth.

Never commit `.env.teen-safety.local`. The repository ignores all `.env*` files. Verification output is written to `.teen-safety-verification/`, which is also ignored.

The report records user IDs and age bands but never records passwords, access tokens, service-role keys, or member email addresses.

## Required test accounts

Prepare four dedicated accounts:

1. `adult`: age band `adult`
2. `teen`: age band `teen`, private account, non-discoverable, Followers Discussion default, recommendations off, commerce discovery off
3. `unknown`: authenticated account that has not completed age safety
4. `under13`: synthetic restricted account with `age_band = 'under_13'` and `guardian_required = true`

The under-13 account exists only to verify fail-closed behavior. It must not be used for ordinary Loombus activity.

## Local configuration

Create `.env.teen-safety.local` in the repository root:

```bash
LOOMBUS_BASE_URL=https://loombus.com
LOOMBUS_VERIFY_SEARCH_QUERY="business service job marketplace room event"

TEEN_VERIFY_ADULT_EMAIL=adult-verification@example.invalid
TEEN_VERIFY_ADULT_PASSWORD=replace-me

TEEN_VERIFY_TEEN_EMAIL=teen-verification@example.invalid
TEEN_VERIFY_TEEN_PASSWORD=replace-me

TEEN_VERIFY_UNKNOWN_EMAIL=unknown-verification@example.invalid
TEEN_VERIFY_UNKNOWN_PASSWORD=replace-me

TEEN_VERIFY_UNDER13_EMAIL=under13-verification@example.invalid
TEEN_VERIFY_UNDER13_PASSWORD=replace-me
```

Access tokens may be supplied instead of passwords:

```bash
TEEN_VERIFY_ADULT_TOKEN=...
TEEN_VERIFY_TEEN_TOKEN=...
TEEN_VERIFY_UNKNOWN_TOKEN=...
TEEN_VERIFY_UNDER13_TOKEN=...
```

The runner also requires the existing local Supabase configuration:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Synthetic under-13 preparation

Create the synthetic user through the Supabase Auth dashboard. Confirm that the normal profile-creation trigger created its `profiles` row. Then use the SQL editor only for this dedicated account:

```sql
select set_config('request.jwt.claim.role', 'service_role', true);

insert into public.profile_sensitive (
  id,
  date_of_birth,
  age_band,
  teen_safety_mode,
  guardian_required
)
values (
  '<SYNTHETIC_USER_UUID>',
  current_date - interval '10 years',
  'under_13',
  true,
  true
)
on conflict (id) do update
set date_of_birth = excluded.date_of_birth;
```

The database trigger recalculates the canonical under-13 state. Do not use a real child's information.

## Run

After pulling the merged verification package:

```bash
npm install
npm run verify:teen-safety
```

The process exits with:

- `0`: all required checks passed
- `1`: one or more checks failed
- `2`: verification is incomplete because required test accounts or evidence were unavailable

Reports are written to:

```text
.teen-safety-verification/teen-safety-verification-<timestamp>.json
.teen-safety-verification/teen-safety-verification-<timestamp>.md
```

## Automated checks

### Account state

The runner verifies each configured account against `profile_sensitive`. For the teen account it also verifies:

- `private_account = true`
- `discoverable = false`
- `future_discussion_audience = 'followers'`
- unsolicited adult contact disabled
- personalized recommendations disabled
- commerce discovery disabled

### Room data integrity

The runner compares the number of Rooms with `room_minor_safety_settings`, rejects inconsistent admission-mode rows, and checks that teen profiles do not own Rooms or hold administrator or moderator roles.

### Protected direct requests

The runner directly calls the mutation endpoints for Businesses, Jobs, Marketplace, Services, Requests, Events, Appointments, Local, and Room provisioning.

Expected restricted results:

| Account | HTTP | Code |
| --- | ---: | --- |
| teen | 403 | `teen_action_restricted` |
| unknown | 403 | `age_gate_required` |
| synthetic under-13 | 403 | `under_13_not_allowed` |

The adult account must not receive an age-safety restriction code. The incomplete test payload must fail validation before creating a record.

### Discovery and AI

For teen accounts with commerce discovery disabled, Everything Search and Local must exclude protected commercial categories. Room results may appear only for Rooms whose minor-safety settings allow teen admission.

Unknown-age and under-13 authenticated accounts must not receive protected commercial or Room-scoped results.

Ask Loombus AI is verified when the test account has Premium AI access. A `premium_required` response is recorded as an optional skip. When AI runs, excluded sources must not appear in the returned source list.

### Notifications

The migration in this package backfills and enforces `room_id` for Room application, invitation, and Room notifications. The Signal Inbox adds protected destinations for:

- member age-correction status: `/account/age-safety`
- member underage-report status: `/account/age-safety`
- Admin age-correction review: `/admin/age-safety`
- Admin underage-report review: `/admin/age-safety`
- Room admission outcome: the affected Room

## Manual completion checks

The following checks require controlled interaction and must be recorded in Issues #683 and #680 before closure:

1. Open each age-safety notification from Signal Inbox and confirm the expected destination.
2. Open a Room admission notification and confirm it opens the affected Room.
3. Copy the destination URL, open it in a new authenticated session, and confirm protected mutation APIs remain restricted.
4. Invite the teen account to a Room that blocks minors and confirm admission fails.
5. Enable teen admission in a dedicated Classroom Room, redeem the invitation, and confirm a pending application is created rather than immediate membership.
6. Approve the application and confirm the teen receives only the ordinary member role.
7. Attempt to promote the teen to moderator or administrator and confirm the database rejects the change.
8. Confirm adult-to-teen private conversation creation fails without mutual following and succeeds only under the existing mutual-follow contract.
9. Run a controlled turning-18 transition and confirm private-account and discoverability choices remain unchanged.
10. Review `/notifications`, `/rooms/[roomId]/age-safety`, `/account/age-safety`, and `/admin/age-safety` in Light, Dark, System-on-light, and System-on-dark.

## Completion rule

Do not close #666, #680, #683, #686, or #687 solely because the verification runner exists or the migration succeeds. Close them only after the automated report returns PASS and the manual completion checks are recorded with no unresolved safety defect.
