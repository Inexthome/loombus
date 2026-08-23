import fs from "node:fs";

const migrationPath = "supabase/migrations/20260823081500_add_library_admin_normalized_preview.sql";
const previewPath = "src/components/library/library-admin-normalized-preview.tsx";
const adminPath = "src/components/admin-library-review-client.tsx";

for (const path of [migrationPath, previewPath, adminPath]) {
  if (!fs.existsSync(path)) throw new Error(`Missing admin normalized preview file: ${path}`);
}

const migration = fs.readFileSync(migrationPath, "utf8");
const preview = fs.readFileSync(previewPath, "utf8");
const admin = fs.readFileSync(adminPath, "utf8");

for (const fragment of [
  'admins read normalized publication sections',
  'public.library_publication_sections',
  'public.profiles',
  'p.id = auth.uid()',
  'p.is_admin is true',
  'for select',
  'to authenticated',
]) {
  if (!migration.toLowerCase().includes(fragment.toLowerCase())) {
    throw new Error(`Missing admin preview RLS contract: ${fragment}`);
  }
}

for (const forbidden of ["storage.objects", "service_role", "supabase_service_role_key", "delete from"] ) {
  if (migration.toLowerCase().includes(forbidden)) {
    throw new Error(`Admin preview migration must not expand original/source access or mutate content: ${forbidden}`);
  }
}

for (const fragment of [
  '.from("library_publication_sections")',
  '.select("section_key,ordinal,title,content_text")',
  '.eq("publication_id", publicationId)',
  '.order("ordinal", { ascending: true })',
  'Preview normalized publication',
  'Editorial preview · normalized content',
  'activeSection.content_text',
]) {
  if (!preview.includes(fragment)) {
    throw new Error(`Missing admin normalized preview UI contract: ${fragment}`);
  }
}

if (preview.includes("dangerouslySetInnerHTML")) {
  throw new Error("Admin normalized preview must not render raw HTML.");
}
if (preview.includes("content_html")) {
  throw new Error("Admin normalized preview must read normalized text, not content_html.");
}
if (/storage\.|original\.epub|library-publication-originals/i.test(preview)) {
  throw new Error("Admin normalized preview must not access original EPUB Storage.");
}

for (const fragment of [
  'LibraryAdminNormalizedPreview',
  'publicationId={row.publication_id}',
  'publicationTitle={publication.title}',
  'Review the normalized section order and text before making an editorial decision.',
]) {
  if (!admin.includes(fragment)) {
    throw new Error(`Missing admin review integration contract: ${fragment}`);
  }
}

console.log("Library admin normalized preview verification passed.");
