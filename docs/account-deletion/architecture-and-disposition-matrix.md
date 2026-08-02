# Account deletion architecture and disposition matrix

Status: engineering foundation; retention periods and legal bases are not approved by this document.

Issue: #668

Evidence date: 2026-08-02
Quarterly review owner: Loombus Privacy and Trust Operations

## Guardrails

- A deletion request restricts account actions, but does not immediately hard-delete the Supabase Auth user.
- Request creation and profile restriction must commit in one database transaction.
- An open request must be explicitly cancelled, with an actor and reason recorded, before the profile can leave `deletion_requested`.
- `completed` is not valid until every registered resource has a disposition or an exception.
- Active-system handling, Room staged deletion, backups, replicas, caches, search indexes, and vendor copies are separate dispositions.
- No retention duration is approved until production behavior and applicable obligations are verified.

## Control-plane architecture

| Resource | Role | Current control |
|---|---|---|
| `profiles.account_status` | Member access gate | `deletion_requested` restricts authenticated actions |
| `account_deletion_requests` | Request state | One open request per member; controlled workflow status and exception report |
| `account_deletion_events` | Workflow audit | Append-only request, processing, failure, completion, and cancellation events |
| `account_deletion_dispositions` | Per-resource result | Records delete, anonymize, retain, staged-delete, vendor-delete, or manual-review outcomes |
| `request_account_deletion()` | Atomic submission | Creates the request, restricts the profile, and records the event in one transaction |
| `cancel_account_deletion_request()` | Explicit cancellation | Requires a reason, records the actor, cancels the request, then restores access |
| Profile restoration trigger | Invariant enforcement | Blocks every route from changing `deletion_requested` while an open request remains |
| `account_deletion_resource_registry` | Executable resource inventory | Defines each required resource group, intended disposition, handler, and execution mode |
| `claim_account_deletion_requests()` | Concurrency-safe work claiming | Uses row locks with `skip locked`, increments attempts, and records processing events |
| Account deletion worker | Orchestration and exception reporting | Verifies restriction, records every registered disposition, and blocks unapproved actions |
| `finalize_account_deletion_request()` | Completion invariant | Completes only when every enabled resource is terminal and no exception or failure remains |
| Disposition review RPC | Manual/external evidence gate | Requires an administrator, structured evidence, a review note, and an irreversible-action declaration; automatic handlers cannot be overridden |
| Requeue RPC | Controlled retry | Requires at least one reviewed disposition and writes an auditable requeue event |

## Initial disposition matrix

This matrix identifies the currently evidenced behavior. `Unverified` means the production resource or vendor behavior still requires read-only confirmation.

| Data class | Production resource | Current behavior | Required disposition | Exceptions to evaluate | Evidence | Status / gap |
|---|---|---|---|---|---|---|
| Account identity | Supabase Auth `auth.users` | Hard deletion intentionally deferred | Manual review, then delete or retain a minimal tombstone | ban evasion, security, legal hold | `database/account/20260524_account_deactivation_deletion_setup.sql` | Auth deletion procedure unverified |
| Profile and settings | `public.profiles` and profile-linked settings | Profile is restricted through `account_status` | Anonymize or delete fields according to dependency map | enforcement, fraud, legal hold | `src/app/api/account/delete-request/route.ts` | Field-level map required |
| Deletion workflow | `account_deletion_requests`, events, dispositions | Request and audit metadata retained for processing | Retain minimum workflow proof under approved schedule | disputes, legal hold, security | migration `20260803180000` | Duration not approved |
| Public Discussions and Replies | `discussions`, `replies`, summaries, metrics | Existing content deletion/anonymization behavior varies by module | Decide delete versus author anonymization per resource | reports, evidence, public integrity | Discussion APIs and migrations | Full FK and trigger inventory required |
| Private messages | conversation, participant, message, attachment tables | User removal does not currently hard-delete moderation evidence | Remove member access; delete/anonymize content unless excepted | reports, safety, legal hold | `database/messages/20260603_private_messages_phase1.sql` | Attachment and evidence rules required |
| Rooms | Room tables, memberships, files, calendars, audit and lifecycle records | Room deletion uses a staged lifecycle | Preserve staged deletion and separately disposition member-owned data | ownership, billing, reports, legal hold | Room lifecycle migrations and service | Ownership-transfer matrix required |
| Commerce and local modules | Marketplace, Businesses, Services, Requests, Jobs, Events, Appointments, Local | Multiple profile FKs and module-specific deletion rules | Per-table delete, anonymize, retain, or transfer | transaction dispute, fraud, billing | module migrations | Full resource inventory required |
| Search | indexes, query logs, click logs, caches | Application index sources exist; deletion propagation is not globally verified | Remove or anonymize indexed member data and verify propagation | security telemetry | Everything Search migrations | Cache/index expiry unverified |
| AI | prompts, outputs, summaries, traces and provider copies | Feature-specific paths; no canonical deletion mapping yet | Per-feature active and vendor disposition | safety, abuse monitoring, legal hold | Issue #669 dependency | Provider settings unverified |
| Billing | Stripe customer, subscription, invoice and local metadata | Subscription data is synchronized locally | Cancel access; delete optional metadata; retain required transaction records | tax, accounting, disputes, fraud | Stripe webhook and billing tables | Vendor and legal periods unverified |
| Notifications | database notifications, preferences, topic alerts, Room preferences, and push tokens | First-party handler implemented behind an explicit runtime gate | Delete member-addressable first-party rows | none identified for these five resources | migration `20260803230000` | Handler verified statically; live enablement pending controlled test |
| Notification delivery vendors | email and push delivery providers | Outside the first-party transaction | Request deletion or expire under verified provider controls | security, delivery disputes | provider configuration required | Vendor copies unverified |
| Logs and infrastructure | Vercel, Supabase logs, cron, security and incident records | Outside the account request transaction | Expire or minimize under verified platform controls | security, incident, legal hold | Production dashboards required | Unverified |
| Backups and replicas | Supabase and vendor-managed copies | Not active-system deletion | Expire through verified backup lifecycle; prevent restoration to active state | legal hold | Production configuration required | Unverified |

## Verification gates

1. Enumerate database tables, foreign keys, functions, triggers, policies, soft-delete fields, and storage buckets from production metadata.
2. Populate one disposition row for every account-related production resource.
3. Verify Room ownership and staged-deletion behavior separately from member deletion.
4. Verify search, caches, backups, replicas, and each external processor through production configuration or contractual evidence.
5. Implement a processor that cannot mark a request completed while a disposition is pending or failed.

## Processor rollout state

The processor is now fail-closed. It claims work safely, verifies that the account remains restricted, creates a disposition for every enabled registry resource, and writes a structured exception report. Administrators can record evidence-backed outcomes for manual or external resources and requeue a reviewed request; automatic handlers cannot be manually overridden. Reviewed outcomes and completed irreversible automatic outcomes remain durable across retries. Once an outcome is marked irreversible, cancellation and account restoration are blocked at the database layer. The first-party notification handler is implemented but requires the explicit `ACCOUNT_DELETION_DESTRUCTIVE_HANDLERS_ENABLED=true` runtime gate, so deployment alone cannot activate it. Auth deletion, vendor deletion, public-content erasure, private-message deletion, and profile anonymization remain disabled until their resource-level rules are approved and their handlers are separately verified. Requests with any unresolved resource move to `blocked`, never `completed`.
6. Reconcile export, Privacy, Retention, Room, Reporting, Teen Safety, Search, and AI disclosures against the verified register.

## Change process

Any schema, bucket, vendor, log, index, AI feature, or account-linked product change must add or update its register entry before release. Privacy and Trust Operations reviews the register quarterly and after any material processor or deletion-flow change. Legal or operational bases and public timelines remain pending qualified review.
