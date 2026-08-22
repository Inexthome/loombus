import fs from "node:fs";

const files = {
  graphPage: "src/app/library/research/evidence/graph/page.tsx",
  graph: "src/components/library/library-knowledge-graph-v2-surface.tsx",
  provenancePage: "src/app/library/research/evidence/provenance/page.tsx",
  focused: "src/components/library/library-focused-provenance-surface.tsx",
};

for (const path of Object.values(files)) {
  if (!fs.existsSync(path)) throw new Error(`Missing ${path}`);
}

const graphPage = fs.readFileSync(files.graphPage, "utf8");
const graph = fs.readFileSync(files.graph, "utf8");
const provenancePage = fs.readFileSync(files.provenancePage, "utf8");
const focused = fs.readFileSync(files.focused, "utf8");

if (!graphPage.includes("LibraryKnowledgeGraphV2Surface")) throw new Error("Graph route must render v2 surface");
if (!graph.includes("kindFilter") || !graph.includes("relationFilter") || !graph.includes("statusFilter")) throw new Error("Graph v2 filters are incomplete");
if (!graph.includes("Incoming") || !graph.includes("Outgoing")) throw new Error("Graph v2 must expose relationship directionality");
if (!graph.includes("Trace provenance")) throw new Error("Graph v2 must expose provenance traversal");
if (!graph.includes("focusKind=") || !graph.includes("focusId=") || !graph.includes("relation=")) throw new Error("Graph v2 provenance links must carry focused edge context");

for (const table of [
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
]) {
  if (!graph.includes(`from(\"${table}\")`)) throw new Error(`Graph v2 does not read ${table}`);
}

for (const relation of ["derived from opening post", "derived from reply", "promoted to discussion"]) {
  if (!graph.includes(relation)) throw new Error(`Graph v2 missing fixed relationship: ${relation}`);
}
if (!graph.includes("row.relation") || !graph.includes("row.role")) throw new Error("Graph v2 must preserve canonical evidence and membership relationship labels");
if (!graph.includes("supabase.auth.getUser()")) throw new Error("Graph v2 must require authenticated member context");
if (!graph.includes("private and read-only")) throw new Error("Graph v2 privacy/read-only boundary must be visible");

if (!provenancePage.includes("LibraryFocusedProvenanceSurface") || !provenancePage.includes("focusKind") || !provenancePage.includes("focusId") || !provenancePage.includes("relation")) {
  throw new Error("Provenance route must support focused graph traces");
}
if (!focused.includes("Focused provenance trace")) throw new Error("Focused provenance surface must identify itself");
if (!focused.includes("supabase.auth.getUser()")) throw new Error("Focused provenance must require authenticated member context");

for (const forbidden of ["SUPABASE_SERVICE_ROLE", "service_role", "library_publication_sources", "library-publication-originals", "dangerouslySetInnerHTML"]) {
  if (graph.includes(forbidden) || focused.includes(forbidden)) throw new Error(`Forbidden Knowledge Graph v2 token: ${forbidden}`);
}
for (const mutation of [".insert(", ".update(", ".delete(", ".upsert("]) {
  if (graph.includes(mutation) || focused.includes(mutation)) throw new Error(`Knowledge Graph v2 must remain read-only: ${mutation}`);
}

console.log("Library Knowledge Graph v2 verifier passed.");
