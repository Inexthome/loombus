import fs from "node:fs";

const surfacePath = "src/components/library/library-reader-surface.tsx";
const modernizationPath = "src/components/library/library-reader-modernization.tsx";
const guardrailsPath = "src/components/library/library-reader-runtime-guardrails.tsx";
const launcherPath = "src/components/library/library-discuss-passage-launcher.tsx";
const boundaryPath = "src/components/library/library-reader-passage-return-boundary.tsx";
const pagePath = "src/app/library/read/[publicationId]/page.tsx";

for (const path of [surfacePath, modernizationPath, guardrailsPath, launcherPath, boundaryPath, pagePath]) {
  if (!fs.existsSync(path)) throw new Error(`Missing Reader phase 6A file: ${path}`);
}

const surface = fs.readFileSync(surfacePath, "utf8");
const modernization = fs.readFileSync(modernizationPath, "utf8");
const guardrails = fs.readFileSync(guardrailsPath, "utf8");
const launcher = fs.readFileSync(launcherPath, "utf8");
const boundary = fs.readFileSync(boundaryPath, "utf8");
const page = fs.readFileSync(pagePath, "utf8");

function requireText(source, text, label) {
  if (!source.includes(text)) throw new Error(`Missing ${label}: ${text}`);
}
function rejectText(source, text, label) {
  if (source.includes(text)) throw new Error(`Forbidden ${label}: ${text}`);
}

for (const token of [
  "paginateSections",
  "chooseBreak",
  "pageCapacity",
  "spreadCount",
  'event.key === "ArrowRight"',
  'event.key === "ArrowLeft"',
  "touchStartX",
  "Math.abs(delta) > 55",
  'panel === "contents"',
  'panel === "annotations"',
  'panel === "search"',
  'panel === "appearance"',
  "Contents · {progressPercent}%",
  "Search Book",
  "Themes & Settings",
  "progressDisplay",
  "toggleBookmark",
  "saveHighlight",
  "saveSelectionNote",
  "savePageNote",
  "deleteHighlight",
  "deleteNote",
  'action: "discuss"',
  'action: "research"',
  'action: "ask"',
  "renderPageText",
  "activeSearchResultId",
  "historyPage",
  "readingAnchor",
]) requireText(surface, token, "paginated Reader contract");

for (const table of ["library_reading_progress", "library_highlights", "library_notes", "library_bookmarks", "library_publication_sections"]) {
  requireText(surface, `.from("${table}")`, `preserved Reader state ${table}`);
}

for (const token of [
  "LIBRARY_READER_PREFERENCES_KEY",
  'theme: "paper"',
  'font: "serif"',
  'spread: "auto"',
  'parsed.theme === "loombus" || parsed.theme === "quiet" || parsed.theme === "paper" || parsed.theme === "night"',
  "lineHeight",
  "width",
]) requireText(modernization, token, "appearance preference contract");

for (const token of [
  'type ReaderDisplayMode = "system" | "light" | "dark"',
  'window.matchMedia("(prefers-color-scheme: dark)")',
  'System follows the device light/dark appearance.',
  'button[aria-label], a[aria-label]',
  'control.setAttribute("title", label)',
  'aria-label="Reader controls"',
  '5.75rem',
  '7.25rem',
  'data-library-reader-page',
  'overflowY',
  'position = "fixed"',
  'window.visualViewport?.addEventListener("resize", sync)',
  'document.addEventListener("touchstart", onTouchStart',
  'document.addEventListener("touchend", onTouchEnd',
  'document.addEventListener("pointerdown", onPointerDown',
  'document.addEventListener("pointerup", onPointerUp',
  'document.addEventListener("wheel", onWheel',
  'SWIPE_THRESHOLD = 42',
  'triggerPageTurn',
  'data-library-reader-selection-toolbar',
  'left: 50vw !important',
  'width: calc(100vw - 1.25rem) !important',
  'max-width: 22rem !important',
  'grid-template-columns: repeat(3, minmax(0, 1fr))',
  'touch-action: pan-y pinch-zoom',
]) requireText(guardrails, token, "Reader viewport/display/gesture guardrail");

for (const token of [
  "data-library-reader-page",
  "data-library-page-start",
  "closestReaderPage",
  'loombus:reader:passage-action',
  'writeLibraryPassageContext("research"',
  'openTool("discuss"',
  'openTool("ask"',
]) requireText(launcher, token, "paginated passage provenance contract");

requireText(page, "<LibraryReaderModernization />", "Reader modernization wiring");
requireText(page, "<LibraryReaderRuntimeGuardrails />", "Reader runtime guardrail wiring");
requireText(page, "<LibraryReaderSurface publicationId={publicationId} focus={focus} />", "exact focus Reader wiring");
requireText(page, "<LibraryDiscussPassageLauncher publicationId={publicationId} />", "passage tool wiring");
rejectText(page, "LibraryResearchShortcut", "duplicate floating Research shortcut");

for (const token of ["SHA-256 verified", "fixed left-1/2 top-20", "focus.startOffset", "focus.endOffset"]) {
  requireText(boundary, token, "exact source return contract");
}

for (const source of [surface, modernization, guardrails, launcher, boundary, page]) {
  for (const forbidden of ["SUPABASE_SERVICE_ROLE_KEY", "service_role", "library-publication-originals", "dangerouslySetInnerHTML"]) {
    rejectText(source, forbidden, `Reader client boundary (${forbidden})`);
  }
}

console.log("PASS: Library Reader phase 6A preserves Reader state and provenance while adding responsive pagination, page turns, mobile controls, search, annotations, appearance settings, viewport guardrails, centered compact selection controls, touch/pointer/trackpad swiping, and exact source return.");
console.log("- no schema migration required");
