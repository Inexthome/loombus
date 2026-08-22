import fs from "node:fs";

const files = {
  page: "src/app/library/research/evidence/provenance/page.tsx",
  surface: "src/components/library/library-knowledge-provenance-surface.tsx",
  evidencePage: "src/app/library/research/evidence/page.tsx",
};

for (const path of Object.values(files)) {
  if (!fs.existsSync(path)) throw new Error(`Missing ${path}`);
}

const page = fs.readFileSync(files.page, "utf8");
const surface = fs.readFileSync(files.surface, "utf8");
const evidencePage = fs.readFileSync(files.evidencePage, "utf8");

const requiredTables = [
  "library_research_claims",
  "library_knowledge_objects",
  "library_research_items",
  "library_research_claim_evidence",
  "library_knowledge_claims",
  "library_discussion_claim_derivations",
  "library_discussion_knowledge_derivations",
  "library_reply_claim_derivations",
  "library_reply_knowledge_derivations",
  "library_knowledge_discussion_promotions",
  "library_knowledge_discussion_claims",
];

for (const table of requiredTables) {
  if (!surface.includes(`from(\"${table}\")`)) throw new Error(`Provenance surface does not read ${table}`);
}

for (const token of [
  "/library/research/evidence/provenance",
  "Provenance",
  "Promote to Discussion",
]) {
  if (!evidencePage.includes(token)) throw new Error(`Evidence page missing ${token}`);
}

for (const token of [
  "Derived from opening post",
  "Derived from reply",
  "Saved passage",
  "Promoted to public discussion",
  "Later published through knowledge",
  "/library/read/",
  "/discussions/",
]) {
  if (!surface.includes(token)) throw new Error(`Provenance surface missing ${token}`);
}

for (const forbidden of [
  "service_role",
  "SUPABASE_SERVICE_ROLE",
  "dangerouslySetInnerHTML",
  "library_publication_sources",
  "library-publication-originals",
]) {
  if (surface.includes(forbidden)) throw new Error(`Forbidden provenance access/pattern: ${forbidden}`);
}

if (!page.includes("LibraryKnowledgeProvenanceSurface")) throw new Error("Provenance page is not wired to its surface");
if (!surface.includes("supabase.auth.getUser()")) throw new Error("Provenance surface must require authenticated member context");

console.log("Library knowledge provenance UI verification passed.");
