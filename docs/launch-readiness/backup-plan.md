# Production Database Backup Plan

## Current backup posture

Loombus uses Supabase for production database hosting. Supabase provides managed backup options depending on plan. This runbook documents what must be checked before scaling.

## What must be protected

Critical data:
- profiles
- discussions
- replies
- reports
- audit_logs
- notifications
- user_ai_entitlements
- ai_usage_events
- support_requests
- account_deletion_requests
- labs_feature_requests
- labs_feature_request_votes
- bookmark data and private notes
- billing metadata and Extra AI Pack ledger records

## Backup policy for early launch

Before broad public scale:
1. Confirm the Supabase project plan and backup retention.
2. Confirm whether daily backups are available.
3. Confirm whether point-in-time recovery is enabled or needed.
4. Export schema before every major database migration.
5. Save every SQL migration in the repo before applying it.
6. Verify migrations after applying with table/grant/policy/index checks.
7. Keep git clean after every migration-related commit.

## Manual backup checklist before risky changes

Before major SQL or billing/security changes:
- Confirm latest git checkpoint.
- Confirm local repo is clean.
- Export current schema if available.
- Save migration SQL in `database/...`.
- Apply SQL in Supabase.
- Run verification query.
- Build locally.
- Commit migration record.
- Live-check impacted routes/APIs.

## Restore planning

A restore decision should consider:
- what table or migration failed;
- whether only one row/table is impacted;
- whether rollback SQL is safer than full project restore;
- whether recent user writes would be lost;
- whether moderation/billing/audit data must be preserved.

Never perform a destructive restore without first recording:
- incident time;
- suspected cause;
- last known good commit;
- affected tables;
- expected data loss window;
- owner approval.
