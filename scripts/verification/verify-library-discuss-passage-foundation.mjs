import fs from "node:fs";

const migrationPath = "supabase/migrations/20260817094000_add_library_passage_discussion_foundation.sql";
const migration = fs.readFileSync(migrationPath, "utf8");
const lower = migration.toLowerCase();
const failures = [];

for (const token of [
  "create table if not exists public.library_passage_discussions",
  "user_id uuid not null references auth.users(id) on delete cascade",
  "discussion_id uuid not null references public.discussions(id) on delete cascade",
  "publication_id uuid not null references public.library_publications(id) on delete cascade",
  "locator text not null",
  "selected_text text not null",
  "start_offset integer not null",
  "end_offset integer not null",
  "text_sha256 text not null",
  "unique (discussion_id)",
  "start_offset >= 0",
  "end_offset > start_offset",
  "char_length(selected_text) between 1 and 4000",
  "text_sha256 ~ '^[0-9a-f]{64}$'",
  "alter table public.library_passage_discussions enable row level security",
  'create policy "members read own library passage discussions"',
  'create policy "members create own valid library passage discussions"',
  'create policy "members delete own library passage discussions"',
  "auth.uid() = user_id",
  "from public.discussions d",
  "d.id = library_passage_discussions.discussion_id",
  "d.user_id = auth.uid()",
  "join public.library_publication_sections s",
  "s.section_key = library_passage_discussions.locator",
  "p.status = 'published'",
  "revoke all on table public.library_passage_discussions from anon",
  "grant select, insert, delete on table public.library_passage_discussions to authenticated",
  "zero-based utf-16",
  "server-side javascript",
]) {
  if (!lower.includes(token.toLowerCase())) failures.push(`missing discuss-passage contract: ${token}`);
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
  "stripe",
  "checkout",
  "create policy \"members update",
]) {
  if (lower.includes(forbidden.toLowerCase())) failures.push(`out-of-scope capability present: ${forbidden}`);
}

if (failures.length) {
  console.error("Library Discuss Passage foundation verification FAILED");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Library Discuss Passage foundation verification passed");
console.log("- provenance binds one discussion to one normalized publication passage");
console.log("- inserts require the authenticated member to own the target discussion");
console.log("- passage locators must belong to the same published normalized publication");
console.log("- range shape and lowercase section SHA-256 are constrained in SQL");
console.log("- exact UTF-16 range/hash/text agreement remains a server-side JavaScript responsibility");
console.log("- provenance visibility remains owner-only until canonical discussion visibility is reused");
console.log("- no update, anonymous access, storage, service-role, AI, or commerce capability is introduced");
