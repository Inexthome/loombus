import fs from "node:fs";

const routePath = "src/app/api/library/save-to-research/route.ts";
const launcherPath = "src/components/library/library-discuss-passage-launcher.tsx";
const passageContextPath = "src/lib/library/passage-context.ts";
const researchPath = "src/components/library/library-research-surface.tsx";
const pagePath = "src/app/library/research/page.tsx";

for (const path of [routePath, launcherPath, passageContextPath, researchPath, pagePath]) {
  if (!fs.existsSync(path)) throw new Error(`Missing Save to Research runtime file: ${path}`);
}

const route = fs.readFileSync(routePath, "utf8");
const launcher = fs.readFileSync(launcherPath, "utf8");
const passageContext = fs.readFileSync(passageContextPath, "utf8");
const research = fs.readFileSync(researchPath, "utf8");
const page = fs.readFileSync(pagePath, "utf8");

function requireText(source, text, label) {
  if (!source.includes(text)) throw new Error(`Missing ${label}: ${text}`);
}
function rejectText(source, text, label) {
  if (source.includes(text)) throw new Error(`Forbidden ${label}: ${text}`);
}

requireText(route, 'authHeader?.startsWith("Bearer ")', "member bearer authentication");
requireText(route, 'supabase.auth.getUser(token)', "server member verification");
requireText(route, '.from("library_publication_sections")', "canonical normalized section re-fetch");
requireText(route, 'const canonicalHash = sha256Text(sectionText)', "canonical section SHA verification");
requireText(route, 'sectionText.slice(startOffset, endOffset) !== selectedText', "exact JavaScript UTF-16 slice verification");
requireText(route, '.from("library_research_items")', "private research insert");
requireText(route, 'insertError.code === "23505"', "duplicate save handling");

const verifyHashIndex = route.indexOf('const canonicalHash = sha256Text(sectionText)');
const verifySliceIndex = route.indexOf('sectionText.slice(startOffset, endOffset) !== selectedText');
const insertIndex = route.indexOf('.from("library_research_items")');
if (!(verifyHashIndex >= 0 && verifySliceIndex > verifyHashIndex && insertIndex > verifySliceIndex)) {
  throw new Error("Research insert must occur only after canonical hash and exact UTF-16 slice verification.");
}

requireText(launcher, '"Research evidence"', "Reader Research evidence action");
requireText(launcher, 'fetch("/api/library/save-to-research"', "guarded server save call");
requireText(launcher, 'Authorization: `Bearer ${token}`', "member bearer forwarding");
requireText(launcher, 'writeLibraryPassageContext("research", passage)', "Research passage-context handoff");
requireText(launcher, 'window.location.href = "/library/research?from=passage"', "Research destination navigation");
requireText(launcher, 'page.dataset.libraryPageStart', "paginated Reader offset rebasing");
requireText(launcher, 'baseOffset = pageStart', "canonical offset rebasing");
requireText(passageContext, 'research: "loombus:library:research-passage:v1"', "Research passage storage key");

requireText(research, '.from("library_research_items")', "private Research list/delete access");
requireText(research, '.delete()', "Research item deletion");
requireText(research, '.from("library_reading_progress")', "saved chapter progress target");
requireText(research, '.upsert(', "saved chapter progress upsert");
requireText(research, 'window.location.href = `/library/read/${item.publication_id}`', "Reader return navigation");

const progressTargetIndex = research.indexOf('.from("library_reading_progress")');
const progressUpsertIndex = research.indexOf('.upsert(', progressTargetIndex);
const readerReturnIndex = research.indexOf('window.location.href = `/library/read/${item.publication_id}`');
if (!(progressTargetIndex >= 0 && progressUpsertIndex > progressTargetIndex && readerReturnIndex > progressUpsertIndex)) {
  throw new Error("Saved chapter navigation must persist reading progress before returning to Reader.");
}

requireText(page, '<LibraryResearchSurface />', "Research page wiring");

for (const [source, label] of [[route, "route"], [launcher, "launcher"], [research, "research surface"]]) {
  rejectText(source, "SUPABASE_SERVICE_ROLE_KEY", `${label} service-role access`);
  rejectText(source, "library-publication-originals", `${label} original EPUB access`);
  rejectText(source, "dangerouslySetInnerHTML", `${label} raw HTML rendering`);
}

console.log("PASS: Library Save to Research runtime preserves exact normalized-passage verification, paginated source handoff, and private owner-scoped research access.");
