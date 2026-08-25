import fs from "node:fs";

const migrationPath = "supabase/migrations/20260823073000_harden_library_unpublished_member_state.sql";
const boundaryPath = "src/components/library/library-reader-access-boundary.tsx";
const readerPagePath = "src/app/library/read/[publicationId]/page.tsx";

for (const path of [migrationPath, boundaryPath, readerPagePath]) {
  if (!fs.existsSync(path)) throw new Error(`Missing Library unpublished hardening file: ${path}`);
}

const migration = fs.readFileSync(migrationPath, "utf8");
const boundary = fs.readFileSync(boundaryPath, "utf8");
const readerPage = fs.readFileSync(readerPagePath, "utf8");

for (const fragment of [
  "library_publication_is_currently_published",
  "p.status = 'published'",
  "library_member_items",
  "library_reading_progress",
  "library_highlights",
  "library_notes",
  "library_bookmarks",
  "as restrictive",
  "for select",
]) {
  if (!migration.toLowerCase().includes(fragment.toLowerCase())) {
    throw new Error(`Missing unpublished member-state contract: ${fragment}`);
  }
}

const restrictiveCount = (migration.match(/as restrictive/gi) ?? []).length;
if (restrictiveCount < 5) {
  throw new Error(`Expected restrictive SELECT policies for five private Library tables, found ${restrictiveCount}`);
}

for (const fragment of [
  '.from("library_publications")',
  '.eq("id", publicationId)',
  '.eq("status", "published")',
  'This publication is no longer available.',
  'Back to Library',
]) {
  if (!boundary.includes(fragment)) {
    throw new Error(`Missing Reader access-boundary contract: ${fragment}`);
  }
}

for (const fragment of [
  "LibraryReaderAccessBoundary",
  "<LibraryReaderModernization",
  "<LibraryReaderSurface",
  "focus={focus}",
  "<LibraryDiscussPassageLauncher",
]) {
  if (!readerPage.includes(fragment)) {
    throw new Error(`Missing Reader route-boundary contract: ${fragment}`);
  }
}

if (readerPage.includes("LibraryResearchShortcut")) {
  throw new Error("Paginated Reader must not restore the superseded floating Research shortcut; Research remains reachable inside Reader controls.");
}

for (const forbidden of ["delete from public.library_member_items", "delete from public.library_highlights", "delete from public.library_notes"]) {
  if (migration.toLowerCase().includes(forbidden)) {
    throw new Error(`Unpublished hardening must preserve private state; found forbidden deletion: ${forbidden}`);
  }
}

console.log("Library unpublished access hardening verification passed.");
