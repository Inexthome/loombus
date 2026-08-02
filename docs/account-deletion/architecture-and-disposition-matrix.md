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
| Public profile identity | `public.profiles` | Profile is restricted through `account_status`; public identity supplies attribution across content, Rooms, commerce, local discovery, and search | Anonymize public identity and presentation fields only after ownership, safety, Storage, search, Auth, and legal-hold prerequisites clear | ownership, enforcement, fraud, legal hold | migration `20260804006000` | Field-level map defined; manual-review only; handler not approved |
| Protected profile safety state | `profile_sensitive` | Date of birth and derived age-safety state are isolated from the public profile | Decide deletion versus minimum safety retention after reports, corrections, legal hold, and Auth sequencing are reviewed | underage report, correction evidence, enforcement, legal hold | migration `20260804006000` and teen-safety migrations | Separate manual-review resource; retention period not approved |
| Private personalization and relationships | `sticky_items`, `bookmarks`, `discussion_views`, `profile_views`, `follow_requests`, `follows`, `user_blocks`, `member_privacy_settings` | Member-private state is stored in first-party tables | Delete member-owned and member-linked rows | none identified for these eight resources | migration `20260803233000` | Handler verified statically; live enablement pending controlled test |
| Private drafts and activity | `discussion_drafts`, `floor_academy_progress`, `floor_pulse_event_reads`, `floor_live_registrations` | Unpublished or member-private participation state is stored in first-party tables | Delete member-owned rows | none identified for these four resources | migration `20260803234500` | Handler verified statically; live enablement pending controlled test |
| Private goals and saved folders | `user_purpose_goals`, `bookmark_collections` | Member-private goals, notes, folder names, and descriptions are stored in first-party tables | Delete member-owned rows | none identified for these two resources | migration `20260803235500` | Handler verified statically; live enablement pending controlled test |
| Private matching configuration | `matching_preferences`, `matching_rules` | Member-private filters and authored matching rules are stored in first-party tables | Delete member-owned rows | none identified for these two resources | migration `20260804001000` | Handler verified statically; live enablement pending controlled test |
| Private Floor cloud state | `floor_cloud_items` | Member-private watch, journal, workspace draft/revision, Academy progress, and session state is stored in one first-party table | Delete member-owned rows | none identified for this resource | migration `20260804002000` | Handler verified statically; live enablement pending controlled test |
| Private Discussion audience defaults | `discussion_audience_preferences` | Member-private defaults and selected-user lists control future Discussion creation | Delete member-owned row | none identified for this resource | migration `20260804003000` | Handler verified statically; live enablement pending controlled test |
| Member product feedback | `labs_feature_request_votes`, `ai_output_ratings` | Member-submitted votes and helpfulness ratings are first-party metadata; requests, prompts, and outputs are separate resources | Delete member-owned rows | none identified for these two resources | migration `20260804004000` | Handler verified statically; live enablement pending controlled test |
| Private commerce and local saves | `marketplace_saved_listings`, `provider_service_saves`, `service_request_saves` | Member-private saved-item rows reference public listings, provider services, and service requests | Delete member-owned rows without changing the referenced records | none identified for these three resources | migration `20260804005000` | Handler verified statically; live enablement pending controlled test |
| Deletion workflow | `account_deletion_requests`, events, dispositions | Request and audit metadata retained for processing | Retain minimum workflow proof under approved schedule | disputes, legal hold, security | migration `20260803180000` | Duration not approved |
| Public Discussions and Replies | `discussions`, `replies` | Self-service and administrator removal soft-delete rows; deleted content remains available to authorized administrators and participates in audit and moderation context | Preserve content and stable IDs; remove public author attribution through profile anonymization only after all prerequisites clear | reports, enforcement evidence, legal hold, thread integrity | migration `20260804007000`, Discussion and Reply delete APIs, deleted-content admin APIs | Disposition defined; manual-review only; no content handler approved |
| Discussion attachments and derived data | `discussion_attachments`, Storage objects, `discussion_summaries`, AI outputs, metrics, search documents, caches | Attachments and derivatives are coupled to source Discussions but have separate storage, vendor, index, and evidence lifecycles | Review separately; do not cascade from account deletion until Storage, AI, search, moderation, and retention rules are approved | reports, evidence, vendor copies, legal hold | migration `20260804007000`, attachment and search migrations | Explicitly excluded from public-content disposition; separate reviews required |
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

## Profile anonymization field map

Profile anonymization is deliberately not an automatic handler yet. The profile row is a shared attribution anchor, and running it before ownership and evidence decisions could irreversibly change other resources while the request remains blocked.

| Field group | Intended handling | Current gate |
|---|---|---|
| Public identity | `username`, `full_name`, `bio`, `avatar_url`, and `perspective_marker` are candidates for irreversible anonymization | Manual review until public-content attribution, avatar Storage deletion, search propagation, and Auth sequencing are approved |
| Creator and support links | `creator_website_url`, `creator_support_url`, and `creator_support_label` are candidates for clearing | Manual review until subscription and commerce dependencies are resolved |
| Local discovery presentation | Public local-location and presentation fields are candidates for clearing | Manual review until authored local and commerce resources are dispositioned |
| Stable profile key | `id` remains temporarily as the foreign-key anchor | Remove or tombstone only in the approved Auth and dependency sequence |
| Access and administrator state | `account_status` must remain `deletion_requested`; `is_admin` cannot change until administrator and ownership-transfer checks pass | Required prerequisite |
| Enforcement and verification state | Enforcement, verification, fraud, and restriction fields are not part of public-profile anonymization | Trust-and-safety, legal-hold, and minimum-retention decision required |
| Protected age-safety state | `profile_sensitive` is handled as a separate resource | Underage-report, age-correction, legal-hold, and minimum-safety-evidence review required |

Migration `20260804006000` records these rules in the executable registry without adding a worker dispatch or anonymization function. Deployment cannot anonymize a profile, even if the destructive-handler environment flag is enabled for previously approved handlers.

## Public Discussions and Replies disposition

Migration `20260804007000_account_deletion_public_content_disposition.sql` records the public-content policy without adding a handler or worker dispatch.

- Published Discussion and Reply text, stable IDs, timestamps, thread relationships, and existing soft-deletion state are preserved.
- Public attribution is removed later through the approved profile anonymization path, rather than by rewriting every authored row.
- Already soft-deleted content remains restricted and available to authorized administrators for moderation and audit review.
- Discussion attachments, Storage objects, summaries, AI outputs, metrics, search documents, caches, reports, and enforcement evidence remain separate resources.
- An account request cannot automatically hard-delete or rewrite public content under this phase.

## Processor rollout state

The processor is now fail-closed. It claims work safely, verifies that the account remains restricted, creates a disposition for every enabled registry resource, and writes a structured exception report. Administrators can record evidence-backed outcomes for manual or external resources and requeue a reviewed request; automatic handlers cannot be manually overridden. Reviewed outcomes and completed irreversible automatic outcomes remain durable across retries. Once an outcome is marked irreversible, cancellation and account restoration are blocked at the database layer. The first-party notification, private-personalization, private-activity, private-goals, private-matching-configuration, private-Floor-cloud, private-Discussion-audience-preferences, member-product-feedback, and private-commerce-saves handlers are implemented but require the explicit `ACCOUNT_DELETION_DESTRUCTIVE_HANDLERS_ENABLED=true` runtime gate, so deployment alone cannot activate them. Auth deletion, vendor deletion, public-content erasure, private-message deletion, and profile anonymization remain disabled until their resource-level rules are approved and their handlers are separately verified. Requests with any unresolved resource move to `blocked`, never `completed`.
6. Reconcile export, Privacy, Retention, Room, Reporting, Teen Safety, Search, and AI disclosures against the verified register.

## Change process

Any schema, bucket, vendor, log, index, AI feature, or account-linked product change must add or update its register entry before release. Privacy and Trust Operations reviews the register quarterly and after any material processor or deletion-flow change. Legal or operational bases and public timelines remain pending qualified review.
