# Loombus Library data foundation

This phase adds the persistent database contract behind the Library visual foundation merged in PR #884.

## Included

- `library_publications`: publication metadata only
- `library_member_items`: a member's personal Library membership
- `library_reading_progress`: private position/progress state
- `library_highlights`: private selected passages
- `library_notes`: private notes, optionally bound to a member-owned highlight
- Row Level Security on every Library table
- anonymous access revoked from every Library table
- published-only publication discovery for authenticated members
- owner-only access for personal Library state
- static CI verification of these boundaries

## Explicitly not enabled

This phase does not add or authorize:

- ebook, EPUB, or PDF uploads
- Supabase Storage buckets or objects
- paid books or marketplace checkout
- Stripe integration
- DRM or entitlement enforcement
- author self-publishing
- public/shared highlights or notes
- passage-to-discussion persistence
- Ask Loombus or other AI execution
- content ingestion or parsing

## Privacy boundary

Reading progress, personal Library membership, highlights, and notes are private to the authenticated member by default. A later social-reading phase must introduce a separate explicit sharing boundary rather than reusing private annotation rows as public content.

## Publication boundary

`library_publications` is metadata, not the publication file/body. Authenticated client reads are restricted to records whose status is `published`. Draft and archived metadata remain inaccessible through the member client role.

## Next phase

After migration deployment and RLS verification, the next narrow phase can wire `/library` to these tables and make My Library, Continue Reading, Highlights, and Notes functional using metadata/test fixtures only. Uploads, commerce, DRM, author publishing, and AI should remain separate later phases.

<!-- PR refresh: deployment retrigger only; no Library behavior or data-contract change. -->
