# Monitoring and Cost Plan

## Current monitoring sources

Use these before adding paid enterprise monitoring:
- Vercel dashboard for deployments, logs, usage, bandwidth, and function behavior.
- Supabase dashboard for database, API, Auth, Storage, logs, and Reports.
- Loombus `/admin/health` for internal operational counts, missing env config, support requests, reports, failed AI events, and billing configuration warnings.
- Loombus `/admin/billing` for Stripe configuration, entitlement sync, subscription status, Extra AI Pack records, and credit ledger visibility.
- Loombus `/admin/ai-access` for AI usage, failures, provider/model data, token counts, estimated cost, and raw provider errors for admin troubleshooting.

## Cost watch list

Watch weekly during early launch:
- Vercel bandwidth and function usage.
- Supabase database size.
- Supabase bandwidth/egress.
- Supabase storage usage.
- Supabase Auth monthly active users.
- OpenAI usage and estimated AI cost.
- Resend email volume.
- Stripe failed payments, disputes, and webhook activity.

## Practical monthly budget target

Early launch target:
- $100–$300/month if usage remains light.
- Keep AI API spend capped.
- Avoid enterprise plans until usage, reliability needs, or compliance needs justify them.

## External storage cost-control plan

Do not move storage yet unless usage proves it.

Future candidates for external object storage:
- uploaded images beyond avatars;
- future video/audio uploads;
- generated exports;
- legal PDF packages;
- archived media;
- backup files.

Keep in Supabase:
- relational data;
- entitlements;
- user settings;
- moderation records;
- audit logs;
- billing metadata;
- notification state.

Preferred future pattern:
- Store file metadata in Supabase.
- Store large files in object storage.
- Serve files through signed URLs or controlled public URLs.
- Keep permissions enforced by API routes and RLS metadata.
- Avoid storing large media blobs in the database.

## When to upgrade

Consider paid upgrades when any of these happen:
- backup retention is not enough;
- recovery point objective must be tighter;
- bandwidth/storage is consistently growing;
- OpenAI spend approaches the monthly cap;
- support/admin workload becomes daily;
- route errors appear repeatedly;
- users report downtime or slow loading.
