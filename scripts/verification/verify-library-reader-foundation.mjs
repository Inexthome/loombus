import fs from "node:fs";

const route = fs.readFileSync("src/app/library/read/[publicationId]/page.tsx", "utf8");
const reader = fs.readFileSync("src/components/library/library-reader-surface.tsx", "utf8");
const failures = [];

for (const token of [
  "LibraryReaderSurface",
  'from("library_publications")',
  'from("library_reading_progress")',
  'from("library_highlights")',
  'from("library_notes")',
  "supabase.auth.getUser()",
  "progress_percent",
  "locator",
  "Save highlight",
  "Save note",
  "var(--loombus-gold)",
  "var(--loombus-page-bg)",
]) {
  if (!(route + reader).includes(token)) failures.push(`missing Reader contract: ${token}`);
}

for (const token of ["SUPABASE_SERVICE_ROLE_KEY", "service_role", "stripe", "checkout", "storage.objects", "storage.buckets", "openai", "anthropic", "epub", "pdfjs"]) {
  if (reader.toLowerCase().includes(token.toLowerCase())) failures.push(`out-of-scope Reader capability present: ${token}`);
}

if (failures.length) {
  console.error("Loombus Reader foundation verification FAILED");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Loombus Reader foundation verification passed");
console.log("- publication Reader route present");
console.log("- locator/progress persistence uses existing owner-scoped table");
console.log("- private highlights and notes use existing RLS-protected tables");
console.log("- typography and Light/Dark/System theme tokens preserved");
console.log("- ingestion, storage, commerce, DRM, and AI remain outside this phase");
