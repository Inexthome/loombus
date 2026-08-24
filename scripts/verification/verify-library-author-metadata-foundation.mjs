import fs from "node:fs";

const migrationPath = "supabase/migrations/20260824091500_add_library_author_metadata_foundation.sql";
if (!fs.existsSync(migrationPath)) throw new Error(`Missing ${migrationPath}`);
const sql = fs.readFileSync(migrationPath, "utf8");

for (const field of ["series_title", "series_position", "edition_label", "subjects", "audience_label"]) {
  const matches = sql.match(new RegExp(`add column if not exists ${field}\\b`, "g")) ?? [];
  if (matches.length < 2) throw new Error(`${field} must exist on canonical publications and version snapshots.`);
}

for (const fragment of [
  "library_normalize_subjects",
  "cardinality(p_subjects) > 12",
  "library_guard_immutable_publication_version",
  "new.series_title is distinct from old.series_title",
  "new.subjects is distinct from old.subjects",
  "update_library_author_bibliographic_metadata",
  "update_library_author_revision_bibliographic_metadata",
  "create_library_author_revision",
  "v_active.series_title",
  "publish_library_author_revision",
  "series_title=v_new.series_title",
  "subjects=v_new.subjects",
]) {
  if (!sql.includes(fragment)) throw new Error(`Missing versioned bibliographic metadata contract: ${fragment}`);
}

for (const fragment of [
  "get_library_published_author_profile",
  "if auth.uid() is null",
  "p.status = 'published'",
  "a.retired_at is null",
  "join public.profiles pr on pr.id = a.user_id",
  "grant execute on function public.get_library_published_author_profile(uuid) to authenticated",
]) {
  if (!sql.includes(fragment)) throw new Error(`Missing safe existing-profile identity bridge: ${fragment}`);
}

if (/create\s+table[^;]*library_author_profile/i.test(sql)) {
  throw new Error("Do not create a second Library author profile/identity table; profiles remains canonical.");
}
if (/grant execute on function public\.get_library_published_author_profile\(uuid\) to anon/i.test(sql)) {
  throw new Error("Library-to-profile identity bridge must remain authenticated-only.");
}
if (/page_count|pagecount/i.test(sql)) {
  throw new Error("EPUB page count is renderer-dependent and must not be introduced as canonical metadata.");
}
if (/SUPABASE_SERVICE_ROLE_KEY|service_role/i.test(sql)) {
  throw new Error("Author metadata foundation must not introduce service-role usage.");
}

console.log("Library author metadata foundation verification passed.");
