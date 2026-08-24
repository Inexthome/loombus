import fs from "node:fs";

const files = {
  schema: "supabase/migrations/20260824001500_add_library_revision_schema.sql",
  openState: "supabase/migrations/20260824001700_harden_library_revision_open_state.sql",
  ingestion: "supabase/migrations/20260824002000_add_library_revision_ingestion.sql",
  editorial: "supabase/migrations/20260824002500_add_library_revision_editorial_runtime.sql",
  history: "supabase/migrations/20260824002700_finalize_library_revision_history_state.sql",
  reader: "supabase/migrations/20260824003000_harden_library_revision_reader_state.sql",
  author: "src/app/library/publish/revisions/page.tsx",
  authorLayout: "src/app/library/publish/layout.tsx",
  admin: "src/app/admin/library-review/revisions/page.tsx",
  adminLayout: "src/app/admin/library-review/layout.tsx",
  preview: "src/components/library/library-version-normalized-preview.tsx",
};
for (const path of Object.values(files)) if (!fs.existsSync(path)) throw new Error(`Missing revision-runtime file: ${path}`);
const read = (path) => fs.readFileSync(path, "utf8");
const schema = read(files.schema);
const openState = read(files.openState);
const ingestion = read(files.ingestion);
const editorial = read(files.editorial);
const history = read(files.history);
const reader = read(files.reader);
const author = read(files.author);
const admin = read(files.admin);
const preview = read(files.preview);
const all = Object.values(files).map(read).join("\n");

for (const fragment of [
  "library_publication_revision_reviews",
  "library_publication_sources_version_id_key",
  "library_publication_sections_version_section_key_key",
  "library_publication_sections_version_ordinal_key",
  "create_library_author_revision",
  "update_library_author_revision",
]) if (!schema.includes(fragment)) throw new Error(`Missing revision schema contract: ${fragment}`);

for (const fragment of ["published_at is null", "library_revision_already_open"]) if (!openState.includes(fragment)) throw new Error(`Missing revision open-state guard: ${fragment}`);

for (const fragment of [
  "prepare_library_author_revision_epub_source",
  "begin_library_author_epub_ingestion",
  "complete_library_author_epub_ingestion",
  "delete from public.library_publication_sections where version_id=v_source.version_id",
  "library_ingestion_route_token_valid",
]) if (!ingestion.includes(fragment)) throw new Error(`Missing version-aware ingestion contract: ${fragment}`);

for (const fragment of ["submit_library_author_revision", "review_library_author_revision", "publish_library_author_revision", "version_status='superseded'", "active_version_id=p_version_id"]) if (!editorial.includes(fragment) && !history.includes(fragment)) throw new Error(`Missing editorial revision contract: ${fragment}`);

for (const fragment of ["submission_status='published'", "published_by=v_admin_id"]) if (!history.includes(fragment)) throw new Error(`Missing completed revision history contract: ${fragment}`);

for (const fragment of ["active version only library highlights", "active version only library notes", "active version only library bookmarks", "library_assign_current_reading_progress_version"]) if (!reader.includes(fragment)) throw new Error(`Missing Reader version-state hardening: ${fragment}`);

for (const fragment of ["create_library_author_revision", "prepare_library_author_revision_epub_source", "submit_library_author_revision", "/api/library/author/ingest-epub", "LibraryVersionNormalizedPreview"]) if (!author.includes(fragment)) throw new Error(`Missing author revision runtime: ${fragment}`);
for (const fragment of ["review_library_author_revision", "publish_library_author_revision", "LibraryVersionNormalizedPreview"]) if (!admin.includes(fragment)) throw new Error(`Missing admin revision runtime: ${fragment}`);
for (const fragment of ['.eq("version_id", versionId)', "content_text"]) if (!preview.includes(fragment)) throw new Error(`Preview is not version-scoped normalized text: ${fragment}`);

if (preview.includes("content_html") || preview.includes("dangerouslySetInnerHTML")) throw new Error("Revision preview must render normalized content_text only.");
if (/SUPABASE_SERVICE_ROLE_KEY|service_role/i.test(all)) throw new Error("Published revision runtime must not introduce service-role usage.");
if (ingestion.includes("delete from public.library_publication_sections where publication_id")) throw new Error("Revision ingestion must never replace every publication version's sections.");
if (!schema.includes("drop constraint if exists library_publication_sources_publication_id_key")) throw new Error("Legacy publication-wide source uniqueness was not deliberately replaced.");

console.log("Library published revision runtime verification passed.");
