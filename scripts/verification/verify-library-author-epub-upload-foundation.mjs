import fs from "node:fs";

const migrationPath = "supabase/migrations/20260823023000_add_library_author_epub_upload_foundation.sql";
if (!fs.existsSync(migrationPath)) throw new Error(`Missing required file: ${migrationPath}`);

const migration = fs.readFileSync(migrationPath, "utf8");

for (const fragment of [
  "prepare_library_author_epub_source",
  "library_current_user_can_access_original",
  "library-publication-originals",
  "authors read own library publication sources",
  "authors upload own library publication originals",
  "authors update own library publication originals",
  "authors read own draft library publication originals",
  "a.user_id = auth.uid()",
  "a.submission_status in ('draft', 'changes_requested')",
  "p.status = 'draft'",
  "p_byte_size > 52428800",
  "p_sha256 !~ '^[0-9a-f]{64}$'",
  "delete from public.library_publication_sections",
  "ingestion_status = 'pending'",
]) {
  if (!migration.includes(fragment)) throw new Error(`Missing EPUB upload foundation guard: ${fragment}`);
}

for (const forbidden of [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
  "bucket_id = '*'",
  "to anon",
]) {
  if (migration.includes(forbidden)) throw new Error(`Forbidden EPUB upload foundation dependency: ${forbidden}`);
}

if (!migration.includes("for insert\n  to authenticated") || !migration.includes("for update\n  to authenticated")) {
  throw new Error("Original upload access must remain authenticated and owner-scoped.");
}

console.log("Library author EPUB upload foundation verification passed.");
