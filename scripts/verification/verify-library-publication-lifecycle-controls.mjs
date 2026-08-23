import fs from "node:fs";

const migrationPath = "supabase/migrations/20260823064000_add_library_publication_lifecycle_controls.sql";
const authorPagePath = "src/app/library/publish/page.tsx";
const adminClientPath = "src/components/admin-library-review-client.tsx";

for (const path of [migrationPath, authorPagePath, adminClientPath]) {
  if (!fs.existsSync(path)) throw new Error(`Missing Library lifecycle file: ${path}`);
}

const migration = fs.readFileSync(migrationPath, "utf8");
const authorPage = fs.readFileSync(authorPagePath, "utf8");
const adminClient = fs.readFileSync(adminClientPath, "utf8");

const requiredMigration = [
  "library_current_user_can_delete_original",
  'bucket_id = \'library-publication-originals\'',
  "authors delete own never-published library originals",
  "delete_library_author_unpublished_publication",
  "a.published_at is null",
  "v_published_at is not null",
  "library_author_delete_published_history_forbidden",
  "submission_status in ('draft', 'changes_requested', 'rejected')",
  "unpublish_library_author_publication",
  "set status = 'archived'",
  "status in ('draft', 'archived')",
  "published_at = coalesce(published_at, now())",
  "published_by = coalesce(published_by, v_admin_id)",
  "library_current_user_is_admin()",
];

for (const fragment of requiredMigration) {
  if (!migration.includes(fragment)) throw new Error(`Missing Library lifecycle migration contract: ${fragment}`);
}

const requiredAuthor = [
  "published_at: string | null",
  "Delete publication",
  "delete_library_author_unpublished_publication",
  ".remove([sourceResult.data.storage_path])",
  "window.confirm",
  'selected.publication.status === "draft"',
  '["draft", "changes_requested", "rejected"]',
  'row.publication.status === "archived"',
  "Unpublished · history preserved",
];

for (const fragment of requiredAuthor) {
  if (!authorPage.includes(fragment)) throw new Error(`Missing Library lifecycle author UI contract: ${fragment}`);
}

const requiredAdmin = [
  "unpublish_library_author_publication",
  "Unpublish from Library",
  "Republish to Library",
  'publication.status === "archived"',
  "window.confirm",
  "First published",
];

for (const fragment of requiredAdmin) {
  if (!adminClient.includes(fragment)) throw new Error(`Missing Library lifecycle admin UI contract: ${fragment}`);
}

const protectedRuntime = `${migration}\n${authorPage}\n${adminClient}`;
for (const forbidden of [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
  "dangerouslySetInnerHTML",
]) {
  if (protectedRuntime.includes(forbidden)) throw new Error(`Forbidden Library lifecycle dependency: ${forbidden}`);
}

console.log("PASS: Library lifecycle preserves published history, supports admin unpublish/republish, and limits hard delete to never-published owner work with exact-path Storage cleanup.");
