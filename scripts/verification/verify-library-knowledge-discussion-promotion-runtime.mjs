import fs from "node:fs";

const routePath = "src/app/api/library/knowledge-discussion/create/route.ts";
const surfacePath = "src/components/library/library-knowledge-discussion-promotion-surface.tsx";
const pagePath = "src/app/library/research/evidence/promote/page.tsx";
const evidencePagePath = "src/app/library/research/evidence/page.tsx";

for (const path of [routePath, surfacePath, pagePath, evidencePagePath]) {
  if (!fs.existsSync(path)) throw new Error(`Missing knowledge promotion runtime file: ${path}`);
}

const route = fs.readFileSync(routePath, "utf8");
const surface = fs.readFileSync(surfacePath, "utf8");
const page = fs.readFileSync(pagePath, "utf8");
const evidencePage = fs.readFileSync(evidencePagePath, "utf8");

function requireText(source, text, label) {
  if (!source.includes(text)) throw new Error(`Missing ${label}: ${text}`);
}

function rejectText(source, text, label) {
  if (source.includes(text)) throw new Error(`Forbidden ${label}: ${text}`);
}

requireText(route, 'authHeader?.startsWith("Bearer ")', "member bearer authentication");
requireText(route, 'supabase.auth.getUser(token)', "member session verification");
requireText(route, '.from("library_knowledge_objects")', "canonical knowledge re-fetch");
requireText(route, 'knowledge.updated_at !== sourceUpdatedAt', "knowledge version revalidation");
requireText(route, '.from("library_knowledge_claims")', "knowledge claim membership re-fetch");
requireText(route, '.from("library_research_claims")', "claim snapshot re-fetch");
requireText(route, 'current.statement !== requested.statement', "claim statement version check");
requireText(route, 'current.claim_type !== requested.claimType', "claim type version check");
requireText(route, 'current.status !== requested.status', "claim status version check");
requireText(route, 'role !== requested.role', "claim role version check");
requireText(route, 'fetch(new URL("/api/discussions/create", request.url)', "existing guarded discussion create path");
requireText(route, '.from("library_knowledge_discussion_promotions")', "private promotion provenance insert");
requireText(route, '.from("library_knowledge_discussion_claims")', "selected claim snapshot insert");

const createDiscussionIndex = route.indexOf('fetch(new URL("/api/discussions/create", request.url)');
const promotionIndex = route.indexOf('.from("library_knowledge_discussion_promotions")');
const claimSnapshotIndex = route.indexOf('.from("library_knowledge_discussion_claims")');
if (!(createDiscussionIndex >= 0 && promotionIndex > createDiscussionIndex && claimSnapshotIndex > promotionIndex)) {
  throw new Error("Promotion provenance must be recorded only after guarded discussion creation, with claim snapshots after the promotion row.");
}

requireText(surface, 'new Set()', "claims default unselected");
requireText(surface, 'const [confirmed, setConfirmed] = useState(false)', "explicit final confirmation default");
requireText(surface, 'I reviewed this exact public payload', "explicit public-boundary confirmation copy");
requireText(surface, 'Private evidence and Research data remain private.', "privacy boundary explanation");
requireText(surface, 'fetch("/api/library/knowledge-discussion/create"', "guarded promotion route call");
requireText(surface, 'Authorization: `Bearer ${token}`', "bearer forwarding");
requireText(surface, 'window.location.href = `/discussions/${discussionId}`', "successful public discussion navigation");
requireText(page, '<LibraryKnowledgeDiscussionPromotionSurface />', "promotion page wiring");
requireText(evidencePage, 'href="/library/research/evidence/promote"', "Evidence & Knowledge promotion entry");

for (const [source, label] of [[route, "route"], [surface, "surface"]]) {
  rejectText(source, "SUPABASE_SERVICE_ROLE_KEY", `${label} service-role access`);
  rejectText(source, "library-publication-originals", `${label} original EPUB access`);
  rejectText(source, "dangerouslySetInnerHTML", `${label} raw HTML rendering`);
}

for (const privateTable of [
  "library_research_claim_evidence",
  "library_research_item_metadata",
  "library_research_items",
]) {
  rejectText(route, `.from("${privateTable}")`, `promotion route private-data access to ${privateTable}`);
}

rejectText(route, '.from("discussions").insert', "parallel discussion insert bypass");
rejectText(surface, '.from("discussions")', "browser discussion mutation");

console.log("PASS: Library knowledge promotion runtime requires explicit review, revalidates approved knowledge/claim snapshots, uses the existing guarded discussion path, and keeps private Research evidence out of the public payload.");
