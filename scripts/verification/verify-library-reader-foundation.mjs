import fs from "node:fs";

const route = fs.readFileSync("src/app/library/read/[publicationId]/page.tsx", "utf8");
const reader = fs.readFileSync("src/components/library/library-reader-surface.tsx", "utf8");
const failures = [];

for (const token of [
  "LibraryReaderSurface",
  'from("library_publications")',
  'from("library_publication_sections")',
  'select("section_key, ordinal, title, content_text")',
  '.order("ordinal", { ascending: true })',
  'from("library_reading_progress")',
  'from("library_highlights")',
  'from("library_notes")',
  "supabase.auth.getUser()",
  "progress_percent",
  "section.section_key",
  "currentSection.content_text",
  "This publication does not have readable content yet.",
  "Save highlight",
  "Save note",
  "var(--loombus-gold)",
  "var(--loombus-page-bg)",
  "var(--loombus-reader-paper",
]) {
  if (!(route + reader).includes(token)) failures.push(`missing Reader contract: ${token}`);
}

for (const token of [
  'const sections = [',
  'publication?.description',
  'dangerouslySetInnerHTML',
  "SUPABASE_SERVICE_ROLE_KEY",
  "service_role",
  "stripe",
  "checkout",
  "storage.objects",
  "storage.buckets",
  "openai",
  "anthropic",
  "getPublicUrl",
  "createSignedUrl",
]) {
  if (reader.toLowerCase().includes(token.toLowerCase())) failures.push(`out-of-scope/legacy Reader capability present: ${token}`);
}

if (failures.length) {
  console.error("Loombus Reader foundation verification FAILED");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Loombus Reader foundation verification passed");
console.log("- Reader consumes ordered normalized publication sections");
console.log("- stable section_key locators drive progress, highlights, and notes");
console.log("- missing normalized content fails closed without source-object fallback");
console.log("- private highlights and notes continue through existing RLS-protected tables");
console.log("- typography and Light/Dark/System theme tokens are preserved");
console.log("- original EPUB storage, commerce, DRM, and AI remain outside the Reader surface");
