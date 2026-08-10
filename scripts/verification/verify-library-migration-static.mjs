import fs from "node:fs";

const path = "supabase/migrations/20260810120000_add_loombus_library_data_foundation.sql";
const sql = fs.readFileSync(path, "utf8");
const lower = sql.toLowerCase();
const failures = [];

const expected = [
  "create table if not exists public.library_publications",
  "create table if not exists public.library_member_items",
  "create table if not exists public.library_reading_progress",
  "create table if not exists public.library_highlights",
  "create table if not exists public.library_notes",
  "alter table public.library_publications enable row level security",
  "alter table public.library_member_items enable row level security",
  "alter table public.library_reading_progress enable row level security",
  "alter table public.library_highlights enable row level security",
  "alter table public.library_notes enable row level security",
];
for (const token of expected) if (!lower.includes(token)) failures.push(`missing: ${token}`);

const destructive = ["drop table", "truncate ", "delete from ", "drop schema", "alter table auth."];
for (const token of destructive) if (lower.includes(token)) failures.push(`destructive operation present: ${token.trim()}`);

if ((lower.match(/create policy/g) ?? []).length < 15) failures.push("expected owner-scoped RLS policies are incomplete");
if ((lower.match(/revoke all on table public.library_/g) ?? []).length !== 5) failures.push("expected anon revokes are incomplete");

if (failures.length) {
  console.error("Library migration static verification FAILED");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Library migration static verification passed");
console.log("- additive Library-only schema changes");
console.log("- no destructive table/data operations");
console.log("- RLS and anon revocation coverage present");
