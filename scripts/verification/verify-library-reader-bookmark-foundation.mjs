import fs from "node:fs";

const migration = fs.readFileSync("supabase/migrations/20260817074500_add_library_reader_bookmarks.sql", "utf8");
const failures = [];

for (const token of [
  "create table if not exists public.library_bookmarks",
  "user_id uuid not null references auth.users(id) on delete cascade",
  "publication_id uuid not null references public.library_publications(id) on delete cascade",
  "locator text not null",
  "unique (user_id, publication_id, locator)",
  "alter table public.library_bookmarks enable row level security",
  'create policy "members read own library bookmarks"',
  'create policy "members create own valid library bookmarks"',
  'create policy "members delete own library bookmarks"',
  "auth.uid() = user_id",
  "join public.library_publication_sections s",
  "s.publication_id = p.id",
  "s.section_key = library_bookmarks.locator",
  "p.status = 'published'",
  "revoke all on table public.library_bookmarks from anon",
  "grant select, insert, delete on table public.library_bookmarks to authenticated",
]) {
  if (!migration.includes(token)) failures.push(`missing bookmark contract: ${token}`);
}

for (const forbidden of [
  "disable row level security",
  "security definer",
  "grant all",
  "service_role",
  "storage.objects",
  "storage.buckets",
  "openai",
  "anthropic",
]) {
  if (migration.toLowerCase().includes(forbidden.toLowerCase())) failures.push(`out-of-scope capability present: ${forbidden}`);
}

if (failures.length) {
  console.error("Library Reader bookmark foundation verification FAILED");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Library Reader bookmark foundation verification passed");
console.log("- bookmarks are private and owner-scoped");
console.log("- duplicate bookmarks for one publication locator are prevented");
console.log("- inserts are bound to normalized sections of the same published publication");
console.log("- no storage, service-role, AI, or public-sharing capability is introduced");
