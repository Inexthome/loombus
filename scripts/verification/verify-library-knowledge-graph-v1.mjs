import fs from "node:fs";

const files = {
  page: "src/app/library/research/evidence/graph/page.tsx",
  surface: "src/components/library/library-knowledge-graph-surface.tsx",
  entry: "src/app/library/research/evidence/page.tsx",
  researchNav: "src/components/library/library-research-editorial-nav.tsx",
};

for (const path of Object.values(files)) {
  if (!fs.existsSync(path)) throw new Error(`Missing ${path}`);
}

const surface = fs.readFileSync(files.surface, "utf8");
const entry = fs.readFileSync(files.entry, "utf8");
const researchNav = fs.readFileSync(files.researchNav, "utf8");

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
  "library_publications",
  "discussions",
];

for (const table of requiredTables) {
  if (!surface.includes(`from(\"${table}\")`)) throw new Error(`Knowledge Graph does not read ${table}`);
}

// Evidence and knowledge-membership vocabularies are data-driven from their
// canonical relation/role columns, so verify the runtime forwards those values
// into graph edges instead of requiring brittle literal strings in the UI source.
if (!surface.includes('row.relation')) throw new Error("Knowledge Graph must map canonical evidence relation values");
if (!surface.includes('row.role')) throw new Error("Knowledge Graph must map canonical knowledge-claim role values");

for (const relation of ["derived from opening post", "derived from reply", "promoted to discussion"]) {
  if (!surface.includes(relation)) throw new Error(`Missing fixed relationship vocabulary: ${relation}`);
}

if (!surface.includes("supabase.auth.getUser()")) throw new Error("Knowledge Graph must require authenticated member context");
if (!surface.includes("This graph is private and read-only")) throw new Error("Private/read-only boundary must be visible");
if (!entry.includes('<LibraryResearchEditorialNav active="evidence" />')) throw new Error("Evidence workspace must wire shared Research navigation");
if (!researchNav.includes('href: "/library/research/evidence/graph"') || !researchNav.includes('label: "Knowledge Graph"')) {
  throw new Error("Evidence workspace must expose Knowledge Graph entry");
}

const forbidden = ["SUPABASE_SERVICE_ROLE", "service_role", "library_publication_sources", "library-publication-originals", "dangerouslySetInnerHTML"];
for (const token of forbidden) {
  if (surface.includes(token)) throw new Error(`Forbidden Knowledge Graph access/rendering token: ${token}`);
}

for (const mutation of [".insert(", ".update(", ".delete(", ".upsert("]) {
  if (surface.includes(mutation)) throw new Error(`Knowledge Graph must remain read-only: ${mutation}`);
}

console.log("Library Knowledge Graph v1 verifier passed.");
