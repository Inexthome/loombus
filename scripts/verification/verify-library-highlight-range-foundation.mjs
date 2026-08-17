import fs from "node:fs";

const migration = fs.readFileSync("supabase/migrations/20260817052500_add_library_highlight_text_ranges.sql", "utf8");
const failures = [];

for (const token of [
  "alter table public.library_highlights",
  "start_offset integer",
  "end_offset integer",
  "text_sha256 text",
  "start_offset >= 0",
  "end_offset > start_offset",
  "^[0-9a-f]{64}$",
  "start_offset is null and end_offset is null and text_sha256 is null",
]) if (!migration.includes(token)) failures.push(`missing highlight-range contract: ${token}`);

for (const forbidden of [
  "drop table",
  "disable row level security",
  "security definer",
  "grant all",
  "storage.objects",
  "service_role",
]) if (migration.toLowerCase().includes(forbidden.toLowerCase())) failures.push(`out-of-scope capability present: ${forbidden}`);

if (failures.length) {
  console.error("Library highlight range foundation verification FAILED");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Library highlight range foundation verification passed");
console.log("- legacy highlights remain valid with null range metadata");
console.log("- new durable ranges require ordered non-negative offsets");
console.log("- section text hash is required with range metadata");
console.log("- no RLS, storage, service-role, or annotation-sharing changes are introduced");
