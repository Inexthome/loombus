# Loombus Trust, Safety, Policy, and Help Center Verification Plan

Status: Internal product, engineering, safety, privacy, support, and legal planning document  
Prepared: July 27, 2026  
Scope: Current Loombus web and mobile product, including Discussions, Rooms, member privacy, messaging, Search Everything, AI features, Local, Businesses, Services, Requests, Jobs, Events, Marketplace, Appointments, Intelligent Matching, subscriptions, and administrator operations

## 1. Purpose

Loombus needs a complete public policy and knowledge system that is as operationally useful as the systems maintained by mature platforms, while remaining original to Loombus and truthful to the software that exists.

This document is the verification gate between competitor research and public drafting. It does not replace legal advice, approve public promises, or authorize a policy launch. It establishes:

1. what the current Loombus product can safely claim;
2. what is only partly implemented or only partly verified;
3. what must not be promised yet;
4. which legal, safety, operational, and engineering gaps must be closed;
5. the complete document families Loombus should maintain;
6. the order in which those documents should be drafted and published;
7. the review and version-control process required to keep them accurate.

The public system should eventually be presented through a unified Trust, Safety, Policy, and Help Center. Binding legal terms, behavioral standards, product instructions, enforcement procedures, and Room governance must remain clearly distinguishable even when they share one search and navigation system.

## 2. Evidence baseline

The matrix below is based on the repository state and the implemented contracts documented in recent merged pull requests, including:

- PR #567, public policy expansion for the broader Loombus platform;
- PRs #568 and #569, official legal contact and active DMCA agent information;
- PRs #593 through #599, duplicate detection, media review, Discussion safety actions, and account enforcement;
- PRs #604, #605, #660, and #661, Discussion audiences, private accounts, discoverability, follow approvals, and viewer identity controls;
- PRs #625 through #654, Room entitlements, discussions, support-case isolation, operations, governance, moderation, retention, notifications, analytics, calendar, billing, lifecycle, and permanent-deletion state management;
- PR #638, the canonical Room moderation workflow;
- PR #659, the shared Discussion composer and attachment contract;
- PR #662, the current Room subscription ladder and Enterprise sales-assisted flow;
- the existing Platform Operations modules for Marketplace, Businesses, Jobs, Events, Requests, Services, Rooms, Appointments, Local, Matches, Search, and media duplicate review.

A merged pull request is evidence of an intended software contract, but it is not automatically proof that every production environment variable, migration, storage policy, vendor setting, operational process, and support procedure is continuously correct. Public policies must be checked against production behavior before publication.

## 3. Verification statuses

| Status | Meaning | Publication rule |
|---|---|---|
| Verified product contract | The repository contains a clear server or database contract and the feature has a defined user surface. | May be drafted, subject to production verification and legal review where applicable. |
| Partially verified | Important behavior exists, but an edge, dependency, migration, vendor setting, or operating procedure remains incomplete or unverified. | Draft with explicit limitations. Do not publish absolute claims. |
| Implementation gap | The proposed policy would promise a capability that is not currently available or consistently enforced. | Do not publish the promise until the gap is closed. |
| Operational gap | The software may support the action, but staffing, escalation, response time, recordkeeping, or ownership is undefined. | Establish the process before publication. |
| Legal review required | The statement creates contractual, statutory, regulatory, or jurisdiction-specific obligations. | Qualified counsel must review before publication. |
| Production confirmation required | Repository behavior is defined, but live database, storage, Stripe, Supabase, email, push, AI, or hosting configuration must be checked. | Complete a production checklist before release. |

## 4. Executive findings

### 4.1 Strongest existing foundations

Loombus already has unusually substantial foundations for a young platform:

- database-enforced Discussion audience controls;
- private accounts, discoverability controls, follow approvals, and private viewer identity;
- report, block, follow, message, edit, delete, resolve, reopen, and pin actions on Discussions and Replies;
- pre-publication safety review and duplicate screening;
- account warnings, suspensions, bans, restoration, and permanent-ban tombstones;
- private Room governance, role administration, moderation queues, evidence snapshots, retention holds, audit history, and billing enforcement;
- Customer Support Room case isolation at the application, database, attachment, and Storage layers;
- private Room lifecycle controls and an idempotent permanent-deletion state machine;
- public-platform operational review across commerce and discovery modules;
- approximate-location protections for Local Discovery;
- grounded Search AI boundaries that exclude private Room and saved-item content;
- an active DMCA agent and public legal contact information.

These foundations support meaningful, specific policies. Loombus does not need to rely only on aspirational language.

### 4.2 Highest-risk gaps before a comprehensive public launch

The following gaps are load-bearing:

1. **A general member-facing enforcement and appeals system is not fully verified.** Room reports and module moderation have defined workflows, but a single user-facing record of warnings, restrictions, removals, suspensions, reasons, evidence summaries, appeal windows, appeal status, and restoration is not confirmed across the platform.
2. **Teen safety is not yet a complete operating system.** The minimum age, age gate, account enforcement, and some age-safety checks exist, but teen-default privacy, adult-to-teen messaging limits, age assurance, guardian handling, youth-sensitive recommendation controls, and Room duties involving minors require deeper implementation and operational verification.
3. **The privacy policy cannot truthfully specify complete retention periods yet.** Room retention and deletion are sophisticated, but a platform-wide retention schedule for profiles, Discussions, Replies, messages, reports, viewer records, search records, AI prompts, logs, commerce records, backups, and vendor copies is not fully established.
4. **AI transparency requires a complete vendor and data-flow inventory.** Loombus must identify every AI provider, data sent, purpose, retention, model-training treatment, private-content treatment, human-review path, and correction mechanism before making strong public claims.
5. **Law-enforcement and emergency disclosure operations are not verified.** Public guidelines should not promise a specialized intake, preservation, emergency review, or response timetable until the process and responsible personnel exist.
6. **Commerce dispute and prohibited-product rules need one canonical taxonomy.** Existing safety pages and moderation tools are useful, but Marketplace, Services, Requests, Jobs, Events, Businesses, and Appointments need a unified prohibited-activity and commercial-integrity framework.
7. **Transparency reporting and policy version archives are not yet verified.** Effective dates can be displayed now, but a reliable archive, change log, enforcement-statistics process, and scheduled review owner must be created.
8. **Restricted Discussion media remains a known limitation.** Restricted Discussions are text-only because current Discussion media uses public Storage URLs. Public help and privacy language must state this until private attachment delivery is implemented.
9. **Room moderation resolution is not automatic enforcement.** The current Room moderation workflow records decisions and outcomes, but does not silently remove content or alter membership. Public policy must accurately distinguish case resolution from the separate action used to remove, suspend, or ban.
10. **Permanent Room deletion must not be described as immediate.** The implementation includes archive, recovery, billing, retention, legal-hold, manifest, retry, reconciliation, and feature-flag safeguards. The policy must explain the staged process without promising an instant purge.

## 5. Feature-to-policy verification matrix

### 5.1 Accounts, authentication, and account standing

| Item | Current contract | Safe claim | Do not claim yet | Required documents and work |
|---|---|---|---|---|
| Account creation | Supabase authentication supports email and connected providers. Profile and account-access checks protect application routes. | Loombus requires an account for member-only features and may require email verification. | That every provider behaves identically in every jurisdiction or device. | Account creation help, authentication-provider notice, production provider inventory. |
| Email verification | Unconfirmed email recovery and seven-day expiration logic were implemented; the intended confirmation window depends on Supabase configuration. | Unverified email accounts may be restricted or removed after notice and a defined period. | A 60-minute link lifetime unless the live Supabase setting is verified. | Email verification lifecycle article, production setting check. |
| Account standing | Warning, suspension, banned, deactivated, deletion-requested, and related states are enforced by route guards and administrative workflows. | Loombus may restrict access based on account standing. | A complete strike count, universal notice standard, or fixed duration for every violation. | Enforcement policy, notice standard, member enforcement-history surface. |
| Ban evasion | Private HMAC tombstones block exact reuse of banned email or provider identities without IP-based permanent identity. | Loombus may prevent a permanently banned person from recreating an account with the same verified identifier. | Device fingerprinting, household-wide bans, or IP-based permanent identity. | Ban evasion policy, privacy disclosure, legal review. |
| Account recovery | Existing authentication flows support recovery, but the complete support escalation path is not verified. | Members can use the provided authentication recovery controls. | Guaranteed restoration, identity-verification methods, or response times. | Recovery help article, support ownership and escalation process. |

Status: **Partially verified**. Product enforcement is strong, but notice, appeal, restoration, and support operations need one canonical contract.

### 5.2 Minimum age, teens, and minors

| Item | Current contract | Safe claim | Do not claim yet | Required work |
|---|---|---|---|---|
| Minimum age | Loombus has an age gate and has previously been designed for members 13 and older. | Loombus is not intended for children under the stated minimum age. | That age is independently verified for every member. | Confirm public minimum age, legal review, age-correction process. |
| Teen defaults | Some privacy and safety controls exist platform-wide. Teen-specific default values are not fully verified. | Teen members receive the same baseline account and content safety enforcement as other members. | Private-by-default teen accounts, hidden profiles, restricted discoverability, or adult-contact limits unless implemented. | Teen-default migration and settings contract. |
| Adult-to-teen contact | General blocks, messaging eligibility, mutual-connection rules, and reporting exist. Age-aware contact rules are not confirmed. | Teens may block and report unwanted contact. | Automated adult-to-teen messaging restrictions or guardian controls. | Age-aware messaging policy and enforcement. |
| Age assurance | No complete, active age-assurance system is verified. | Loombus may request age information where legally or operationally necessary. | Government-ID, facial-age estimation, parental consent, or guaranteed age verification. | Vendor decision, privacy impact assessment, legal review. |
| Rooms with minors | Classroom and youth-relevant Room models exist, with private admission and role controls. | Room owners and staff remain subject to Loombus-wide safety standards. | That Loombus verifies teachers, schools, guardians, or child-safety credentials. | Minors-in-Rooms standard, owner duties, escalation procedure. |

Status: **Implementation and legal gap**. Teen safety must be a dedicated program, not only a Help Center category.

### 5.3 Profiles, private accounts, discovery, follows, and viewers

| Item | Current contract | Safe claim | Limit or caveat | Documents |
|---|---|---|---|---|
| All-members directory | Signed-in members can browse active, discoverable members. Blocks and undiscoverable accounts are excluded. | Discoverable active members may appear in the member directory. | This is not an unrestricted public-web directory. | People directory help, discoverability policy. |
| Private accounts | New follows require approval; non-followers receive limited profile access. | Members may require approval before new followers receive normal private-profile access. | A private account does not automatically erase or retroactively restrict existing public Discussions. | Private account help, profile privacy article. |
| Discoverability | Members can leave People and person-search results while direct member links remain available in limited form. | Members may remove themselves from normal People and Search discovery. | “Invisible everywhere” or “impossible to find by direct link.” | Discoverability help, public-content policy. |
| Follow requests | Request, cancel, approve, and decline flows exist. | Private-account owners control new follower approvals. | No promise that every prior follower is re-reviewed when privacy changes. | Follow approval help. |
| Viewer identities | Profile and Discussion owners can see recent authenticated viewers; hidden identity appears as Private viewer; anonymous visitors remain aggregate-only. | Members can control whether their identity is shown for future eligible views. | Loombus cannot identify anonymous visitors, and 24-hour deduplication affects the record. | Viewer records privacy article, retention schedule. |
| Blocking | Blocks affect profiles, follows, search, viewer lists, and content access in defined contexts. | Blocking limits interaction and visibility across supported Loombus surfaces. | Absolute erasure of all historical references, legal records, or administrator access. | Blocking help and safety article. |

Status: **Verified product contract**, with privacy-retention and exact-surface documentation still required.

### 5.4 Discussions, Replies, visibility, and attachments

| Item | Current contract | Safe claim | Limit or caveat | Documents |
|---|---|---|---|---|
| Structured modes | Open Discussion, Debate, Research Question, and Problem Solving modes use validated metadata and templates. | Members can choose a structured mode suited to the conversation. | Modes do not guarantee accuracy, consensus, or expert review. | Four mode help articles and one overview. |
| Discussion Purpose | Optional. | Members may add a purpose to guide responses. | It is not required for publication. | Composer help. |
| Audience defaults | Future Discussion visibility is account-level and applied when a new Discussion is created. Existing Discussion visibility remains unchanged. | Members can set the default audience for future Discussions. | Changing the setting does not retroactively change old Discussions. | Audience help and privacy policy. |
| Restricted access | Database policies protect Discussion records, Replies, tags, summaries, metrics, bookmarks, reactions, and related indexed content. | Restricted Discussions are access-controlled at the data layer. | Access may change with follower, connection, block, and account-state changes where the audience is relationship-based. | Discussion privacy article. |
| Restricted attachments | Restricted public-platform Discussions are currently text-only because media delivery uses public URLs. | Attachments are available for Public Discussions under current rules. | Do not describe restricted Discussion media as private or supported. | Attachment limitation notice, roadmap gate. |
| Attachment types | Images, PDFs, MP4, MOV, and WebM are supported through one control, with plan, count, size, and duration limits. | Loombus validates supported file types and applies upload limits. | Validation does not prove the file is accurate, lawful, safe, or malware-free unless scanning is verified. | Attachment policy, Video Context help. |
| Edits and deletion | Owner and administrator actions use existing authorized APIs; soft-deletion and edit-window rules exist. | Eligible authors may edit or delete content through available controls. | Immediate removal from backups, audit records, reports, or legal preservation. | Content lifecycle and retention help. |
| Reporting and blocking | Discussion, Reply, and person reports are distinct, with block and relationship actions. | Members can report content, report a person, and block a person where the controls appear. | Report submission does not guarantee removal or a particular outcome. | Reporting guide and enforcement policy. |

Status: **Verified product contract**, with malware scanning, retention, appeals, and restricted-media limitations requiring explicit treatment.

### 5.5 Safety review, duplicate detection, and media review

| Item | Current contract | Safe claim | Limit or caveat | Documents |
|---|---|---|---|---|
| Pre-submit safety review | Composer and creation flows use safety checks and warning paths. | Loombus may warn members before publication when content appears to raise a safety concern. | Every violation is detected, or a warning means the content is approved. | Automated systems notice. |
| Duplicate screening | Idempotency and high-confidence duplicate screening exist across Discussions and major listing types. | Loombus may identify likely duplicate submissions and direct members to an existing record. | Automatic plagiarism determination, legal ownership determination, or broad semantic originality scoring. | Duplicate submission help. |
| Media fingerprints | Exact stored-byte hashing supports an administrator review queue for public-platform media; private Room media is excluded. | Loombus may identify exact copies of supported public media for operational review. | Perceptual matching, copyright ownership determination, or scanning of private Room files. | Media review notice, privacy disclosure. |
| Enforcement effect | Duplicate signals do not automatically remove content, suspend accounts, merge records, or alter ranking. | Signals are reviewed separately from enforcement. | That a match is proof of wrongdoing. | Enforcement and evidence standard. |

Status: **Verified with strict limitations**.

### 5.6 Private messages and notifications

| Item | Current contract | Safe claim | Limit or caveat | Documents |
|---|---|---|---|---|
| Messaging eligibility | Mutual-connection and relationship rules govern ordinary messaging. Blocks, account standing, and reporting remain active. | Not every member can message every other member. | Teen-specific restrictions or end-to-end encryption. | Messaging eligibility help and privacy notice. |
| Attachments | Private-message attachments exist with reporting and moderation support. | Supported attachments may be shared in private conversations. | Messages are not necessarily end-to-end encrypted and may be reviewed when reported or required for safety/legal reasons. | Private messages privacy article. |
| Read status and typing | Read and typing indicators exist. | Participants may see delivery-related interaction signals. | Exact real-time delivery guarantees. | Messaging indicators help. |
| Deleting and archiving | Conversation-level archive and delete controls exist. | Members may organize or remove conversations from their own interface. | Deleting a conversation from one account deletes all copies or legal records. | Message lifecycle help. |
| Notifications and push | Preference-controlled in-app and push delivery exists. Room notifications and digests use additional preferences. | Members can manage supported notification categories. | Guaranteed delivery, immediate delivery, or delivery when the device/vendor blocks it. | Notification help and vendor disclosure. |

Status: **Partially verified**. Encryption posture, message retention, safety access, and teen interaction rules need explicit confirmation.

### 5.7 Rooms, ownership, membership, and governance

| Item | Current contract | Safe claim | Limit or caveat | Documents |
|---|---|---|---|---|
| Private Room boundary | Active membership, role, plan, and module permissions are enforced server-side and through database policies. | Rooms are private workspaces available to authorized members. | That no Loombus administrator or service provider can ever access Room data for operations, security, law, or support. | Room privacy and access article. |
| Room models | Business Team, Resident/HOA, Classroom, Private Community, and Customer Support have model-specific language and workflows. | Room models provide tailored organization and workflow defaults. | Professional accreditation, educational compliance, HOA legal compliance, or employment-law compliance. | One guide per Room model. |
| Invitations and join requests | Invitation creation, revocation, redemption, capacity, domain, approval, and notification checks exist. | Room owners can control admission through invitations and approval settings. | Invitation possession always guarantees admission. | Room invitation help. |
| Roles | Owner, administrator, moderator, manager, staff, and member capabilities are bounded by the Room contract. | Roles determine available Room administration and moderation actions. | That a role creates employment, agency, fiduciary, or legal authority on behalf of Loombus. | Roles and permissions article. |
| Ownership transfer | Seven-day acceptance workflow and active-member protections exist. | Owners may transfer a Room through the supported acceptance process. | Immediate or unilateral transfer to any account. | Ownership transfer help and terms. |
| Member action | Suspension, reinstatement, removal, and role changes use protected actions and audit records. | Authorized Room staff may manage member access under Room and Loombus rules. | Room staff can override Loombus-wide safety standards or legal holds. | Room owner and moderator code. |
| Room policies | Rooms can publish policies and track acknowledgments. | Room-specific rules may supplement Loombus standards. | A Room rule can waive Loombus Terms, privacy obligations, or safety standards. | Room rules article. |

Status: **Verified product contract**. Legal classification and owner responsibility need careful drafting.

### 5.8 Room moderation, reports, evidence, and appeals

| Item | Current contract | Safe claim | Limit or caveat | Documents and gaps |
|---|---|---|---|---|
| Reports | Members and staff can file Room reports against supported targets. | Room reports create a private review record. | Every report results in enforcement. | Room reporting guide. |
| Evidence snapshots | Immutable evidence snapshots are captured for supported targets. | Loombus may preserve relevant reported content for review and audit. | Preservation of every external fact, deleted third-party record, or complete context. | Evidence and retention disclosure. |
| Assignment and escalation | Staff claim, assignment provenance, and high or urgent escalation exist. | Authorized Room staff can coordinate review and escalation. | Fixed response times without staffing commitments. | Moderator operations guide. |
| Resolution | Structured outcomes and reporter dispositions exist; internal notes are restricted. | Reporters may receive a disposition while sensitive internal details remain confidential. | That resolution automatically removes content or changes membership. | Explicit separation between case resolution and enforcement action. |
| Appeals | A canonical Room-level member appeal workflow is not fully verified. | Members may use available Room or Loombus support channels to challenge an action. | Formal appeal windows, independent reviewers, or restoration guarantees. | Build and document Room appeals. |

Status: **Partially verified**. The moderation case system is strong, but appeal and enforcement-action integration remain gaps.

### 5.9 Customer Support Rooms

| Item | Current contract | Safe claim | Limit or caveat | Documents |
|---|---|---|---|---|
| Case isolation | Author, authorized staff, and explicit active participants only; Room membership alone is insufficient. | Customer Support cases are isolated from ordinary Room members. | That the case is invisible to Loombus systems, vendors, or lawful access. | Customer Support Room privacy guide. |
| Attachments and Storage | Parent-case authorization extends to attachment metadata and private Storage access. | Case attachments follow the case access boundary. | That files are end-to-end encrypted. | File security and retention article. |
| Staff operations | Staff-only operational requests are non-toggleable for ordinary customers. | Shared support operations are restricted to authorized staff. | That all staff are employees of Loombus or professionally verified. | Customer Support role guide. |
| Notifications and digests | Customer case titles and summaries are sanitized from broad Room notifications and digests. | Loombus limits private case details in Room-wide notifications. | Zero metadata leakage under every vendor or device condition. | Notification privacy article. |

Status: **Verified product contract**, subject to production Storage and RLS verification.

### 5.10 Room retention, archive, deletion, and legal holds

| Item | Current contract | Safe claim | Limit or caveat | Documents |
|---|---|---|---|---|
| Archive and restore | Owners can archive and restore Rooms under defined conditions. | Archiving pauses ordinary Room access without immediately deleting all data. | Archive as a deletion substitute. | Room lifecycle help. |
| Deletion scheduling | Exact-name confirmation, recovery period, billing checks, ownership, legal holds, retention holds, and organization retention apply. | Room deletion is a staged process with recovery and safety checks. | Immediate deletion or guaranteed completion on a fixed day. | Room deletion policy. |
| Permanent deletion | Idempotent jobs, bounded object manifests, retries, Storage reconciliation, fresh billing verification, and atomic finalization exist behind a feature flag. | Eligible Rooms may be permanently deleted after required checks and processing. | That the feature is always enabled or that every vendor backup disappears immediately. | Production flag confirmation, backup-retention disclosure. |
| Legal and retention holds | Active holds block deletion. | Loombus may retain information required for safety, disputes, legal obligations, or authorized organization retention. | Unlimited retention without explanation. | Retention schedule and legal process policy. |
| Audit trail | Deletion state records survive Room deletion. | Loombus may retain limited audit and compliance records after content deletion. | That deletion removes every audit record. | Privacy and retention policy. |

Status: **Verified architecture, production confirmation required**.

### 5.11 Room subscriptions, Premium, and billing

| Item | Current contract | Safe claim | Limit or caveat | Documents |
|---|---|---|---|---|
| Room plans | Free, Starter, Pro, Business, Organization, Organization Plus, and sales-assisted Enterprise are defined. | Current displayed plan capacities and prices may be described subject to change and checkout confirmation. | Permanent price guarantees for new customers. | Room plan comparison and subscription terms. |
| Organization limits | Organization membership capacity is per Room; Room-count limits are separate. | Organization plans include the stated number of Rooms and per-Room member limits. | Treating capacity as one pooled organization total. | Organization terms. |
| Enterprise | New Enterprise access is sales-assisted; legacy Stripe subscriptions remain recognizable. | Enterprise terms, limits, onboarding, and pricing are set by custom agreement. | Self-service Enterprise checkout. | Enterprise inquiry and agreement process. |
| Upgrades and downgrades | Server-side plan changes, Stripe prorations, member/storage downgrade checks, cancellation, resumption, invoices, and portal access exist. | Plan changes may create prorations, and downgrades can be blocked by current usage. | Automatic refunds, universal proration outcomes, or immediate downgrade regardless of usage. | Billing help and subscription terms. |
| Grandfathered pricing | Current subscription price can be displayed from Stripe while new plan copy uses current prices. | Existing subscribers may retain a legacy price until they change plans or the agreement otherwise permits. | Indefinite grandfathering as a contractual guarantee unless approved. | Grandfathered pricing clause, legal review. |
| Refunds | A Refund Policy exists, but complete alignment with every Stripe, Apple, Room, and Enterprise flow needs review. | Refund eligibility follows the published policy and applicable law. | Automatic refunds or a uniform process across payment channels. | Rewrite and legal review of refund policy. |

Status: **Verified billing mechanics, legal review required**.

### 5.12 Search Everything, public indexing, and discoverability

| Item | Current contract | Safe claim | Limit or caveat | Documents |
|---|---|---|---|---|
| Unified index | Search uses derived documents from eligible source records and source-specific repair logic. | Search results derive from current eligible Loombus records. | Complete, real-time, or error-free indexing. | Search help and ranking overview. |
| Privacy filtering | Discussion audience, member discoverability, block, account-state, saved-item, and Room boundaries are enforced. | Search excludes content the viewer is not authorized to access under supported controls. | That every stale cache or external search engine instantly removes a changed record. | Search privacy article and deindexing process. |
| Public web indexing | Public pages and public records may be indexed; restricted content is excluded by Loombus. | Public content may be discoverable through Loombus and external search engines. | Guaranteed removal timing from third-party caches. | Public content and indexing policy. |
| Search repair | Administrators can repair derived index records without changing the source record. | Search maintenance does not itself rewrite the owning content. | Search repair as a content moderation decision. | Search operations disclosure. |

Status: **Verified product contract**, with external crawler and cache limitations requiring clear language.

### 5.13 AI assistance, summaries, Signal, and recommendation systems

| Item | Current contract | Safe claim | Limit or caveat | Required work |
|---|---|---|---|---|
| Grounded Search AI | Search AI uses returned Loombus sources and excludes private Room and saved-item content from its context. | Search AI is intended to answer from eligible Loombus search sources. | Perfect factual accuracy, complete source coverage, or absence of hallucinations. | AI limitations and correction article. |
| Composer assistance | AI guidance and safety review support writing and pre-submit review. | AI suggestions are optional assistance and do not replace the member's responsibility. | That AI approval guarantees policy compliance. | AI-assisted writing policy. |
| Discussion intelligence | Summary, Key Takeaways, What Changed, Disagreement Map, Conversation Map, Related Ideas, and related features exist or have defined product contracts. | Automated analysis may summarize and organize Discussion activity. | That summaries are neutral, complete, expert-reviewed, or authoritative. | One transparency article per feature family. |
| Signal score | Signal scoring is visible and affects product presentation. The complete current factor, weight, gaming, and appeal contract requires verification. | Signal is an automated platform indicator, not a measure of a person's worth. | Exact factors, weightings, or fairness guarantees until audited. | Signal scoring specification and public explanation. |
| Featured Signal | Home can display a recent Discussion and its attachments. Selection logic requires confirmation. | Loombus may highlight Discussions through Featured Signal. | Pure chronology, human curation, or a particular ranking factor unless verified. | Featured Signal selection article. |
| AI providers and retention | Paid OpenAI or other provider use has existed. A complete current production inventory is not in this matrix. | Loombus uses service providers to operate supported AI features. | No vendor retention, no model training, regional processing, or private-content exclusions without provider-specific proof. | AI data-flow inventory, DPIA, vendor terms, privacy disclosure. |
| Contesting automation | General support and reporting exist; a dedicated automated-decision challenge path is not verified. | Members may report incorrect AI output through available support controls. | A formal appeal process for every automated ranking or summary. | Automated-decision review workflow. |

Status: **Major transparency and operational gap**. Draft only after a current AI system inventory.

### 5.14 Local Discovery and location privacy

| Item | Current contract | Safe claim | Limit or caveat | Documents |
|---|---|---|---|---|
| Approximate locations | Browser coordinates are rounded server-side; public responses return distance and area labels, not coordinates. | Loombus uses approximate location anchors for supported Local results. | Exact geolocation privacy if another source record itself publishes an address. | Local privacy guide. |
| No background tracking | The Local release did not add background location tracking. | Loombus Local does not require continuous background location tracking under the current contract. | That no device, browser, or analytics provider ever receives location-related information. | Vendor and analytics inventory. |
| Residential protection | Personal Marketplace listings and Requests cannot become exact public points through Local anchors. | Loombus limits exact residential mapping in Local Discovery. | That user-entered text can never reveal a precise address. | Location-sharing safety standard. |
| Ranking | Local ranking excludes paid placement, sponsorship, follower count, and engagement popularity under the current contract. | Local relevance uses source eligibility, text, approximate distance, time, and freshness. | Permanent ranking rules or complete factor weights. | Local ranking overview. |

Status: **Verified product contract**, with input-content and vendor caveats.

### 5.15 Marketplace, Services, Requests, Jobs, Events, Businesses, and Appointments

| Area | Verified foundation | Policy gap |
|---|---|---|
| Marketplace | Seller drafts, images, publication review, reports, status actions, safety page, duplicate screening, exact-media review, and public detail guidance. | Canonical prohibited-items taxonomy, transaction disputes, recalls, counterfeit handling, age-restricted goods, seller removal, repeat-offender handling. |
| Services | Provider listings, attachments, inquiries, moderation, reporting, appointment links, safety guidance. | Credential claims, regulated professions, medical/legal/financial services, deposits, refunds, off-platform payment risk, insurance representations. |
| Requests | Public needs, responses, attachments, urgency, lifecycle, moderation, reports, safety guidance. | Dangerous requests, exploitation, labor classification, prohibited solicitation, emergency-service misuse. |
| Jobs | Employer attribution, compensation and deadline fields, moderation, reports, duplicate screening, application destinations. | Employment discrimination, recruitment fees, identity theft, misleading compensation, child labor, regulated roles, immigration claims. |
| Events | Organizer attribution, dates, locations, RSVP, moderation, reports, duplicate screening. | Dangerous events, ticketing, cancellations, minors, alcohol, weapons, accessibility representations, emergency plans. |
| Businesses | Ownership claims, verification, services, reports, moderation. | Meaning of “verified,” professional licensing, review manipulation, false address, franchise/brand impersonation. |
| Appointments | Provider/requester lifecycle, cancellation, administrator intervention, service attribution. | Payment boundary, professional relationship disclaimer, no-show disputes, emergency services, records retention. |

Safe platform-wide claim: Loombus provides discovery and communication tools, but does not automatically guarantee identity, credentials, legality, quality, payment, delivery, attendance, employment, professional outcomes, or transaction completion.

Status: **Feature contracts verified, policy taxonomy incomplete**.

### 5.16 Intelligent Matching

| Item | Current contract | Safe claim | Limit or caveat | Documents |
|---|---|---|---|---|
| Matching direction | Request-to-Service and Service-to-Request matching uses deterministic relevance factors and member preferences. | Matching is intended to surface potentially relevant opportunities. | Guaranteed fit, safety, quality, availability, or transaction success. | Matching overview and factor explanation. |
| Factors | Category, specialty, budget, timing, availability, local radius, and remote compatibility are documented in the feature contract. | Loombus considers disclosed compatibility signals. | Exact weights or permanent factors until implementation is audited. | Matching factors article. |
| User control | Members can pause, save, dismiss, restore, and provide feedback. | Members control supported matching preferences and candidate actions. | That feedback immediately changes the algorithm or guarantees human review. | Matching controls help. |
| Admin diagnostics | Administrators can view aggregate and candidate diagnostics but cannot manually change confidence under the current contract. | Operational review is distinct from member eligibility and matching control. | Manual approval or hidden paid placement. | Matching transparency article. |

Status: **Verified product contract**, with public factor and feedback documentation required.

### 5.17 Administrator moderation and platform operations

| Item | Current contract | Safe claim | Limit or caveat | Required work |
|---|---|---|---|---|
| Module queues | Marketplace, Businesses, Jobs, Events, Requests, Services, Rooms, and Appointments have protected operations modules. | Authorized Loombus administrators review supported reports, submissions, claims, and operational exceptions. | Universal review of every record before publication, unless the source module requires it. | Module-by-module moderation standards. |
| Actions | Approve, request changes, suspend, remove, resolve, dismiss, cancel, verify, and claim decisions vary by module. | Available actions depend on the record type and current state. | A uniform enforcement ladder across unrelated record types. | Enforcement action matrix. |
| Local, Matches, Search | These modules are primarily diagnostic and do not expose unsupported source mutations. | Diagnostic review does not itself rewrite source records. | Manual ranking manipulation or direct source editing from diagnostic panels. | Transparency article. |
| Private Rooms | Global Room administration excludes private content bodies and member workspaces from ordinary operational payloads. | Operational Room review is designed to minimize unnecessary private-content exposure. | That private Room content can never be accessed in a specific report, safety, support, legal, or security investigation. | Access minimization and audit policy. |
| Audit | Many administrator and Room actions record audit events. A complete unified audit-retention and member-access policy is not verified. | Loombus records supported administrative actions for security and accountability. | That members can access the entire internal audit trail. | Audit data policy and retention schedule. |

Status: **Partially verified**. Action-specific user notice, appeals, and consistency standards are the central gap.

### 5.18 Data rights, retention, deletion, and security

| Item | Current contract | Safe claim | Limit or caveat | Required work |
|---|---|---|---|---|
| Account deletion | Account controls and deletion-requested states exist; complete cross-module erasure orchestration is not verified here. | Members may request account deletion through supported controls. | Immediate deletion of every record, backup, report, invoice, legal hold, or third-party copy. | Cross-module deletion inventory and operational runbook. |
| Data export | Room export exists; a complete user-level export across all modules is not verified. | Room owners can export supported Room data where the control is provided. | Universal account-data portability until implemented. | Account export system and article. |
| Retention | Room-specific retention and deletion are mature. Platform-wide periods are not defined in one authoritative schedule. | Loombus retains information as needed for operation, security, disputes, legal duties, and supported user controls. | Precise periods without a data inventory. | Data map, retention schedule, vendor deletion map. |
| Security | RLS, service-role boundaries, protected routes, audit logs, private schemas, safe identifiers, and bounded operations are used throughout the system. | Loombus uses technical and organizational safeguards appropriate to the service. | Absolute security, breach prevention, end-to-end encryption, or compliance certifications not obtained. | Security overview, incident response plan, vendor inventory. |
| Incident notice | No complete public incident-notification process is verified. | Loombus will provide notices where required by applicable law. | A fixed notification time beyond legal requirements. | Incident response and legal review. |

Status: **Major privacy-program gap** despite strong technical controls.

### 5.19 Intellectual property and DMCA

| Item | Current contract | Safe claim | Limit or caveat | Documents |
|---|---|---|---|---|
| DMCA agent | Active designated agent information and registration number are public. | Copyright notices may be submitted through the published DMCA process. | That every dispute is valid or that Loombus adjudicates ownership. | DMCA notice and counter-notice guides. |
| User ownership | Current Terms and policy pages address user content, but the license language requires full legal review against every current feature. | Members retain rights they hold in their content while granting Loombus permissions needed to operate the service, subject to Terms. | Broad sublicensing or AI-training rights not expressly approved. | User content license policy. |
| Repeat infringement | A complete repeat-infringer operational workflow is not verified in this matrix. | Loombus may restrict accounts for repeated valid infringement. | Automatic strike counts or termination thresholds. | Repeat-infringer policy and case ledger. |
| Trademarks | A complete trademark complaint process should be separated from DMCA. | Trademark concerns may be reported through the designated legal/support process. | Treating trademark complaints as DMCA notices. | Trademark policy and form. |

Status: **DMCA foundation verified, broader IP operations incomplete**.

### 5.20 Accessibility and support

| Item | Current contract | Safe claim | Limit or caveat | Required work |
|---|---|---|---|---|
| Themes and responsive behavior | Light, Dark, System, mobile safe areas, keyboard/focus work, and accessibility hardening appear across many recent features. | Loombus is designed to support multiple appearances and responsive access. | Full WCAG conformance level without a formal audit. | Accessibility statement and audit plan. |
| Screen readers and keyboard | Specific components include semantics, focus restoration, live regions, and minimum targets. Platform-wide conformance is not verified. | Loombus works to support assistive technology. | Complete screen-reader coverage. | Route-level accessibility testing. |
| Support intake | `/api/contact` and support queue exist. | Members can contact support through the published channel. | Guaranteed response time or 24/7 coverage. | Support categories, ownership, severity, and service targets. |
| Safety escalation | Reporting exists, but emergency intake and crisis routing require formal operations. | Immediate danger should be directed to local emergency services. | That Loombus operates an emergency hotline. | Emergency reporting page and internal runbook. |

Status: **Partially verified**.

## 6. Claims that must be prohibited until verified

Public writers, product copy, support agents, and marketing material must not state any of the following unless a later verification record explicitly approves it:

- “Loombus verifies every user’s identity.”
- “Loombus content is completely private.”
- “Private messages are end-to-end encrypted.”
- “Deleted content is instantly erased everywhere.”
- “All reports are reviewed within a fixed number of hours.”
- “Every enforcement decision can be appealed” unless the universal appeal path exists.
- “AI providers do not retain or train on Loombus data” without provider-specific proof.
- “Loombus never reviews private content.”
- “Loombus guarantees the accuracy of AI summaries, Signal scores, listings, matches, credentials, jobs, services, events, or businesses.”
- “Verified business” means licensed, insured, background-checked, or government-approved unless the verification process actually confirms that fact.
- “Room deletion is immediate.”
- “Restricted Discussions support private attachments.”
- “Loombus protects minors through verified age checks” until age assurance exists.
- “Marketplace transactions are protected, insured, escrowed, or refundable by Loombus.”
- “Loombus complies with a named certification or regulated-industry framework” unless formally assessed and approved.

## 7. Required public document families

Loombus should maintain the following distinct families. They may share one search index and visual shell, but each article must show its type.

### 7.1 Binding legal documents

1. Terms of Service
2. Privacy Policy
3. Cookie and Similar Technologies Notice
4. U.S. State Privacy Notice
5. California Notice at Collection
6. Teen and Children’s Privacy Notice
7. Data Retention and Deletion Policy
8. User Content Ownership and License Policy
9. Copyright Policy
10. DMCA Notice Procedure
11. DMCA Counter-Notice Procedure
12. Repeat Infringer Policy
13. Trademark Policy
14. Acceptable Use Policy
15. Premium Subscription Terms
16. Room Subscription Terms
17. Organization Subscription Terms
18. Enterprise Agreement Overview
19. Refund Policy
20. Developer and API Terms
21. Public Content and Search Indexing Policy
22. Law-Enforcement Request Guidelines
23. Emergency Disclosure Guidelines
24. Accessibility Statement
25. Policy Version Archive

### 7.2 Community Standards

1. Standards overview and values
2. Human dignity and thoughtful participation
3. Harassment and bullying
4. Coordinated harassment
5. Hate and dehumanizing conduct
6. Threats and incitement
7. Glorification of violence
8. Violent or hateful organizations
9. Mass-violence perpetrators and manifestos
10. Graphic or disturbing content
11. Dangerous activities and challenges
12. Child sexual exploitation
13. Grooming and sexual solicitation of minors
14. Physical abuse of minors
15. Adult sexual exploitation
16. Non-consensual intimate imagery
17. Sexual content and nudity
18. Human trafficking and smuggling
19. Suicide and self-harm
20. Eating disorders and harmful body-image content
21. Doxxing and personal information
22. Impersonation and deceptive identity
23. Fraud and scams
24. Spam and unsolicited promotion
25. Coordinated manipulation
26. Fake engagement
27. Harmful misinformation
28. Election and civic-process integrity
29. AI-generated and manipulated media
30. Illegal and regulated goods
31. Weapons and dangerous products
32. Drugs, alcohol, nicotine, and controlled substances
33. Gambling and financial schemes
34. Malware, phishing, and account compromise
35. Intellectual-property violations
36. Unwanted commercial solicitation
37. Scraping, platform abuse, and circumvention
38. Off-platform conduct creating Loombus safety risk

### 7.3 Enforcement and procedural fairness

1. How Loombus moderation works
2. Automated detection and limitations
3. Human review
4. Pre-publication warnings
5. Member reports
6. Room reports
7. Commerce and listing reports
8. Emergency escalation
9. Content labels
10. Age restrictions
11. Recommendation and Featured Signal restrictions
12. Search restrictions
13. Content removal
14. Feature restrictions
15. Messaging restrictions
16. Temporary account restrictions
17. Account suspension
18. Permanent account removal
19. Severe first-offense violations
20. Repeat violations
21. Ban evasion and circumvention
22. Evidence preservation
23. Notices and reason statements
24. Appeals and re-review
25. Restoration of content, features, Rooms, or accounts
26. Public-interest and documentary exceptions
27. Government and legal removals
28. Transparency reporting

### 7.4 Teen Safety Center

1. Minimum age
2. Age declarations
3. Age correction
4. Age assurance
5. Teen privacy defaults
6. Teen account discovery
7. Teen profile visibility
8. Teen follower approvals
9. Teen messaging
10. Adult-to-teen interaction
11. Teen viewer-list protections
12. Teen attachment and Video Context protections
13. Location, school, and routine information
14. Grooming and sexual solicitation
15. Sensitive-content filtering
16. Self-harm support
17. Parent and guardian guidance
18. Reporting an underage account
19. Teen data access and deletion
20. Rooms containing minors
21. Classroom Room responsibilities
22. Law-enforcement and emergency escalation involving minors

### 7.5 Room governance

1. What a Room is
2. Room owner code
3. Room moderator code
4. Room member rights
5. Loombus-wide standards inside Rooms
6. Room rules and acknowledgments
7. Invitations and join requests
8. Roles and permissions
9. Ownership transfer
10. Member suspension, removal, and reinstatement
11. Room reports
12. Evidence and internal notes
13. Room moderation outcomes
14. Room appeals
15. Private Room confidentiality
16. Customer Support case privacy
17. Resident and HOA Rooms
18. Classroom and youth Rooms
19. Business and employee Rooms
20. Private Community Rooms
21. Organization administration
22. Announcements and notifications
23. Calendar and event responsibilities
24. Room resources and attachments
25. Retention settings
26. Legal and retention holds
27. Room export
28. Archive and restore
29. Room deletion and recovery
30. Abandoned Rooms
31. Room suspension by Loombus
32. Billing responsibility
33. Plan downgrade effects
34. Enterprise and organization duties

### 7.6 Product Help Center

The Help Center should contain dedicated articles for every supported action, organized into these categories:

- Getting started and authentication
- Profiles, privacy, People, follows, and viewers
- Discussions, modes, replies, audiences, attachments, and Video Context
- Signal, Featured Signal, summaries, maps, and recommendations
- Search Everything and Ask Loombus AI
- Private messages and notifications
- Rooms, models, admission, roles, governance, moderation, operations, Studio, calendar, resources, analytics, billing, lifecycle, and Enterprise
- Local Discovery and location controls
- Businesses and ownership claims
- Services and inquiries
- Requests and responses
- Jobs and applications
- Events and RSVP
- Marketplace and seller tools
- Appointments
- Intelligent Matching
- Premium and all subscription management
- Reports, blocks, account standing, and appeals
- Data access, export, correction, and deletion
- Mobile applications and push notifications
- Accessibility and troubleshooting
- Known issues, product changes, and policy changes

The mature target is approximately 240 to 270 total public documents and articles. The first release should not attempt to publish all of them simultaneously.

## 8. Required first-release corpus

The first public release should contain approximately 85 to 105 complete documents, not hundreds of empty placeholders.

### Priority 0: Must exist before Loombus presents the center as complete

- Terms of Service
- Privacy Policy
- Cookie Notice
- U.S. State Privacy Notice
- Teen Privacy Notice
- Data Retention and Deletion Policy
- Community Standards overview
- all severe-harm standards involving violence, hate, minors, exploitation, intimate imagery, self-harm, doxxing, fraud, malware, and regulated goods
- Enforcement and Appeals Policy
- Reporting Guide
- Account Restrictions and Permanent Removal
- Room Owner and Moderator Code
- Customer Support Room Privacy
- Marketplace Prohibited Items
- Jobs Integrity Standard
- Services and Professional Claims Standard
- Copyright and DMCA procedures
- Subscription and Refund Terms
- AI and Automated Systems Notice
- Signal and Recommendation Transparency
- Public Content and Search Indexing Policy
- Accessibility Statement
- Support and emergency-routing page

### Priority 1: Product-critical operational guidance

- private accounts and discoverability
- Discussion audiences and text-only restricted-media limitation
- viewer identities and Private viewer
- blocking and follow approvals
- private messages and reporting
- all Room plan, billing, downgrade, cancellation, deletion, retention, and ownership-transfer articles
- Local location privacy
- listing reports and moderation
- Intelligent Matching controls
- account deletion and data access
- authentication recovery

### Priority 2: Full feature education

- structured Discussion modes
- all AI summary and mapping features
- Room model guides
- Room Studio and operational modules
- notification and digest controls
- commerce management workflows
- mobile and accessibility troubleshooting
- detailed policy examples and related-article networks

## 9. Drafting standard

Every substantive behavioral or safety policy should use the same original Loombus structure:

1. Why this policy exists
2. Who and what it covers
3. Key definitions
4. What is allowed
5. What is restricted
6. What is prohibited
7. Detailed examples
8. Context and exceptions
9. How to report
10. How Loombus reviews reports
11. Possible outcomes
12. Notices
13. Appeals or other review options
14. Related controls
15. Related policies
16. Effective date
17. Revision history

Help articles should use:

1. What the feature does
2. Who can use it
3. Step-by-step instructions
4. Privacy and visibility consequences
5. Limits and plan requirements
6. Common errors
7. Safety considerations
8. Related settings
9. Related articles
10. Last reviewed date

Legal documents should not be forced into the behavioral-policy template. They require counsel-approved organization, definitions, jurisdictional terms, dispute provisions, and statutory notices.

## 10. Length and depth targets

These are drafting targets, not artificial minimums:

| Document type | Typical target |
|---|---:|
| Terms of Service | 7,000 to 14,000 words |
| Privacy Policy and regional notices | 8,000 to 16,000 words combined, plus jurisdiction-specific supplements |
| Community Standards overview | 2,000 to 4,000 words |
| Individual severe-harm standard | 1,200 to 2,500 words |
| Other individual conduct standard | 800 to 1,800 words |
| Enforcement and Appeals Policy | 3,500 to 7,000 words |
| Teen Safety framework | 4,000 to 8,000 words across overview and subarticles |
| Room Owner and Moderator Code | 3,000 to 6,000 words |
| AI and recommendation transparency | 3,000 to 6,000 words across feature-specific articles |
| Product help article | 400 to 1,200 words |
| Complex Room or billing help article | 800 to 1,800 words |

Length must come from definitions, examples, exceptions, procedures, and truthful feature explanations, not repeated legal boilerplate.

## 11. Originality rules

Competitor policies are coverage benchmarks only. Loombus must not copy their wording, headings, examples, order, taxonomies, definitions, or enforcement formulations.

Every Loombus document must be written around Loombus-specific concepts:

- signal over noise;
- structured Discussions;
- Discussion Purpose and modes;
- Signal, Featured Signal, and State of the Discussion;
- member privacy and private viewing;
- private Rooms and model-specific operations;
- Room owner and moderator duties;
- Local Discovery with approximate location;
- Search Everything and grounded AI;
- transparent, bounded automated systems;
- commerce without disruptive advertising;
- thoughtful participation and human dignity.

No competitor sentence should be used as a drafting seed. Definitions should be derived from Loombus product contracts and reviewed independently.

## 12. Publication architecture

The later implementation should follow the current Loombus system redesign.

Recommended routes:

- `/trust`
- `/help`
- `/safety`
- `/policies`
- `/community-standards`
- `/enforcement`
- `/teen-safety`
- `/rooms/governance`
- `/transparency`

Required interface elements:

- one prominent search surface;
- article-type labels such as Legal, Policy, Safety, Help, Room Governance, and Transparency;
- desktop left navigation and mobile accordion navigation;
- Jump to navigation inside long documents;
- accessible heading hierarchy;
- effective date and last-reviewed date;
- version history;
- related articles and related settings;
- report, appeal, contact, or emergency actions where relevant;
- printable legal views;
- Light, Dark, and System themes;
- mobile safe-area handling;
- no empty category pages presented as complete resources.

The content source should support versioned structured metadata rather than embedding hundreds of articles directly in one page component. The eventual architecture should define article ID, slug, title, summary, type, category, audience, effective date, last reviewed date, version, superseded version, owner, legal-review state, product dependencies, related routes, and search keywords.

## 13. Review and approval gates

No document should become public until all applicable owners approve it.

| Gate | Required review |
|---|---|
| Product accuracy | Product owner confirms current user-facing behavior and terminology. |
| Engineering accuracy | Engineer confirms APIs, database policies, Storage, billing, vendor, and lifecycle statements. |
| Safety operations | Moderator or safety owner confirms reporting, escalation, notice, evidence, and enforcement procedures. |
| Privacy and security | Privacy and security owner confirms data flow, access, retention, deletion, vendor, and incident claims. |
| Support operations | Support owner confirms intake channels, escalation, response language, and ownership. |
| Accessibility | Accessibility reviewer confirms article structure and UI behavior. |
| Legal | Qualified counsel reviews all contractual, privacy, IP, youth, regional, law-enforcement, billing, and regulated-commerce statements. |
| Executive approval | Loombus approves the final risk position and public commitments. |

Each approval should be recorded with date, reviewer, version, and unresolved conditions.

## 14. Policy governance after launch

Loombus should assign permanent document ownership:

- Legal documents: legal and executive owner
- Privacy and security: privacy/security owner
- Community Standards and enforcement: trust and safety owner
- Teen safety: child-safety and legal owner
- Rooms governance: Rooms product and safety owner
- AI transparency: AI product, privacy, and safety owner
- Commerce policies: module product and safety owners
- Help articles: product and support owners
- Accessibility: accessibility owner

Review cadence:

- severe-harm and enforcement policies: at least every six months and after material incidents;
- privacy, data, AI, and vendor disclosures: at least quarterly and after any provider or data-flow change;
- legal terms: at least annually and before material product or jurisdiction changes;
- billing and plan articles: before every pricing or entitlement deployment;
- Help Center articles: whenever the corresponding feature changes;
- emergency corrections: immediately, with a visible revision note where the change affects member rights or obligations.

## 15. Required engineering and operations work before drafting final claims

### Critical engineering gaps

1. Build one general account enforcement-history and notice surface.
2. Build a platform-wide appeal intake and status workflow, including content, account, Room, and listing decisions.
3. Define teen privacy defaults and age-aware messaging/discovery rules.
4. Decide and implement age assurance only where necessary, with privacy impact review.
5. Complete a user-level data export that covers every applicable module.
6. Complete cross-module account deletion orchestration and exception reporting.
7. Create a canonical retention schedule mapped to tables, Storage buckets, logs, backups, vendors, and legal holds.
8. Inventory all AI provider data flows and add provider-specific configuration checks.
9. Add policy version metadata and archive support.
10. Add report reason, enforcement reason, notice, appeal, and restoration consistency across administrator modules.
11. Implement private attachments for restricted Discussions before claiming restricted media privacy.
12. Confirm malware and harmful-file scanning posture or explicitly disclose that file-type validation is not malware scanning.
13. Add law-enforcement preservation and emergency-request case tracking if Loombus intends to publish dedicated procedures.

### Critical operational gaps

1. Assign a Trust and Safety owner.
2. Define report severity levels and escalation routing.
3. Define emergency and child-safety escalation.
4. Define standard reason codes and member notices.
5. Define appeal eligibility, deadline, reviewer independence, and restoration actions.
6. Define support and safety record retention.
7. Define repeat-offender and repeat-infringer review.
8. Define commerce prohibited-item ownership and legal escalation.
9. Define incident response, breach assessment, and legal notification.
10. Establish a quarterly policy review meeting and change log.

## 16. Delivery sequence

### Phase 1: Verification and internal specifications

- complete the table, Storage, vendor, AI, billing, and enforcement inventories;
- identify the authoritative source file or query for every public claim;
- assign owners and unresolved conditions;
- create internal definitions and reason codes;
- do not change public policy pages yet.

### Phase 2: Highest-priority drafting

Draft in this order:

1. Community Standards overview and severe-harm standards
2. Enforcement and Appeals Policy
3. Teen Safety Standards
4. Room Owner and Moderator Code
5. AI and Automated Systems Notice
6. Privacy Policy and retention supplements
7. Terms of Service
8. Subscription, Room, Organization, Enterprise, and Refund terms
9. Commerce integrity policies
10. Product Help Center articles

### Phase 3: Legal and operational review

- counsel review;
- safety operations review;
- privacy and security review;
- production behavior verification;
- support playbook creation;
- revision of any claim not supported by the product.

### Phase 4: System-redesign implementation

- build the versioned content system;
- build search, navigation, Jump to, article relationships, and revision history;
- preserve existing legal URLs through redirects or canonical routing;
- add analytics that do not record sensitive article-reading behavior beyond what is necessary;
- perform accessibility and mobile review;
- publish only approved documents.

### Phase 5: Ongoing transparency

- publish policy updates with effective dates;
- maintain superseded versions;
- publish enforcement and legal-request transparency when the underlying data is reliable;
- review major incidents and product changes against the matrix.

## 17. Definition of done for the policy system

The Loombus Trust, Safety, Policy, and Help Center is not complete merely because pages exist. It is complete only when:

- every current product family has accurate policy and help coverage;
- every public promise maps to a verified product or operational contract;
- users can understand what is allowed, prohibited, reported, reviewed, enforced, and appealable;
- Room owners and moderators understand their authority and limits;
- teens and guardians receive clear, age-appropriate protections and explanations;
- private and public content boundaries are explicit;
- AI, Signal, ranking, and recommendation systems are explained without overstating accuracy or neutrality;
- billing, cancellation, deletion, and retention consequences are understandable;
- legal and privacy rights are documented by jurisdiction where required;
- the content is searchable, accessible, versioned, owned, reviewed, and kept current;
- Loombus can produce the internal evidence supporting each material statement.

## 18. Immediate next drafting package

After the remaining verification tasks are assigned, the first drafting package should contain:

1. Community Standards overview
2. Harassment and Bullying
3. Hate and Dehumanizing Conduct
4. Threats, Violence, and Dangerous Organizations
5. Child Safety and Sexual Exploitation
6. Non-consensual Intimate Imagery
7. Suicide and Self-Harm
8. Doxxing and Personal Information
9. Fraud, Spam, and Coordinated Manipulation
10. Illegal and Regulated Goods
11. AI-generated and Manipulated Media
12. Enforcement and Appeals Policy
13. Reporting Guide
14. Room Owner and Moderator Code
15. Teen Safety overview
16. AI and Automated Systems Notice
17. Public Content and Search Indexing Policy
18. Marketplace Prohibited Items
19. Jobs Integrity Standard
20. Services and Professional Claims Standard

This package should be reviewed as one coherent safety and governance system before it is converted into public pages.
