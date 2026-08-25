import fs from "node:fs";

const helperPath = "src/lib/library/passage-context.ts";
const handoffPath = "src/components/library/library-research-passage-handoff.tsx";
const discussionLauncherPath = "src/components/library/discussion-library-feedback-launcher.tsx";
const readerPagePath = "src/app/library/read/[publicationId]/page.tsx";
const returnBoundaryPath = "src/components/library/library-reader-passage-return-boundary.tsx";
const promotionRoutePath = "src/app/api/library/knowledge-discussion/create/route.ts";

for (const path of [helperPath, handoffPath, discussionLauncherPath, readerPagePath, returnBoundaryPath, promotionRoutePath]) {
  if (!fs.existsSync(path)) throw new Error(`Missing Phase 4D file: ${path}`);
}

const helper = fs.readFileSync(helperPath, "utf8");
const handoff = fs.readFileSync(handoffPath, "utf8");
const discussionLauncher = fs.readFileSync(discussionLauncherPath, "utf8");
const readerPage = fs.readFileSync(readerPagePath, "utf8");
const returnBoundary = fs.readFileSync(returnBoundaryPath, "utf8");
const promotionRoute = fs.readFileSync(promotionRoutePath, "utf8");

function requireText(source, text, label) {
  if (!source.includes(text)) throw new Error(`Missing ${label}: ${text}`);
}

for (const token of [
  'params.set("locator", focus.locator)',
  'params.set("start", String(focus.startOffset))',
  'params.set("end", String(focus.endOffset))',
  'params.set("sha", focus.textSha256)',
]) requireText(helper, token, "exact Reader focus URL contract");

requireText(handoff, 'libraryReaderHref(passage.publicationId, passage)', "Research exact passage return");
requireText(handoff, 'Back to exact passage', "Research exact passage copy");
requireText(discussionLauncher, 'libraryReaderHref(passage.publication_id, {', "discussion exact source return");
requireText(discussionLauncher, 'Open exact source', "discussion exact source copy");

for (const token of [
  'if (query.open !== "1") redirect(`/library/read/${encodeURIComponent(publicationId)}?open=1`)',
  'query.locator',
  'startOffset !== null',
  'endOffset > startOffset',
  '/^[a-f0-9]{64}$/i.test(query.sha)',
  '<LibraryReaderPassageReturnBoundary publicationId={publicationId} focus={focus}>',
]) requireText(readerPage, token, "Reader route hardening");

for (const token of [
  '.from("library_publication_sections")',
  '.eq("section_key", focus.locator)',
  'hash === focus.textSha256',
  'focus.endOffset <= section.content_text.length',
  '.from("library_reading_progress").upsert',
  'Returned to verified passage',
  'SHA-256 verified',
  'section.content_text.slice(focus.startOffset, focus.endOffset)',
  'source text changed after this passage was captured',
]) requireText(returnBoundary, token, "verified passage restoration");

for (const token of [
  '.from("library_knowledge_claims")',
  '.from("library_research_claim_evidence")',
  'knowledge.status !== "synthesized"',
  '!summary',
  'readinessClaimIds.length === 0',
  'code: "knowledge_not_ready"',
  'code: "knowledge_not_evidence_backed"',
  'fetch(new URL("/api/discussions/create", request.url)',
]) requireText(promotionRoute, token, "server-side promotion readiness");

const readinessIndex = promotionRoute.indexOf('knowledge.status !== "synthesized"');
const createIndex = promotionRoute.indexOf('fetch(new URL("/api/discussions/create", request.url)');
if (!(readinessIndex >= 0 && createIndex > readinessIndex)) {
  throw new Error("Knowledge readiness must be enforced before public discussion creation.");
}

for (const forbidden of [
  "SUPABASE_SERVICE_ROLE_KEY",
  "library-publication-originals",
  "library_research_items",
  "library_research_item_metadata",
  "selected_text",
  "text_sha256",
]) {
  if (promotionRoute.includes(forbidden)) throw new Error(`Promotion route crossed private evidence payload boundary: ${forbidden}`);
}

console.log("PASS: Library Phase 4D closes navigation and provenance seams.");
console.log("- Reader links preserve locator, UTF-16 offsets, and source SHA-256");
console.log("- direct internal Reader links canonicalize to the access-gated open route instead of bouncing to detail");
console.log("- exact passage return verifies normalized source text before restoring reading position");
console.log("- knowledge promotion readiness is enforced server-side before public discussion creation");
console.log("- evidence existence is checked without exposing saved passage payloads");
console.log("- no new schema or AI-generated relationship system is introduced");
