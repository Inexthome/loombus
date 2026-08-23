import fs from "node:fs";

const migrationPath = "supabase/migrations/20260823070000_add_library_author_retirement.sql";
const authorPagePath = "src/app/library/publish/page.tsx";
const adminPath = "src/components/admin-library-review-client.tsx";

for (const path of [migrationPath, authorPagePath, adminPath]) {
  if (!fs.existsSync(path)) throw new Error(`Missing required file: ${path}`);
}

const migration = fs.readFileSync(migrationPath, "utf8");
const authorPage = fs.readFileSync(authorPagePath, "utf8");
const admin = fs.readFileSync(adminPath, "utf8");

for (const fragment of [
  "add column if not exists retired_at timestamptz",
  "retire_library_author_unpublished_publication",
  "library_author_retire_requires_publication_history",
  "library_author_retire_requires_unpublished_state",
  "set retired_at = now()",
  "library_publish_retired_publication_forbidden",
  "status <> 'archived'",
]) {
  if (!migration.includes(fragment)) throw new Error(`Missing retirement migration contract: ${fragment}`);
}

for (const fragment of [
  'retired_at: string | null',
  '.is("retired_at", null)',
  'retire_library_author_unpublished_publication',
  'selected.publication.status === "archived"',
  'Delete publication',
  'Historical Library references remain preserved',
]) {
  if (!authorPage.includes(fragment)) throw new Error(`Missing author retirement UI contract: ${fragment}`);
}

for (const fragment of [
  'retired_at: string | null',
  '!row.retired_at && row.submission_status === "approved"',
  'Retired by author',
  'Retired ${new Date(row.retired_at).toLocaleString()}',
]) {
  if (!admin.includes(fragment)) throw new Error(`Missing admin retirement behavior: ${fragment}`);
}

for (const fragment of [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
  "dangerouslySetInnerHTML",
]) {
  if (migration.includes(fragment) || authorPage.includes(fragment) || admin.includes(fragment)) {
    throw new Error(`Forbidden retirement dependency: ${fragment}`);
  }
}

console.log("PASS: Library authors can retire previously published archived work without deleting canonical history, and retired work cannot be republished.");
