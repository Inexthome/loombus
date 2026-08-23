import fs from "node:fs";

const migrationPath = "supabase/migrations/20260823002000_add_library_author_review_workflow.sql";
const pagePath = "src/app/admin/library-review/page.tsx";
const clientPath = "src/components/admin-library-review-client.tsx";

for (const path of [migrationPath, pagePath, clientPath]) {
  if (!fs.existsSync(path)) throw new Error(`Missing required file: ${path}`);
}

const migration = fs.readFileSync(migrationPath, "utf8");
const page = fs.readFileSync(pagePath, "utf8");
const client = fs.readFileSync(clientPath, "utf8");
const combined = `${migration}\n${page}\n${client}`;

const requiredMigrationFragments = [
  "library_current_user_is_admin",
  "admins read library author review rows",
  "admins read library publication metadata",
  "review_library_author_publication",
  "publish_library_author_publication",
  "request_changes",
  "approved",
  "rejected",
  "published_at",
  "published_by",
  "reviewed_by",
  "submission_status <> 'submitted'",
  "v_status <> 'approved'",
];

for (const fragment of requiredMigrationFragments) {
  if (!migration.includes(fragment)) throw new Error(`Missing review workflow guard: ${fragment}`);
}

if (!client.includes('supabase.rpc("review_library_author_publication"')) {
  throw new Error("Admin review UI must use the guarded review RPC.");
}
if (!client.includes('supabase.rpc("publish_library_author_publication"')) {
  throw new Error("Admin publish UI must use the guarded publish RPC.");
}
if (!client.includes('select("is_admin")')) {
  throw new Error("Admin review UI must preserve the existing is_admin UX gate.");
}
if (!client.includes("Publish to Library")) {
  throw new Error("Approved publications need an explicit separate publish control.");
}
if (!page.includes("robots")) {
  throw new Error("Admin review page must remain non-indexable.");
}

for (const forbidden of [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
  ".storage.",
  "library-publication-originals",
  "dangerouslySetInnerHTML",
]) {
  if (combined.includes(forbidden)) throw new Error(`Forbidden review workflow dependency: ${forbidden}`);
}

console.log("Library author review workflow verification passed.");
