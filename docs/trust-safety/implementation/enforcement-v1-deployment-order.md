# Enforcement v1 Deployment Order

Apply the enforcement migrations in timestamp order after deploying the application branch:

1. `supabase/migrations/20260801100000_platform_enforcement_history_and_appeals.sql`
2. `supabase/migrations/20260801101000_enforcement_appeal_outcome_sync.sql`

The first migration creates the canonical tables, imports eligible legacy records, and installs account, Discussion, and Reply synchronization triggers. The second keeps canonical decision status aligned with appeal outcomes even when restoration is partial, blocked by a legal hold, or requires a manual adapter.

Do not consider Issue #665 production-complete until both migrations are applied and the verification checklist in `enforcement-history-and-appeals-v1.md` passes.
