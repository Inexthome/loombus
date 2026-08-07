# Discussion point threads — Phase 2

This phase improves the focused branch experience introduced in PR #836 without changing reply storage or permissions.

## Behavior

- The active parent is labeled **Point being discussed**.
- The focused banner shows the current depth into the branch and direct/total response counts.
- Breadcrumbs expose the current path from Replies to Point to deeper responses.
- Breadcrumb segments can move directly back to an ancestor without repeated back presses.
- **Respond to this point** delegates to the original reply card action so reply creation behavior stays centralized.
- Direct children are grouped under **Responses to this point**.
- Every visible reply remains the original reply card, preserving Helpful, Insight, Reasoned, Changed view, Evidence, Respond to point, Pin, Edit, Delete, and Report behavior.
- The thread remains flat visually at every depth; no additional indentation is introduced.

## Scope

No database migrations, reply API changes, moderation changes, reaction changes, or permission changes are included.
