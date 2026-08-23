import fs from "node:fs";

const migration = fs.readFileSync("supabase/migrations/20260823083000_add_library_publication_covers.sql", "utf8");
const cover = fs.readFileSync("src/components/library/library-cover-image.tsx", "utf8");
const author = fs.readFileSync("src/components/library/library-author-cover-upload.tsx", "utf8");
const epub = fs.readFileSync("src/components/library/library-author-epub-upload.tsx", "utf8");
const admin = fs.readFileSync("src/components/library/library-admin-normalized-preview.tsx", "utf8");
const library = fs.readFileSync("src/components/library/library-functional-surface.tsx", "utf8");

for (const required of ["library-publication-covers", "8388608", "image/jpeg", "image/png", "image/webp", "prepare_library_author_cover", "clear_library_author_cover", "a.user_id=auth.uid()", "p.status='draft'", "pr.is_admin=true", "p.status='published'", "cover_must_be_removed_before_delete"]) {
  if (!migration.includes(required)) throw new Error(`Missing Library cover contract: ${required}`);
}
if (!migration.includes("false,8388608")) throw new Error("Library cover bucket must remain private.");
if (/service_role|SUPABASE_SERVICE_ROLE_KEY/i.test(migration + author + cover)) throw new Error("Library cover flow must not use service role credentials.");
for (const required of ["prepare_library_author_cover", "clear_library_author_cover", "image/jpeg,image/png,image/webp", "LibraryCoverImage"]) if (!author.includes(required)) throw new Error(`Missing author cover behavior: ${required}`);
if (!epub.includes("LibraryAuthorCoverUpload")) throw new Error("Author publishing content controls must include cover upload.");
for (const required of ["LibraryCoverImage", "cover_url", "library_publication_sections"]) if (!admin.includes(required)) throw new Error(`Missing admin cover preview behavior: ${required}`);
for (const required of ["LibraryCoverImage", "publication.cover_url", '.eq("status", "published")']) if (!library.includes(required)) throw new Error(`Missing public Library cover behavior: ${required}`);
if (cover.includes("getPublicUrl") || author.includes("getPublicUrl")) throw new Error("Private Library covers must not use public Storage URLs.");
console.log("Library publication cover verification passed.");
