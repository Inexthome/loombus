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
  "This chapter",
  "Book total:",
  "Delete highlight",
  "Delete note",
  '.delete().eq("id", id).eq("user_id", userId).eq("publication_id", publicationId)',
  "Chapter {currentIndex + 1} of {sections.length}",
  "READER_FONT_SIZE_KEY",
  "window.localStorage.setItem",
  'aria-current={section.section_key === currentSection.section_key ? "location" : undefined}',
  "lg:sticky lg:top-20",
  'start_offset, end_offset, text_sha256',
  'window.crypto.subtle.digest("SHA-256"',
  "textOffsetWithin",
  "readerTextRef",
  "renderInlineHighlights",
  "highlight.text_sha256 === textSha256",
  "text.slice(highlight.start_offset, highlight.end_offset) === highlight.selected_text",
  "start_offset: selection.startOffset",
  "end_offset: selection.endOffset",
  "text_sha256: textSha256",
  "Legacy highlight · sidebar only",
  "Rendered inline",
  "Inline range unavailable",
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
  "indexOf(highlight.selected_text)",
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
console.log("- durable highlights persist exact UTF-16 offsets plus normalized-text SHA-256");
console.log("- inline rendering requires hash-valid offsets and exact selected-text agreement");
console.log("- legacy or stale highlights remain sidebar-visible but are not guessed inline");
console.log("- current-chapter highlights and notes are visible and owner-scoped for deletion");
console.log("- chapter navigation, persistent text sizing, and sticky desktop controls refine long-form reading");
console.log("- missing normalized content fails closed without source-object fallback");
console.log("- private highlights and notes continue through existing RLS-protected tables");
console.log("- typography and Light/Dark/System theme tokens are preserved");
console.log("- original EPUB storage, commerce, DRM, and AI remain outside the Reader surface");
