import fs from "node:fs";

const page = fs.readFileSync("src/app/library/research/evidence/graph/page.tsx", "utf8");
const surface = fs.readFileSync("src/components/library/library-knowledge-graph-v3-surface.tsx", "utf8");
if (!["LibraryKnowledgeGraphV3Surface", "LibraryKnowledgeGraphV4Surface", "LibraryKnowledgeGraphV5Surface", "LibraryKnowledgeGraphV6Surface"].some((token) => page.includes(token))) throw new Error("Graph route must render v3 or approved successor surface");
for (const table of ["library_research_claims","library_knowledge_objects","library_research_items","library_research_claim_evidence","library_knowledge_claims","library_discussion_claim_derivations","library_discussion_knowledge_derivations","library_reply_claim_derivations","library_reply_knowledge_derivations","library_knowledge_discussion_promotions","library_publications","discussions"]) if (!surface.includes(`from(\"${table}\")`)) throw new Error(`Missing graph source: ${table}`);
for (const token of ["<svg", "<line", "<rect", "markerEnd", "viewBox", "Zoom in", "Zoom out", "Topology inspector", "Trace provenance"]) if (!surface.includes(token)) throw new Error(`Missing visual topology contract: ${token}`);
for (const relation of ["derived from opening post", "derived from reply", "promoted to discussion"]) if (!surface.includes(relation)) throw new Error(`Missing fixed relation: ${relation}`);
if (!surface.includes("row.relation") && !surface.includes("r.relation")) throw new Error("Evidence labels must come from stored relation");
if (!surface.includes("r.role")) throw new Error("Knowledge membership labels must come from stored role");
if (!surface.includes("supabase.auth.getUser()") || !surface.includes("This graph is private and read-only")) throw new Error("Graph auth/privacy contract incomplete");
for (const forbidden of ["SUPABASE_SERVICE_ROLE", "service_role", "library_publication_sources", "library-publication-originals", "dangerouslySetInnerHTML", ".insert(", ".update(", ".delete(", ".upsert("]) if (surface.includes(forbidden)) throw new Error(`Forbidden graph token: ${forbidden}`);
console.log("Library Knowledge Graph v3 verifier passed.");
