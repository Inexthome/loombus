# Issue #671 Phase J: Public Policy and Help Discovery

## Purpose

Add one unified public discovery surface for Loombus Help guidance and current public policy, safety, legal, and reference documents without creating a second Help Center or weakening the policy publication gate.

Baseline: merged/deployed PR #891 at `937d9773f98102fb449d0dbfeb61eea80a4f38ea`.

## Existing surfaces preserved

- `/support` remains the canonical Help & Support Center.
- `SupportV2Client` remains responsible for the structured support-request form and its existing signed-in/signed-out account context.
- `/search` remains the platform-wide Everything Search. This phase does not change its ranking, indexed-content privacy controls, or AI behavior.
- Existing public policy routes remain canonical.

## Shared Help catalog

`src/lib/public-help-catalog.ts` extracts the existing Help-area and Help-article search material into a serializable shared catalog. This removes the need for the new discovery UI to invent a second Help taxonomy.

The catalog contains only public navigation/help metadata. It contains no account context, member data, private-room content, support-request body, or analytics identifier.

## Public policy discovery boundary

`src/lib/policy-content-public-discovery.ts` is server-only.

For a `registry_managed` document family, discovery calls `resolvePolicyCurrentVersionFromRegistry(...)`. A document therefore appears only when the same current-version resolver used by the publication system finds exactly one publication-eligible effective version.

The resolver already fails closed for, among other states:

- `publicReady: false`;
- non-public audience;
- non-effective status;
- missing, invalid, or future `effectiveAt`;
- missing or non-approved required reviewer state;
- approval/source-revision mismatch;
- active publication blockers;
- multiple eligible effective versions.

For `legacy_public_route` families, discovery may reuse only an exact canonical route already present in `PLATFORM_ROUTE_REGISTRY`. This preserves the existing public source of truth while those pages have not migrated to registry-managed serving.

`registry_candidate` families are not current public discovery inputs. A candidate can therefore be reviewed without becoming a searchable current document through this adapter.

The public discovery payload intentionally contains only:

- document ID;
- current title;
- current public summary/description;
- canonical route;
- display category;
- public search keywords.

It does not expose approval records, reviewer identities, source revisions, publication blockers, change notes, internal review notes, or historical versions.

## Unified Support search

`/support` now searches from one input across:

1. Help areas;
2. Help articles;
3. server-derived current public policy/trust documents.

The same query and selected category filter all three groups.

## Category navigation

The Support hero includes semantic category navigation with `aria-pressed` buttons. Available categories are derived from the public corpus, beginning with `All` and `Help` and adding the public policy categories that currently exist.

The controls wrap on wider layouts and become a contained horizontal navigation strip on narrow layouts. The page itself must not gain horizontal overflow.

Keyboard focus uses the Loombus Gold focus treatment.

## Support form preservation

The previous Support discovery shell is hidden only inside a scoped `support-policy-contact-only` wrapper. The existing structured support-request form remains mounted and operational. Contact and bug-report links target the existing `support-request-title` anchor and retain the existing `?category=` behavior.

This is presentation reuse, not a replacement support pipeline.

## Explicitly unchanged

This phase does not change:

- any policy payload wording;
- Accessibility version state or archive history;
- policy approvals or effective dates;
- first-20 internal draft publication settings;
- Everything Search database indexing or audience controls;
- support-request persistence;
- analytics collection;
- Supabase schema;
- Issue #667, #670, or #674 operational authorities.

## Manual preview review before merge

Verify `/support` on the PR preview:

1. The page has one visible Help/Policy search surface and the existing support form remains below it.
2. `privacy` returns Help guidance and the current Privacy Policy destination.
3. `accessibility` returns Help guidance plus the current Accessibility policy destination.
4. `refund` and `copyright` return the expected Help/legal destinations.
5. `Help`, `Policy`, `Safety`, and `Legal` category controls filter the visible corpus correctly.
6. Keyboard Tab reaches the search, category buttons, result links, and support actions with visible focus.
7. Mobile/narrow layout keeps category navigation usable without page-level horizontal overflow.
8. Light, Dark, and System remain readable.
9. Contact support still reaches the structured support form and selecting a support category still works.
10. No internal draft, review candidate, superseded Accessibility version, approval metadata, or publication blocker appears anywhere in public discovery.

Production verification after merge should repeat representative search/category checks and confirm Vercel success for the exact merge commit.
