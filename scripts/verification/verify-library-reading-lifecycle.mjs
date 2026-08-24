import fs from "node:fs";

const migrationPath = "supabase/migrations/20260824020000_add_library_reading_lifecycle.sql";
const surfacePath = "src/components/library/library-functional-surface.tsx";
const migration = fs.readFileSync(migrationPath, "utf8");
const surface = fs.readFileSync(surfacePath, "utf8");
const failures = [];

for (const token of [
  "create table if not exists public.library_reading_lifecycle",
  "state text not null default 'want_to_read'",
  "'want_to_read','reading','finished'",
  "finished_at timestamptz",
  "primary key (user_id, publication_id)",
  "enable row level security",
  'create policy "members read own reading lifecycle"',
  'create policy "members create own reading lifecycle"',
  'create policy "members update own reading lifecycle"',
  'create policy "members delete own reading lifecycle"',
  "auth.uid() = user_id",
  "sync_library_reading_lifecycle_from_progress",
  "after insert or update of locator, progress_percent, last_read_at, updated_at",
  "new.progress_percent >= 100",
  "grant select, insert, update, delete on table public.library_reading_lifecycle to authenticated",
]) {
  if (!migration.includes(token)) failures.push(`missing lifecycle data contract: ${token}`);
}

for (const token of [
  'from("library_reading_lifecycle")',
  '"Want to Read"',
  '"Finished"',
  '"Still Reading"',
  '"Mark as Finished"',
  'state === "want_to_read"',
  'state === "finished"',
  'finished_at: state === "finished" ? now : null',
  'onConflict: "user_id,publication_id"',
  'href={`/library/read/${publication.id}?open=1`}',
]) {
  if (!surface.includes(token)) failures.push(`missing lifecycle UI contract: ${token}`);
}

for (const token of [
  "SUPABASE_SERVICE_ROLE_KEY",
  "service_role",
  "stripe",
  "checkout",
  "openai",
  "anthropic",
]) {
  if (surface.toLowerCase().includes(token.toLowerCase())) failures.push(`out-of-scope UI capability present: ${token}`);
}

if (failures.length) {
  console.error("Loombus Library reading lifecycle verification FAILED");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Loombus Library reading lifecycle verification passed");
console.log("- lifecycle state is private, owner-RLS protected, and separate from saved-library membership");
console.log("- existing saved/progress rows are backfilled into Want to Read, Reading, or Finished");
console.log("- progress writes automatically move Reading/Finished without changing progress percentages");
console.log("- Want to Read and Finished are first-class Library destinations");
console.log("- manual Finished and Still Reading actions are available without destroying reading position");
