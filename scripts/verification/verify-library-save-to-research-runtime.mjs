import fs from "node:fs";

const routePath = "src/app/api/library/save-to-research/route.ts";
const launcherPath = "src/components/library/library-discuss-passage-launcher.tsx";
const researchPath = "src/components/library/library-research-surface.tsx";
const pagePath = "src/app/library/research/page.tsx";

for (const path of [routePath, launcherPath, researchPath, pagePath]) {
  if (!fs.existsSync(path)) throw new Error(`Missing Save to Research runtime file: ${path}`);
}

const route = fs.readFileSync(routePath, "utf8");
const launcher = fs.readFileSync(launcherPath, "utf8");
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

requireText(launcher, '"Save to Research"', "Reader Save to Research action");
requireText(launcher, 'fetch("/api/library/save-to-research"', "guarded server save call");
requireText(launcher, 'Authorization: `Bearer ${token}`', "member bearer forwarding");
requireText(launcher, 'href="/library/research"', "Research destination link");

requireText(research, '.from("library_research_items")', "private Research list/delete access");
requireText(research, '.delete()', "Research item deletion");
requireText(research, '.from("library_reading_progress").upsert', "saved chapter navigation");
requireText(research, 'window.location.href = `/library/read/${item.publication_id}`', "Reader return navigation");
requireText(page, '<LibraryResearchSurface />', "Research page wiring");

for (const [source, label] of [[route, "route"], [launcher, "launcher"], [research, "research surface"]]) {
  rejectText(source, "SUPABASE_SERVICE_ROLE_KEY", `${label} service-role access`);
  rejectText(source, "library-publication-originals", `${label} original EPUB access`);
  rejectText(source, "dangerouslySetInnerHTML", `${label} raw HTML rendering`);
}

console.log("PASS: Library Save to Research runtime preserves exact normalized-passage verification and private owner-scoped research access.");
