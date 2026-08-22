import fs from "node:fs";

const routePath = "src/app/api/library/discussion-feedback/create/route.ts";
const surfacePath = "src/components/library/library-discussion-feedback-surface.tsx";
const launcherPath = "src/components/library/discussion-library-feedback-launcher.tsx";
const pagePath = "src/app/library/research/from-discussion/page.tsx";
const discussionPagePath = "src/app/discussions/[id]/page.tsx";

for (const path of [routePath, surfacePath, launcherPath, pagePath, discussionPagePath]) {
  if (!fs.existsSync(path)) throw new Error(`Missing discussion feedback runtime file: ${path}`);
}

const route = fs.readFileSync(routePath, "utf8");
const surface = fs.readFileSync(surfacePath, "utf8");
const launcher = fs.readFileSync(launcherPath, "utf8");
const discussionPage = fs.readFileSync(discussionPagePath, "utf8");

function requireText(source, text, label) {
  if (!source.includes(text)) throw new Error(`Missing ${label}: ${text}`);
}
function rejectText(source, text, label) {
  if (source.includes(text)) throw new Error(`Forbidden ${label}: ${text}`);
}

requireText(surface, "selectionStart", "exact UTF-16 start capture");
requireText(surface, "selectionEnd", "exact UTF-16 end capture");
requireText(surface, 'crypto.subtle.digest("SHA-256"', "browser body SHA binding");
requireText(surface, "20–4000", "selection range guidance");
requireText(surface, "Save private", "explicit private save action");
requireText(surface, 'mode === "claim"', "claim derivation mode");
requireText(surface, 'mode === "knowledge"', "knowledge derivation mode");

requireText(route, '.from("discussions")', "canonical discussion refetch");
requireText(route, "canonicalHash !== bodySha256", "discussion body SHA verification");
requireText(route, "canonicalBody.slice(startOffset, endOffset) !== selectedText", "exact UTF-16 substring verification");
requireText(route, '.from("library_research_claims")', "private claim creation");
requireText(route, '.from("library_knowledge_objects")', "private knowledge creation");
requireText(route, '.from("library_discussion_claim_derivations")', "claim provenance insert");
requireText(route, '.from("library_discussion_knowledge_derivations")', "knowledge provenance insert");

requireText(launcher, "/library/research/from-discussion?discussionId=", "discussion feedback navigation");
requireText(discussionPage, "<DiscussionLibraryFeedbackLauncher />", "discussion detail launcher wiring");

for (const forbidden of [
  "library_research_items",
  "library_research_claim_evidence",
  "library_research_item_metadata",
  "library-publication-originals",
  "SUPABASE_SERVICE_ROLE_KEY",
  "dangerouslySetInnerHTML",
]) {
  rejectText(route, forbidden, `private/source boundary in route (${forbidden})`);
}

console.log("PASS: Library discussion feedback runtime validates exact discussion-body selections and creates new private claim/knowledge objects without mutating the existing research chain.");
