import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function requireText(text, needle, message) {
  if (!text.includes(needle)) throw new Error(message);
}

const migration = read("supabase/migrations/20260903171000_admin_email_optout_roster.sql");
const memberRoute = read("src/app/api/admin/member-email/route.ts");
const unsubscribeRoute = read("src/app/api/email/unsubscribe/route.ts");
const unsubscribeClient = read("src/app/email/unsubscribe/unsubscribe-client.tsx");
const webhookRoute = read("src/app/api/webhooks/resend/route.ts");
const adminClient = read("src/app/admin/communications/communications-client.tsx");

requireText(migration, "unsubscribe_source", "Marketing opt-outs must store their source.");
requireText(migration, "unsubscribed_campaign_id", "Marketing opt-outs must retain campaign provenance when available.");
requireText(migration, "create table if not exists public.email_delivery_suppressions", "Provider suppressions must be durable.");
requireText(migration, "revoke all on public.email_delivery_suppressions from anon, authenticated", "Suppression data must remain server/Admin only.");

requireText(memberRoute, "emailPreferences: records", "Admin Communications must receive a member preference roster.");
requireText(memberRoute, "loadActiveSuppressions", "Broadcast eligibility must load active provider suppressions.");
requireText(memberRoute, "!suppressions.has", "Prepared recipient snapshots must exclude provider-suppressed addresses.");
requireText(memberRoute, '.from("email_delivery_suppressions")', "Each send must re-check provider suppression state.");
requireText(memberRoute, "campaign=${encodeURIComponent(campaignId)}", "Unsubscribe links must carry campaign provenance.");

requireText(unsubscribeRoute, 'unsubscribe_source: "email_link"', "Unsubscribe actions must record link provenance.");
requireText(unsubscribeRoute, "unsubscribed_campaign_id: campaignId", "Unsubscribe actions must record campaign provenance.");
requireText(unsubscribeClient, "campaign = params.get", "The public unsubscribe flow must preserve campaign context.");

requireText(webhookRoute, 'type === "email.bounced"', "Resend bounce events must be captured.");
requireText(webhookRoute, 'type === "email.complained"', "Resend complaint events must be captured.");
requireText(webhookRoute, 'type === "email.suppressed"', "Resend provider suppression events must be captured.");
requireText(webhookRoute, 'createHmac("sha256"', "Resend webhook signatures must be cryptographically verified.");
requireText(webhookRoute, "timingSafeEqual", "Webhook signature comparison must use constant-time comparison.");
requireText(webhookRoute, "MAX_WEBHOOK_AGE_SECONDS = 300", "Webhook replay protection must enforce the five-minute timestamp window.");
requireText(webhookRoute, "RESEND_WEBHOOK_SECRET", "Webhook processing must fail closed without its signing secret.");

requireText(adminClient, "Email preferences &amp; suppressions", "Admin Communications must expose preference/suppression history.");
requireText(adminClient, 'useState<PreferenceFilter>("excluded")', "Excluded recipients should be the default Admin roster view.");
requireText(adminClient, "Opted out", "Admin Communications must identify member opt-outs.");
requireText(adminClient, "Bounced", "Admin Communications must distinguish bounced addresses.");
requireText(adminClient, "Complained", "Admin Communications must distinguish spam complaints.");
requireText(adminClient, "essential security, billing, or account messages", "The UI must make the transactional-email boundary explicit.");

console.log("Admin email preferences and suppression verification passed.");
