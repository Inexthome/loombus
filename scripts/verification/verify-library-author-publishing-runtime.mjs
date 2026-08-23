import fs from "node:fs";

const migrationPath = "supabase/migrations/20260822231500_add_library_author_publishing_runtime.sql";
const pagePath = "src/app/library/publish/page.tsx";

const migration = fs.readFileSync(migrationPath, "utf8");
const page = fs.readFileSync(pagePath, "utf8");

const requiredMigrationFragments = [
  "create_library_author_draft",
  "update_library_author_draft",
  "submit_library_author_publication",
  "security definer",
  "auth.uid()",
  "library_author_publication_not_owned",
  "library_author_publication_not_editable",
  "library_author_publication_not_submittable",
  "status = 'draft'",
  "submission_status = 'submitted'",
  "grant execute on function public.create_library_author_draft",
  "grant execute on function public.update_library_author_draft",
  "grant execute on function public.submit_library_author_publication",
];

for (const fragment of requiredMigrationFragments) {
  if (!migration.includes(fragment)) {
    throw new Error(`Missing author runtime migration guard: ${fragment}`);
  }
}

const requiredPageFragments = [
  'supabase.rpc("create_library_author_draft"',
  'supabase.rpc("update_library_author_draft"',
  'supabase.rpc("submit_library_author_publication"',
  'from("library_author_publications")',
  'from("library_publications")',
  "LibraryAuthorEpubUpload",
  "contentReady",
  "Submit for review",
  "does not publish the work automatically",
];

for (const fragment of requiredPageFragments) {
  if (!page.includes(fragment)) {
    throw new Error(`Missing author publishing UI contract: ${fragment}`);
  }
}

const forbidden = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
  "createLibraryIngestionClient",
  "dangerouslySetInnerHTML",
];

for (const fragment of forbidden) {
  if (migration.includes(fragment) || page.includes(fragment)) {
    throw new Error(`Forbidden author publishing runtime dependency: ${fragment}`);
  }
}

if (/p_status|p_submission_status|status\s*=\s*'published'/.test(migration)) {
  throw new Error("Author RPC must not accept or set published/review status directly.");
}

console.log("PASS: Library author publishing runtime is authenticated, owner-scoped, review-gated, EPUB-ready aware, and independent of privileged Supabase credentials.");
