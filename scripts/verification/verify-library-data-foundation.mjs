import fs from "node:fs";

const migrationPath = "supabase/migrations/20260810120000_add_loombus_library_data_foundation.sql";
const sql = fs.readFileSync(migrationPath, "utf8");
const executableSql = sql
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");

const requiredTables = [
  "library_publications",
  "library_member_items",
  "library_reading_progress",
  "library_highlights",
  "library_notes",
];

const failures = [];

for (const table of requiredTables) {
  if (!sql.includes(`public.${table}`)) failures.push(`missing table ${table}`);
  if (!sql.includes(`alter table public.${table} enable row level security`)) failures.push(`RLS not enabled for ${table}`);
  if (!sql.includes(`revoke all on table public.${table} from anon`)) failures.push(`anon not revoked for ${table}`);
}

for (const ownerTable of ["library_member_items", "library_reading_progress", "library_highlights", "library_notes"]) {
  if (!sql.match(new RegExp(`${ownerTable}[\\s\\S]*auth\\.uid\\(\\) = user_id`, "i"))) {
    failures.push(`owner scope missing for ${ownerTable}`);
  }
}

if (!sql.includes("status = 'published'")) failures.push("publication select gate missing");
if (!sql.includes("progress_percent >= 0 and progress_percent <= 100")) failures.push("progress bounds missing");
if (!sql.includes("h.user_id = auth.uid()") || !sql.includes("h.publication_id = publication_id")) failures.push("note/highlight ownership binding missing");

const forbidden = [
  "stripe",
  "price_id",
  "purchase",
  "checkout",
  "drm",
  "storage.objects",
  "storage.buckets",
  "openai",
  "anthropic",
];

for (const token of forbidden) {
  if (executableSql.toLowerCase().includes(token)) failures.push(`out-of-scope capability present: ${token}`);
}

if (failures.length) {
  console.error("Loombus Library data foundation verification FAILED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Loombus Library data foundation verification passed");
console.log(`- ${requiredTables.length} persistent tables present`);
console.log("- RLS enabled and anon revoked for all Library tables");
console.log("- personal state remains owner-scoped");
console.log("- publication discovery remains published-only");
console.log("- uploads, commerce, DRM, and AI execution remain absent");
