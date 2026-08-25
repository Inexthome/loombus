# Issue #671 Phase L: Public change-note presentation

## Purpose

Present the existing public `changeNote` field consistently on registry-managed current policy pages, exact-version archives, and public version history without exposing internal review or publication metadata.

## Existing data contract preserved

The policy registry already stores `changeNote` on version records. This phase does not create, rewrite, approve, or infer change notes. It only presents the value from a version that has already passed the applicable public resolver.

## Presentation behavior

- Current registry-managed policy route: show a `What changed` callout when the resolved current version has a non-empty `changeNote`, with a link to public version history.
- Exact archive route: show the exact version's `changeNote` when non-empty, with a link to public version history.
- Public history: label each existing public change note as `What changed`.
- Empty or whitespace-only notes render nothing.

## Safety boundary

The presentation layer receives only `version.changeNote` from already-resolved public effective or superseded versions. It does not display or derive:

- approval records or reviewer identities;
- approval/source-revision evidence;
- publication blockers;
- dependency notes;
- internal review notes;
- authorization comments;
- draft, review, approved-only, or future non-effective versions.

No HTML injection is used. Change notes render as normal React text.

## Explicitly unchanged

This phase does not change:

- policy wording or structured payloads;
- `policy-content-registry.data.json`;
- version statuses, effective dates, approvals, source revisions, blockers, or archive identities;
- scheduled-effective-date runtime behavior;
- Supabase;
- Issue #667/#670/#674 authorities;
- first-20-draft import/scaling.

## Manual preview review before merge

1. `/accessibility` shows a `What changed` callout containing the current version's existing public change note and a `View version history` link.
2. `/policies/history/POLICY-ACCESSIBILITY` labels both available change notes as `What changed` while preserving current/superseded version ordering.
3. `/policies/archive/POLICY-ACCESSIBILITY/2026.08.10.1` shows the current version's exact change note.
4. `/policies/archive/POLICY-ACCESSIBILITY/2026.07.18.1` shows the predecessor's exact change note.
5. Keyboard focus is visible on version-history links and mobile/narrow layout has no new page-level horizontal overflow.
6. Light, Dark, and System remain readable.
7. No reviewer names, approval records, source revisions, publication blockers, dependency notes, or internal review notes appear in the change-note callouts.
