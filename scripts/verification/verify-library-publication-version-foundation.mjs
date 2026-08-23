import fs from "node:fs";

const foundationPath = "supabase/migrations/20260823235000_add_library_publication_version_foundation.sql";
const hardeningPath = "supabase/migrations/20260823235500_harden_library_publication_version_foundation.sql";

for (const path of [foundationPath, hardeningPath]) {
  if (!fs.existsSync(path)) throw new Error(`Missing Library publication-version migration: ${path}`);
}

const sql = `${fs.readFileSync(foundationPath, "utf8")}\n${fs.readFileSync(hardeningPath, "utf8")}`;

for (const fragment of [
  "create table if not exists public.library_publication_versions",
  "version_number integer not null",
  "version_status in ('draft', 'published', 'superseded')",
  "add column if not exists active_version_id uuid",
  "version_number = 1",
  "library_publication_versions_identity_unique",
  "foreign key (active_version_id, id)",
  "references public.library_publication_versions(id, publication_id)",
  "library_guard_immutable_publication_version",
  "library_published_version_is_immutable",
  "library_superseded_version_is_immutable",
  "library_sync_initial_publication_version",
  "library_publication_sources_assign_version",
  "library_publication_sections_assign_version",
  "library_publication_sections_source_version_fkey",
  "alter table public.library_highlights add column if not exists version_id uuid",
  "alter table public.library_notes add column if not exists version_id uuid",
  "alter table public.library_bookmarks add column if not exists version_id uuid",
  "alter table public.library_research_items add column if not exists version_id uuid",
  "alter table public.library_passage_discussions add column if not exists version_id uuid",
  "library_notes_highlight_version_fkey",
  "p.active_version_id = library_publication_sections.version_id",
]) {
  if (!sql.includes(fragment)) throw new Error(`Missing publication-version contract: ${fragment}`);
}

for (const table of [
  "library_publication_sources",
  "library_publication_sections",
  "library_reading_progress",
  "library_highlights",
  "library_notes",
  "library_bookmarks",
  "library_research_items",
  "library_passage_discussions",
]) {
  if (!sql.includes(`alter table public.${table}`)) {
    throw new Error(`Missing version binding for ${table}`);
  }
}

// Foundation must not unlock multi-version staging yet. The existing publication-level
// uniqueness remains in place until the controlled revision runtime changes its callers too.
for (const forbidden of [
  "drop constraint library_publication_sources_publication_id_key",
  "drop constraint library_publication_sections_publication_id_section_key_key",
  "drop constraint library_publication_sections_publication_id_ordinal_key",
  "SUPABASE_SERVICE_ROLE_KEY",
  "service_role",
]) {
  if (sql.includes(forbidden)) throw new Error(`Forbidden foundation behavior: ${forbidden}`);
}

if (!sql.includes("revoke all on table public.library_publication_versions from anon, authenticated")) {
  throw new Error("Publication version ledger must remain non-browser-writable/readable in the foundation phase.");
}

console.log("Library publication version foundation verification passed.");
