import fs from "node:fs";

const surfacePath = "src/components/library/library-evidence-knowledge-surface.tsx";
const pagePath = "src/app/library/research/evidence/page.tsx";
const researchPagePath = "src/app/library/research/page.tsx";

for (const path of [surfacePath, pagePath, researchPagePath]) {
  if (!fs.existsSync(path)) throw new Error(`Missing Evidence & Knowledge runtime file: ${path}`);
}

const surface = fs.readFileSync(surfacePath, "utf8");
const page = fs.readFileSync(pagePath, "utf8");
const researchPage = fs.readFileSync(researchPagePath, "utf8");

function requireText(source, text, label) {
  if (!source.includes(text)) throw new Error(`Missing ${label}: ${text}`);
}

function rejectText(source, text, label) {
  if (source.includes(text)) throw new Error(`Forbidden ${label}: ${text}`);
}

requireText(page, "<LibraryEvidenceKnowledgeSurface />", "workspace page wiring");
requireText(researchPage, 'href="/library/research/evidence"', "Research workspace navigation");
requireText(researchPage, "Evidence & Knowledge", "Research navigation label");

for (const table of [
  "library_research_items",
  "library_research_claims",
  "library_research_claim_evidence",
  "library_knowledge_objects",
  "library_knowledge_claims",
]) {
  requireText(surface, `.from(\"${table}\")`, `${table} runtime access`);
}

for (const relation of ["supports", "challenges", "context"]) {
  requireText(surface, `\"${relation}\"`, `evidence relation ${relation}`);
}
for (const role of ["core", "supporting", "counterpoint"]) {
  requireText(surface, `\"${role}\"`, `knowledge claim role ${role}`);
}
for (const type of ["claim", "question", "conclusion"]) {
  requireText(surface, `\"${type}\"`, `claim type ${type}`);
}
for (const type of ["synthesis", "finding", "open_question"]) {
  requireText(surface, `\"${type}\"`, `knowledge type ${type}`);
}

requireText(surface, '.from("library_reading_progress").upsert', "source chapter return progress update");
requireText(surface, 'window.location.href = `/library/read/${item.publication_id}`', "source Reader return");
requireText(surface, "Claims & Evidence", "claims workspace tab");
requireText(surface, "Knowledge Objects", "knowledge workspace tab");

rejectText(surface, '.from("library_research_items").update', "saved-passage provenance update");
rejectText(surface, 'SUPABASE_SERVICE_ROLE_KEY', "service-role access");
rejectText(surface, 'library-publication-originals', "original EPUB access");
rejectText(surface, 'dangerouslySetInnerHTML', "raw HTML rendering");

console.log("PASS: Library Evidence & Knowledge runtime preserves private passage -> evidence -> claim -> knowledge reasoning provenance.");
