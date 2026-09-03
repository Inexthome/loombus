import fs from "node:fs";

const migrationPath = "supabase/migrations/20260903043000_unified_admin_needs_attention.sql";
const migration = fs.readFileSync(migrationPath, "utf8");
const admin = fs.readFileSync("src/app/admin/admin-operations-client.tsx", "utf8");
const notificationPage = fs.readFileSync("src/app/notifications/page.tsx", "utf8");
const notificationLinks = fs.readFileSync("src/app/notifications/admin-attention-notifications.tsx", "utf8");
const api = fs.readFileSync("src/app/api/admin/attention/route.ts", "utf8");

function requireText(text, needle, message) {
  if (!text.includes(needle)) throw new Error(message);
}

for (const source of [
  "admin_report",
  "admin_support_request",
  "admin_labs_request",
  "admin_library_review",
  "admin_booking_dispute",
  "admin_account_deletion",
  "admin_trust_safety_case",
  "admin_identity_review",
]) {
  requireText(migration, source, `Migration must synchronize ${source}.`);
  requireText(notificationLinks, source, `Notifications must route ${source} directly.`);
}

requireText(migration, "create table if not exists public.admin_attention_items", "Durable attention table is required.");
requireText(migration, "constraint admin_attention_items_source_unique unique (source_type, source_id)", "Attention items must be source-unique.");
requireText(migration, "resolved_at = null", "Reopening must clear source resolution state.");
requireText(migration, "generation + 1", "Reopened items must advance generation.");
requireText(migration, "insert into public.notifications", "Opening an item must generate normal admin notifications.");
requireText(migration, "where p.is_admin = true", "Every Loombus admin must receive the notification.");
requireText(migration, "coalesce(p_record->>'source_type', 'manual') <> 'manual'", "Manual in-admin Trust & Safety records must not be treated as external intake.");
requireText(migration, "r.payload->>'status' in ('reviewing', 'blocked', 'failed')", "Account-deletion backfill must cover actual manual review states.");
requireText(migration, "perform public.sync_admin_attention_payload('account_deletion_requests', r.payload, false)", "Account-deletion backfill must use the source-linked synchronization path.");

if (/dismiss.*admin_attention|delete.*admin_attention_items/i.test(admin)) {
  throw new Error("Admin UI must not provide independent dismissal of unresolved source-linked attention items.");
}
requireText(admin, "/api/admin/attention", "Admin dashboard must load the durable queue.");
requireText(admin, "item.action_url", "Attention items must link to their source resolution surface.");
requireText(admin, "Queue unavailable", "Unavailable queue state must not be represented as zero.");
if (admin.includes("<strong>Recovery</strong>")) {
  throw new Error("Recovery must not be an automatic Needs Attention item.");
}

requireText(api, ".is(\"resolved_at\", null)", "Attention API must return only unresolved items.");
requireText(api, "access.profile.is_admin", "Attention API must require the Loombus Admin role.");
requireText(notificationPage, "AdminAttentionNotifications", "Normal Notifications must expose direct Admin action links.");

console.log("Unified Admin Needs Attention verification passed.");
