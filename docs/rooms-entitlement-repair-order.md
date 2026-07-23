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
- the discussion author or Room management may resolve or reopen a thread
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

A future customer-support isolation contract must be a required behavior, not a toggle. Until author-and-staff isolation exists, the product must be presented as a shared Customer Community Room rather than a private customer-ticket Room.

## Validation rules

Plan and module key validation must use an own-property check or a fixed Set. JavaScript's `in` operator must not be used for authorization or entitlement key validation because it accepts inherited prototype properties.
