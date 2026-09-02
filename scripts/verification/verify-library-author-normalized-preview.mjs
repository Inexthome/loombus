import fs from "node:fs";

const migrationPath = "supabase/migrations/20260823080000_add_library_author_normalized_preview.sql";
const previewPath = "src/components/library/library-author-normalized-preview.tsx";
const uploadPath = "src/components/library/library-author-epub-upload.tsx";

for (const path of [migrationPath, previewPath, uploadPath]) {
  if (!fs.existsSync(path)) throw new Error(`Missing Library author preview file: ${path}`);
}

const migration = fs.readFileSync(migrationPath, "utf8");
const preview = fs.readFileSync(previewPath, "utf8");
const upload = fs.readFileSync(uploadPath, "utf8");

for (const fragment of [
  'authors preview own normalized library draft sections',
  'library_author_publications',
  'a.user_id = auth.uid()',
  'a.retired_at is null',
  "p.status = 'draft'",
  'for select',
  'to authenticated',
]) {
  if (!migration.toLowerCase().includes(fragment.toLowerCase())) {
    throw new Error(`Missing author normalized-preview RLS contract: ${fragment}`);
  }
}

for (const fragment of [
  '.from("library_publication_sections")',
  '.select("section_key, ordinal, title, content_text")',
  '.eq("publication_id", publicationId)',
  '.order("ordinal", { ascending: true })',
  'Preview normalized publication',
  'Normalized Reader content',
  'The original EPUB is not rendered here.',
  'currentSection.content_text',
]) {
  if (!preview.includes(fragment)) {
    throw new Error(`Missing author normalized-preview UI contract: ${fragment}`);
  }
}

for (const fragment of [
  'LibraryAuthorNormalizedPreview',
  'ready={sourceReady}',
  'published={published}',
  'LibraryAuthorProofingPreflight',
]) {
  if (!upload.includes(fragment)) {
    throw new Error(`Missing EPUB-panel preview/proofing wiring: ${fragment}`);
  }
}

const protectedRuntime = `${migration}\n${preview}\n${upload}`;
for (const forbidden of [
  'dangerouslySetInnerHTML',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SECRET_KEY',
  'createLibraryIngestionClient',
  'server-ingestion-client',
]) {
  if (protectedRuntime.includes(forbidden)) {
    throw new Error(`Author normalized preview contains forbidden runtime dependency: ${forbidden}`);
  }
}

if (preview.includes('content_html')) {
  throw new Error('Author preview must render normalized content_text rather than HTML.');
}

console.log("Library author normalized preview verification passed.");
