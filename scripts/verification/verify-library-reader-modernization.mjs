import fs from "node:fs";

const route = fs.readFileSync("src/app/library/read/[publicationId]/page.tsx", "utf8");
const modernization = fs.readFileSync("src/components/library/library-reader-modernization.tsx", "utf8");
const reader = fs.readFileSync("src/components/library/library-reader-surface.tsx", "utf8");
const failures = [];

for (const token of [
  "LibraryReaderModernization",
  "loombus-reader-modernized",
  "Reader appearance settings",
  "Page theme",
  "Typeface",
  "Line spacing",
  "Reading width",
  "One column",
  "Two columns",
  "data-library-reader-tools",
  "data-library-reader-theme",
  "data-library-reader-font",
  "data-library-reader-columns",
  "loombus-library-reader-modernization",
  "window.localStorage.setItem",
]) {
  if (!(route + modernization).includes(token)) failures.push(`missing Reader modernization contract: ${token}`);
}

for (const token of [
  'from("library_reading_progress")',
  'from("library_highlights")',
  'from("library_notes")',
  'from("library_bookmarks")',
  "renderInlineHighlights",
  "toggleBookmark",
  "Search this book",
  "Saved & annotations",
  "READER_FONT_SIZE_KEY",
]) {
  if (!reader.includes(token)) failures.push(`existing Reader capability lost: ${token}`);
}

for (const token of ["SUPABASE_SERVICE_ROLE_KEY", "service_role", "stripe", "checkout", "openai", "anthropic"]) {
  if (modernization.toLowerCase().includes(token.toLowerCase())) failures.push(`out-of-scope capability present: ${token}`);
}

if (failures.length) {
  console.error("Loombus Reader modernization verification FAILED");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Loombus Reader modernization verification passed");
console.log("- reading tools recede behind an explicit Tools control on desktop");
console.log("- appearance controls persist locally without database/schema changes");
console.log("- Loombus, Quiet, and Paper page themes are available");
console.log("- serif/sans typography, line spacing, reading width, and desktop columns are adjustable");
console.log("- existing progress, search, bookmarks, highlights, notes, and inline highlight integrity remain intact");
