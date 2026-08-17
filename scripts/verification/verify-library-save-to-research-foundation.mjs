import fs from "node:fs";

const migrationPath = "supabase/migrations/20260817121500_add_library_research_items_foundation.sql";
if (!fs.existsSync(migrationPath)) throw new Error(`Missing Save to Research migration: ${migrationPath}`);

const sql = fs.readFileSync(migrationPath, "utf8");

const required = [
  "create table if not exists public.library_research_items",
  "user_id uuid not null references auth.users(id) on delete cascade",
  "publication_id uuid not null references public.library_publications(id) on delete cascade",
  "locator text not null",
  "selected_text text not null",
  "start_offset integer not null",
  "end_offset integer not null",
  "text_sha256 text not null",
  "start_offset >= 0",
  "end_offset > start_offset",
  "text_sha256 ~ '^[0-9a-f]{64}$'",
  "constraint library_research_items_unique_passage unique",
  "alter table public.library_research_items enable row level security",
  'create policy "members read own library research items"',
  'create policy "members create own valid library research items"',
  'create policy "members delete own library research items"',
  "auth.uid() = user_id",
  "from public.library_publications p",
  "join public.library_publication_sections s",
  "s.section_key = library_research_items.locator",
  "p.status = 'published'",
  "revoke all on table public.library_research_items from anon",
  "grant select, insert, delete on table public.library_research_items to authenticated",
  "intentionally not a destructive section foreign key",
  "UTF-16",
  "server-runtime responsibility",
];

for (const contract of required) {
  if (!sql.includes(contract)) throw new Error(`Save to Research foundation contract missing: ${contract}`);
}

const forbidden = [
  "grant update on table public.library_research_items",
  "grant all on table public.library_research_items",
  "references public.library_publication_sections",
  "to anon\n  using",
  "service_role",
  "storage.objects",
];

for (const token of forbidden) {
  if (sql.includes(token)) throw new Error(`Forbidden Save to Research foundation token found: ${token}`);
}

console.log("PASS: Library Save to Research private schema/RLS foundation verified.");
