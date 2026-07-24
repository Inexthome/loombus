# Rooms Entitlement Repair Order

This document records implementation constraints that must remain true while the Rooms architecture is repaired.

## Product boundary

Room discussions do not use the public Loombus Topic taxonomy.

A Room already defines the audience and context. Room discussions may use the shared discussion modes, but they must not require `topic`, `reality_lens`, or `purpose_lane`.

Room discussion fields:

- `discussion_type`
- `discussion_metadata`
- `status`
- `resolved_at`
- `resolved_by`
- `last_activity_at`
- `reply_count`

## Threaded discussion contract

Room discussions use one level of replies rather than nested reply trees. The four supported modes are Open Discussion, Debate, Research Question, and Problem Solving.

The following rules are part of the product and authorization contract:

- discussion-mode keys and metadata are parsed by the shared server validator
- unsupported metadata keys and nested metadata values are rejected
- Room discussions are ordered by `last_activity_at`
- per-member read markers determine unread thread activity
- resolved discussions reject new replies until reopened
- the discussion author or authorized Room staff may resolve or reopen a thread
- the discussion or reply author and Room moderation may soft-delete their content
- active Room membership is required to read threads and replies
- reply writes use the authenticated service route rather than direct client inserts
- the legacy flat Room post creation path must remain closed

## Load-bearing release sequence

The order below is a correctness constraint, not a preference.

1. Separate core Room admission from the paid operational Requests module.
2. Make basic invitation creation and redemption available to Free Rooms.
3. Keep access-request submission and approval available to Free Rooms.
4. Confirm Free Room admission end to end.
5. Only then close legacy mutation paths that bypass module entitlements.

Closing the legacy entitlement bypass before Free admission works would leave Free Rooms without a reliable member-admission path.

A change that tightens legacy entitlement enforcement must not merge unless the Free admission path is already deployed or included in the same branch.

## Core admission versus operational Requests

These are different product contracts:

- Core admission covers invitation links, access requests, approval, rejection, capacity checks, and member removal.
- The paid Requests module covers structured operational requests inside an established Room.

Core admission must never depend on the paid Requests module.

## Invitation delivery contract

Invitation delivery is part of core Room admission and is available to Free Rooms.

- invitation creation returns a one-time plaintext URL while the database stores only its hash
- the interface must never claim that a link was copied unless a clipboard operation actually succeeds
- a newly generated URL remains visibly selectable so clipboard restrictions cannot destroy the invitation handoff
- `/rooms` accepts either the complete Loombus invitation URL or its raw token and forwards it to the canonical join flow
- clicking or pasting an invitation must use the same authenticated server redemption endpoint
- revocation, expiration, usage limits, Room capacity, email-domain restrictions, and approval requirements remain server-enforced

## Billing grace behavior

`past_due` is a retryable billing state and must not immediately collapse a paid Room to Free access.

During the grace state:

- existing Room content remains readable
- existing files remain downloadable
- existing members retain access
- no automatic member removal occurs
- no automatic file deletion occurs
- the owner receives a billing warning and recovery path

Future work may separately restrict new paid-only creation during grace, but read access and export access must remain intact.

## Member-limit reconciliation

Every Room subscription change must update `member_limit` from the resolved Stripe price and plan.

On downgrade below the current active-member count:

- existing members retain access
- new invitations and approvals are blocked at capacity
- the owner sees the over-capacity amount
- Loombus does not automatically choose members for removal

## Required Room-type behaviors

Room-type defaults and required behaviors are different:

- `defaultSettings` may be changed by the owner
- `recommendedModules` may be enabled or disabled when permitted by the plan
- `requiredBehaviors` are enforced by server authorization and database policy and cannot be disabled

## Customer Support isolation contract

Customer Support Rooms implement `private_support_threads` as a required behavior.

- every support case uses `author_and_staff` visibility
- the case author and active Room owners, administrators, and moderators always have access
- ordinary Room membership alone does not grant access to another customer’s case
- authorized support staff may add or remove active Room members as explicit case participants
- suspended, blocked, removed, and inactive members are excluded from case participation and notifications
- case replies, read markers, notifications, attachment metadata, and private Storage objects inherit the parent case authorization boundary
- customer case creation and replies cannot be disabled through `allowMemberPosts`
- historical private cases cannot be widened by later post updates
- a Customer Support Room cannot be converted to a shared Room type through an ordinary Room-type update
- underscore, hyphenated, spaced, and case-variant Customer Support type values resolve to the same database behavior

Any future conversion away from Customer Support must use an explicit reviewed migration that preserves or deliberately reassigns every private case before changing the Room type.

## Validation rules

Plan and module key validation must use an own-property check or a fixed Set. JavaScript's `in` operator must not be used for authorization or entitlement key validation because it accepts inherited prototype properties.

## Admission and operational requests contract

Membership admission and operational requests are separate product systems.

- `Invites / Join Requests` owns invitation creation, revocation, pending membership applications, approval, rejection, capacity checks, and admission notifications on every Room plan.
- The paid `Requests` module never reads or mutates `room_applications`.
- Starter-or-higher Room members may submit operational requests backed by `room_module_records` with the `request` module key.
- Operational requests record the requester, category, priority, assignment, target date, and workflow status.
- Room owners and administrators may assign requests and control their validated workflow status.
- Assigned members may move their requests through open, in-progress, waiting, and completed states.
- Request authors may cancel their own still-open requests.
- New operational requests notify active Room managers, and request updates notify active requesters and assignees.

## Admission and request production verification

A release that changes either workflow must be tested with separate member and manager accounts.

1. In a Free Room with approval enabled, redeem an invitation and confirm the application appears only in `Invites / Join Requests`.
2. Approve the application, confirm capacity enforcement, confirm the applicant notification, and verify Room access.
3. In a Starter-or-higher Room, submit an operational request as an ordinary member and confirm active managers are notified.
4. Assign the request, move it through in-progress and waiting states, then complete it and confirm requester and assignee notifications.
5. Confirm the request author can cancel a still-open request, including when the author is also the assignee.
6. Confirm the paid `Requests` module never displays or reviews membership applications.
7. Confirm Free Rooms do not expose the paid `Requests` module.

## Room model workflow contract

Room models share the same private infrastructure, but they do not present one generic workspace.

- Business Team Rooms use decision, work-request, task, milestone, resource, and team-update language.
- Resident / HOA Rooms use maintenance, safety, governance, notice, meeting, document, and resident-decision workflows.
- Classroom Rooms use assignment, attendance, accommodation, course-resource, schedule, submission, and class-announcement workflows.
- Private Community Rooms use event, volunteer, membership, resource, partnership, poll, and member-update workflows.
- Customer Support Rooms keep private support cases and restrict the paid operational Requests module to Room staff.

Model defaults are recommendations applied when a setting has not been saved yet. Owners may change optional settings. Required behaviors remain server-enforced and cannot be disabled. Request categories, module labels, module descriptions, notifications, and builder summaries must resolve from the same shared model profile contract.

## Room billing management contract

Room billing is owner-only and must remain separate from ordinary Room administration.

- the Room owner may view the active plan, subscription state, renewal date, usage, and invoices
- payment-method changes and hosted invoice management use the Stripe Customer Portal
- Free Room upgrades create a Stripe subscription for the existing Room rather than provisioning a duplicate Room
- paid plan changes occur through authenticated server actions and update Stripe subscription metadata
- paid downgrades are rejected when active membership or stored files exceed the target plan allowance
- cancellation to Free is rejected until the Room satisfies Free membership and storage limits
- cancellation is scheduled for the end of the paid period and may be resumed before that date
- inactive paid subscriptions resolve to effective Free entitlements without deleting Room content or choosing members for removal
- every upgrade, plan change, cancellation schedule, and resumption is written to the audit log
- no client-provided Stripe customer, subscription, item, or price identifier is trusted

## Room billing production verification

1. Open Billing as the Room owner and confirm a non-owner receives an authorization error.
2. Upgrade an existing Free Room and confirm checkout returns to the same Room id.
3. Change between paid plans and confirm the plan, member limit, renewal date, and Stripe invoice state refresh.
4. Attempt a downgrade below active-member capacity and confirm the server rejects it.
5. Attempt a downgrade below stored-file capacity and confirm the server rejects it.
6. Open the Stripe portal, update the payment method, and confirm recent invoices remain accessible.
7. Schedule cancellation and confirm paid access remains until the period end.
8. Resume before period end and confirm the cancellation flag clears.
9. Confirm cancellation to Free is blocked while the Room exceeds Free member or storage limits.
10. After a subscription becomes inactive, confirm the Room uses effective Free entitlements without deleting content.
