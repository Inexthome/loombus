import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];

function read(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) {
    errors.push(`${relativePath}: missing`);
    return "";
  }
  return fs.readFileSync(fullPath, "utf8");
}

function requireFragment(content, fragment, context) {
  if (!content.includes(fragment)) {
    errors.push(`${context}: missing expected fragment ${JSON.stringify(fragment)}`);
  }
}

function forbidFragment(content, fragment, context) {
  if (content.toLowerCase().includes(fragment.toLowerCase())) {
    errors.push(`${context}: forbidden privacy-sensitive fragment ${JSON.stringify(fragment)}`);
  }
}

const migrationPath =
  "supabase/migrations/20260825075000_add_policy_content_daily_analytics.sql";
const migration = read(migrationPath);
const service = read("src/lib/policy-content-analytics.ts");
const publicRoute = read("src/app/api/policy-content-analytics/route.ts");
const adminRoute = read("src/app/api/admin/policy-content-analytics/route.ts");
const client = read("src/components/policy-content/policy-analytics-view.tsx");
const accessibility = read("src/app/accessibility/layout.tsx");
const history = read("src/app/policies/history/[documentId]/page.tsx");
const archive = read("src/app/policies/archive/[documentId]/[version]/page.tsx");

for (const fragment of [
  "create table if not exists public.policy_content_daily_analytics",
  "primary key (event_date, surface, document_id, version)",
  "enable row level security",
  "revoke all on table public.policy_content_daily_analytics from anon, authenticated",
  "grant execute on function public.increment_policy_content_daily_analytics(text, text, text) to service_role",
]) {
  requireFragment(migration.toLowerCase(), fragment.toLowerCase(), migrationPath);
}

for (const forbidden of [
  "user_id",
  "viewer_id",
  "ip_address",
  "session_id",
  "user_agent",
  "device_id",
  "latitude",
  "longitude",
  "referrer",
  "search_text",
  "dwell_time",
  "scroll_depth",
]) {
  forbidFragment(migration, forbidden, migrationPath);
  forbidFragment(service, forbidden, "src/lib/policy-content-analytics.ts");
  forbidFragment(publicRoute, forbidden, "src/app/api/policy-content-analytics/route.ts");
  forbidFragment(client, forbidden, "src/components/policy-content/policy-analytics-view.tsx");
}

for (const fragment of [
  'surface: PolicyAnalyticsSurface;',
  'documentId: string;',
  'version: string;',
  'supabase.rpc("increment_policy_content_daily_analytics"',
]) {
  requireFragment(service, fragment, "src/lib/policy-content-analytics.ts");
}

for (const fragment of [
  'const SURFACES = new Set<PolicyAnalyticsSurface>',
  'resolvePolicyCurrentVersion(input.documentId)',
  'resolvePolicyPublicHistory(input.documentId)',
  'resolvePolicyArchiveVersion(input.documentId, input.version)',
  'await incrementPolicyContentDailyView({ surface, documentId, version })',
]) {
  requireFragment(publicRoute, fragment, "src/app/api/policy-content-analytics/route.ts");
}

for (const forbidden of [
  'request.headers.get("user-agent")',
  'request.headers.get("referer")',
  'request.headers.get("x-forwarded-for")',
  "cookies()",
  "localStorage",
  "sessionStorage",
]) {
  forbidFragment(publicRoute, forbidden, "src/app/api/policy-content-analytics/route.ts");
  forbidFragment(client, forbidden, "src/components/policy-content/policy-analytics-view.tsx");
}

for (const fragment of [
  'credentials: "omit"',
  'cache: "no-store"',
  'keepalive: true',
]) {
  requireFragment(client, fragment, "src/components/policy-content/policy-analytics-view.tsx");
}

for (const fragment of [
  "verifyRequestAccountAccess(createRequestSupabase(request))",
  "access.profile.is_admin !== true",
  "aggregateOnly: true",
]) {
  requireFragment(adminRoute, fragment, "src/app/api/admin/policy-content-analytics/route.ts");
}

requireFragment(accessibility, 'surface="current"', "src/app/accessibility/layout.tsx");
requireFragment(history, 'surface="history"', "src/app/policies/history/[documentId]/page.tsx");
requireFragment(archive, 'surface="archive"', "src/app/policies/archive/[documentId]/[version]/page.tsx");

const registry = read("src/lib/policy-content-registry.data.json");
requireFragment(registry, '"registryImportEnabled": false', "policy registry");
requireFragment(registry, '"publicRoutingEnabled": false', "policy registry");

if (errors.length > 0) {
  console.error("Policy privacy analytics verification FAILED:\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Policy privacy analytics verification PASSED");
console.log("- storage: UTC daily aggregate only");
console.log("- dimensions: surface + document id + public version");
console.log("- reader identifiers and behavioral telemetry: excluded");
console.log("- admin read access: authenticated administrator only");
