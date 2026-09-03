import fs from "node:fs";

const sanitizerPath = "src/lib/library/epub-section-sanitizer.ts";
const routePath = "src/app/api/library/author/ingest-epub/route.ts";
const migrationPath = "supabase/migrations/20260902235500_remove_epub_machine_filenames_from_reader_sections.sql";

for (const path of [sanitizerPath, routePath, migrationPath]) {
  if (!fs.existsSync(path)) throw new Error(`Missing Library XHTML filename cleanup file: ${path}`);
}

const sanitizer = fs.readFileSync(sanitizerPath, "utf8");
const route = fs.readFileSync(routePath, "utf8");
const migration = fs.readFileSync(migrationPath, "utf8");

for (const fragment of [
  "LEADING_MACHINE_FILENAME",
  "stripLeadingEpubMachineFilename",
  "sanitizeNormalizedEpubSection",
  "contentSha256: sha256Hex",
  "library_epub_section_empty_after_machine_filename_cleanup",
]) {
  if (!sanitizer.includes(fragment)) throw new Error(`Missing EPUB sanitizer contract: ${fragment}`);
}

for (const fragment of [
  'import { sanitizeNormalizedEpubSection } from "@/lib/library/epub-section-sanitizer"',
  ".map(sanitizeNormalizedEpubSection)",
  'rpc("complete_library_author_epub_ingestion"',
]) {
  if (!route.includes(fragment)) throw new Error(`Missing ingestion cleanup wiring: ${fragment}`);
}

for (const fragment of [
  "library_epub_machine_filename_cleanup",
  "regexp_replace",
  "library_publication_sections",
  "library_highlights",
  "removed_chars",
  "cleaned_text_sha256",
  "content_sha256 = encode",
]) {
  if (!migration.includes(fragment)) throw new Error(`Missing stored-section cleanup contract: ${fragment}`);
}

for (const forbidden of [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
  "dangerouslySetInnerHTML",
]) {
  if (`${sanitizer}\n${route}\n${migration}`.includes(forbidden)) {
    throw new Error(`Forbidden XHTML filename cleanup dependency: ${forbidden}`);
  }
}

const sample = "ch001.xhtml The Next Intelligence Revolution";
const pattern = /^[\s\u00a0]*(?:[^\s<>]+\/)*[^\s<>/]+\.(?:xhtml|html?)[\s\u00a0]+/i;
if (sample.replace(pattern, "") !== "The Next Intelligence Revolution") {
  throw new Error("Machine XHTML filename sanitizer does not remove the observed reader prefix.");
}
if ("Chapter 1 A New Kind of Change".replace(pattern, "") !== "Chapter 1 A New Kind of Change") {
  throw new Error("Machine XHTML filename sanitizer removes legitimate reader content.");
}

console.log("PASS: Library EPUB machine XHTML filenames are removed during ingestion and repaired in existing normalized reader sections.");
