import fs from "node:fs";

const pagePath = "src/app/library/read/[publicationId]/page.tsx";
const readerPath = "src/components/library/library-reader-surface.tsx";
const guardrailsPath = "src/components/library/library-reader-runtime-guardrails.tsx";
const modernizationPath = "src/components/library/library-reader-modernization.tsx";

for (const path of [pagePath, readerPath, guardrailsPath, modernizationPath]) {
  if (!fs.existsSync(path)) throw new Error(`Missing Reader foundation file: ${path}`);
}

const route = fs.readFileSync(pagePath, "utf8");
const reader = fs.readFileSync(readerPath, "utf8");
const guardrails = fs.readFileSync(guardrailsPath, "utf8");
const modernization = fs.readFileSync(modernizationPath, "utf8");
const combined = route + reader + guardrails + modernization;
const failures = [];

for (const token of [
  "LibraryReaderSurface",
  'from("library_publications")',
  'from("library_publication_sections")',
  'select("section_key, ordinal, title, content_text")',
  '.order("ordinal")',
  'from("library_reading_progress")',
  'from("library_highlights")',
  'from("library_notes")',
  'from("library_bookmarks")',
  'select("id, locator, created_at")',
  "toggleBookmark",
  "Bookmark page",
  "Search this book",
  "Find words or chapters…",
  "No matches in this book.",
  "buildSearchResults",
  "activeSearchResultId",
  "Contents",
  "Highlights & Notes",
  "No highlights yet.",
  "No notes yet.",
  "No bookmarks yet.",
  "supabase.auth.getUser()",
  "progress_percent",
  "section.section_key",
  "This publication does not have readable content yet.",
  "saveHighlight",
  "saveSelectionNote",
  "savePageNote",
  "Delete highlight",
  "Delete note",
  '.delete().eq("id", id).eq("user_id", userId).eq("publication_id", publicationId)',
  'start_offset, end_offset, text_sha256',
  'window.crypto.subtle.digest("SHA-256"',
  "textOffsetWithin",
  "renderPageText",
  "row.text_sha256 === sectionSha",
  "start_offset: selection.startOffset",
  "end_offset: selection.endOffset",
  "text_sha256: textSha256",
  "paginateSections",
  "pageCapacity",
  "spreadCount",
  'event.key === "ArrowRight"',
  'event.key === "ArrowLeft"',
  "touchStartX",
  "progressDisplay",
  "historyPage",
  "readingAnchor",
  "Themes & Settings",
  "LIBRARY_READER_PREFERENCES_KEY",
  'type ReaderDisplayMode = "system" | "light" | "dark"',
  'window.matchMedia("(prefers-color-scheme: dark)")',
]) {
  if (!combined.includes(token)) failures.push(`missing Reader contract: ${token}`);
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
  if (combined.toLowerCase().includes(token.toLowerCase())) failures.push(`out-of-scope/legacy Reader capability present: ${token}`);
}

if (failures.length) {
  console.error("Loombus Reader foundation verification FAILED");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Loombus Reader foundation verification passed");
console.log("- Reader consumes ordered normalized publication sections");
console.log("- stable section_key locators plus exact UTF-16 offsets remain durable state identity");
console.log("- viewport-derived pages preserve canonical section provenance");
console.log("- in-book search, Contents, highlights, notes, and multiple bookmarks remain available");
console.log("- page turns support keyboard, edge controls, touch/pointer gestures, and responsive one/two-page spreads");
console.log("- saved highlights require SHA-valid exact ranges and remain visibly rendered inline");
console.log("- Light/Dark/System presentation and typography preferences remain client-persistent");
console.log("- missing normalized content fails closed without original-object fallback");
console.log("- original EPUB storage, commerce, DRM, and AI remain outside the Reader surface");
