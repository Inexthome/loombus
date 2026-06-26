# Loombus V2 Parity and Completion Audit

Status: audit baseline after PR #121
Scope: identify what V1 already has, what V2 already has, what is missing from V2, and what should be redesigned as V2-native before public rollout.

## Rollout principle

V2 must remain behind feature flags until the full discussion lifecycle is ready and manually tested.

Production safety rules:

- `/create` remains V1 until V2 Create is fully tested.
- `/discussions` remains V1 until V2 feed parity is fully tested.
- `/discussions/[id]` remains V1 until V2 detail parity is fully tested.
- Public navigation remains V1 until the V2 shell has parity for the core user journey.
- V2 final storage must not create rows in the live V1 `discussions` table.
- V2 publish/storage remains blocked until explicitly opened for internal testing.

## Current V2 baseline

### Already in V2

- Feature-gated V2 shell access through `v2_shell`.
- V2 Home shell with metrics and recent activity cards.
- V2 Create preview with one private autosaved draft.
- V2 Create review/readiness/confirm flow.
- V2 finalizer points to `loombus_v2_discussions`, not the live V1 feed.
- V2 finalizer has code-level storage disabled with `V2_CREATE_FINAL_WRITE_ENABLED = false`.
- V2 preview discussion storage table exists: `loombus_v2_discussions`.
- Private V2 discussion preview list and detail pages read `loombus_v2_discussions` only.

### Intentionally not live yet

- V2 Create does not publish live.
- V2 Preview Store does not replace V1 feed.
- V2 detail page does not replace V1 discussion detail.
- V2 routes are internal testing surfaces, not public rollout surfaces.

## V1 discussion feed inventory

V1 `/discussions` currently includes:

- Live `discussions` table feed.
- Deleted discussion filtering.
- Author profile loading.
- User block filtering.
- Following feed support.
- Reply count loading.
- Latest reply date loading.
- View count loading from `discussion_views`.
- Bookmark/save count loading from `bookmarks`.
- Discussion tags from `discussion_tags`.
- Topic filters.
- Purpose lane filters.
- URL query sync for topic and purpose.
- Sort modes including newest, most replied, and signal.
- Feed modes: all, following, signal.
- Advanced filters: all activity, has replies, has saves, high signal, recently active.
- Premium/admin advanced filter access gating.
- Topic discovery descriptions.
- Mobile discussion feed events.
- Sticky discussion integration for eligible users.
- Persistent filter drawer state.
- Limited formatting/body rendering.

## V2 discussion feed parity

Current V2 `/v2/discussions` includes:

- Signed-in access check.
- `v2_shell` access gate.
- Reads only `loombus_v2_discussions`.
- Empty state while V2 final storage is closed.
- Basic record cards: title, topic, mode, tags, status, created date, excerpt.
- Links to `/v2/discussions/[id]`.

Missing from V2 feed:

- V1 live feed parity surface for internal testing.
- Author profile display.
- Block filtering for shared/public V2 records.
- Following feed.
- Reply counts.
- Latest reply activity.
- View counts.
- Save counts.
- Tags sourced from a relational V2 tag table.
- Topic filters.
- Purpose lane filters.
- URL query sync.
- Sort modes.
- Feed modes.
- Advanced premium filters.
- Topic discovery.
- Stickies.
- Search/filter within feed.
- Public-ready responsive feed layout.
- Loading skeletons beyond simple gate cards.

V2-native recommendation:

- Build a V2 internal feed using a new API that can read either V2 records or a safe V1 parity adapter during development.
- Keep `/v2/discussions` as the eventual V2 feed.
- Add a separate internal diagnostic route for V1 comparison if needed, such as `/v2/audit/discussion-parity`.

## V1 Create inventory

V1 `/create` currently includes:

- Title, topic, body.
- Reality Lens.
- Purpose Lane.
- Discussion modes: open discussion, debate, research question, problem solving.
- Structured mode metadata fields.
- Tags.
- Profile completion gate.
- Account enforcement gate.
- Premium/admin feature gates.
- Long post limits.
- Draft support for eligible users.
- Edit existing discussion support.
- Edit window messaging.
- Similar discussion memory.
- Topic recommendation.
- Rich/limited formatting editor.
- Copy/paste usage limits.
- Quality check AI tool.
- Clarity rewrite AI tool.
- Safety warning modal.
- Moderation/safety API enforcement.
- Images/PDF attachments.
- Video Context upload support and plan limits.
- Attachment size and MIME validation.
- Upload to `discussion-attachments` bucket.
- Create API write to V1 `discussions`.
- Tags written to `discussion_tags`.
- Audit log on create.
- Follower notifications.
- Topic alert notifications.

## V2 Create parity

Current V2 Create includes:

- Title, topic, body.
- Tags as comma-separated text.
- Discussion mode selection.
- Private V2 draft autosave.
- Draft restore.
- Draft clear.
- Readiness check.
- Review/confirm flow.
- V2 preview final storage target.
- Rollback guard.

Missing from V2 Create:

- Official topic selector using `DISCUSSION_TOPICS` instead of free text.
- Reality Lens.
- Purpose Lane.
- Structured metadata fields for debate/research/problem-solving.
- Profile completion gate matching V1.
- Account enforcement gate matching V1.
- Premium/admin feature gates.
- Standard/long post limits.
- Edit existing discussion flow.
- Edit window rules.
- Similar discussion memory.
- Topic recommendation.
- Rich/limited formatting editor.
- Copy/paste limit tracking.
- Quality check AI tool.
- Clarity rewrite AI tool.
- Safety warning modal.
- Server-side moderation before storage.
- Attachments.
- Video Context plan limits and upload flow.
- Tag normalization shared with V1.
- Audit logging.
- Notifications.
- Draft version/history behavior.
- True publish workflow into either V2-only public records or a controlled V1 bridge.

V2-native recommendation:

- Do not copy V1 Create as-is.
- Build V2 Create as a staged composer: intent, structure, context, evidence, attachments, review, final storage.
- Keep all final storage blocked until the V2 detail/reply lifecycle is complete.

## V1 discussion detail inventory

V1 `/discussions/[id]` currently includes:

- Live discussion load.
- Author profile load.
- Replies load.
- Related discussions by topic.
- Tags.
- Attachments.
- Video Context display.
- View tracking through `/api/discussions/view`.
- Saved/bookmark state.
- Save folders/collections.
- Stickies.
- Discussion report state.
- Reply report state.
- Reply reactions.
- Mention rendering.
- Reply reference/quote preview.
- Reply creation.
- Reply edit/delete.
- Discussion edit metadata display.
- Reply edit metadata display.
- Discussion status open/resolved.
- Pin reply support.
- Structured discussion sections.
- Block filtering.
- Viewer identity status.
- Admin affordances.
- AI entitlements.
- AI tools: summary, key takeaways, what changed, disagreement map, conversation map, related ideas.
- AI output ratings.
- Monthly AI usage counts.
- Safety warning modal.
- Report reasons.
- Profile links and avatars.

## V2 discussion detail parity

Current V2 `/v2/discussions/[id]` includes:

- Signed-in access check.
- `v2_shell` access gate.
- Reads `loombus_v2_discussions` by id for current author only.
- Title, topic, mode, tags, status, body, created/updated metadata.
- No public replies or engagement yet.

Missing from V2 detail:

- Public/shared visibility model.
- Author profile card.
- Reply system.
- Reply create/edit/delete.
- Reply reactions.
- Reply quotes/references.
- Mention rendering.
- Attachments and Video Context rendering.
- View tracking.
- Save/bookmark/folders.
- Stickies.
- Report discussion/reply.
- Moderation hooks.
- Discussion status/resolved flow.
- Pin reply.
- Related discussions.
- Structured mode sections.
- AI tools and ratings.
- AI usage limits.
- Admin affordances.
- Block filtering.

V2-native recommendation:

- Build V2 detail around a clearer lifecycle: preview, internal review, published, archived.
- Add replies only after V2 records have a stable visibility/status model.
- Add AI tools after replies and status are stable.

## Cross-cutting V1 systems not fully moved to V2

- Notifications.
- Push notification triggers.
- Topic alerts.
- User blocks across all V2 reads.
- Saved/bookmarks/folders.
- Stickies.
- Reports and moderation queue integration.
- Admin audit logging.
- Account enforcement gates.
- Profile completion gates.
- Subscription plan limits.
- Attachment storage policies.
- Video Context monthly limits.
- AI usage counters and ratings.
- Search/global overlay integration.
- People/profile integration.
- Mobile bottom navigation integration.
- SEO/public metadata decision for V2 public routes.

## Proposed V2 build sequence

### Phase 1 — Audit and architecture lock

- Keep this audit document updated.
- Decide whether V2 public records should use `loombus_v2_discussions` permanently or migrate into the existing `discussions` table with a V2 schema extension.
- Add V2 status model and transition rules.
- Add V2 access/visibility model.

### Phase 2 — V2 Create parity

- Add official topic selector.
- Add Reality Lens and Purpose Lane.
- Add structured mode metadata fields.
- Add shared tag normalization.
- Add profile/account gates.
- Add length limits and premium gates.
- Add safety/moderation preflight.
- Add attachments and Video Context support.
- Keep final storage internal-only.

### Phase 3 — V2 Detail lifecycle

- Add author profile card.
- Add structured discussion sections.
- Add attachments display.
- Add status display.
- Add view tracking for V2 records.
- Add save/bookmark support for V2 records or a polymorphic saved-items model.
- Add report hooks.

### Phase 4 — V2 Replies and engagement

- Add V2 replies table or polymorphic replies.
- Add reply create/edit/delete.
- Add reply quotes/references.
- Add reply reactions.
- Add pin reply.
- Add latest activity and reply counts.

### Phase 5 — V2 Feed parity

- Add author profiles.
- Add filter/sort/feed modes.
- Add following feed.
- Add signal scoring.
- Add topic discovery.
- Add stickies.
- Add V2 metrics refresh events.

### Phase 6 — AI and premium tools

- Add summary.
- Add key takeaways.
- Add what changed.
- Add disagreement map.
- Add conversation map.
- Add related ideas.
- Add AI output ratings.
- Add usage accounting and plan gates.

### Phase 7 — Notifications/search/mobile integration

- Add V2 notification events.
- Add topic alerts.
- Add push notification wiring.
- Add V2 records to global search.
- Add mobile nav routing behind flags.
- Add internal rollout dashboard.

### Phase 8 — Release readiness

- Internal owner test.
- Admin test.
- Signed-out gate test.
- Non-allowlisted gate test.
- Mobile web test.
- iOS/Android shell test.
- V1 rollback test.
- Vercel production smoke test.
- Supabase RLS review.

## Release blockers

Do not release V2 publicly until these are complete:

- V2 Create can store safely.
- V2 Detail can show the stored record correctly.
- V2 Reply lifecycle works.
- V2 Feed has author, filter, sort, metrics, and safety parity.
- V2 save/report/block/moderation integrations work.
- V2 public navigation can be rolled back instantly.
- You have completed manual testing on web and mobile.

## Immediate next build recommendation

Next PR should not be a large all-in-one V2 build. It should be:

1. Add V2 status/visibility model to `loombus_v2_discussions` if needed.
2. Add V2 Create missing metadata fields: official topic selector, Reality Lens, Purpose Lane, structured metadata.
3. Add shared server validation for V2 storage, reusing V1 gates where safe.
4. Keep `V2_CREATE_FINAL_WRITE_ENABLED = false` until the detail/reply lifecycle is ready.
