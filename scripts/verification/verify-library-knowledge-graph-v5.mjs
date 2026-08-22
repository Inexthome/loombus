import fs from "node:fs";

const page = fs.readFileSync("src/app/library/research/evidence/graph/page.tsx", "utf8");
const surface = fs.readFileSync("src/components/library/library-knowledge-graph-v5-surface.tsx", "utf8");
if (!["LibraryKnowledgeGraphV5Surface", "LibraryKnowledgeGraphV6Surface", "LibraryKnowledgeGraphV7Surface"].some((token) => page.includes(token))) throw new Error("Graph route must render v5 or approved successor surface");
for (const token of ["findShortestPath", "maxHops", "Either direction", "Recorded direction only", "Shortest recorded path", "Saved graph views", "localStorage", "Trace provenance", "LibraryKnowledgeGraphV4Surface"]) if (!surface.includes(token)) throw new Error(`Missing v5 semantic exploration contract: ${token}`);
for (const table of ["library_research_claims","library_knowledge_objects","library_research_items","library_research_claim_evidence","library_knowledge_claims","library_discussion_claim_derivations","library_discussion_knowledge_derivations","library_reply_claim_derivations","library_reply_knowledge_derivations","library_knowledge_discussion_promotions","library_publications","discussions"]) if (!surface.includes(`from(\"${table}\")`)) throw new Error(`Missing v5 graph source: ${table}`);
for (const relation of ["derived from opening post", "derived from reply", "promoted to discussion"]) if (!surface.includes(relation)) throw new Error(`Missing v5 fixed relation: ${relation}`);
if (!surface.includes("row.relation") || !surface.includes("row.role")) throw new Error("V5 must keep canonical data-driven relation labels");
if (!surface.includes("supabase.auth.getUser()")) throw new Error("V5 semantic explorer must require authenticated member context");
if (!surface.includes("do not create or infer new facts")) throw new Error("V5 must state the no-new-truth semantic boundary");
for (const forbidden of ["SUPABASE_SERVICE_ROLE", "service_role", "library_publication_sources", "library-publication-originals", "dangerouslySetInnerHTML", ".insert(", ".update(", ".delete(", ".upsert(", "OPENAI_API_KEY"]) if (surface.includes(forbidden)) throw new Error(`Forbidden Knowledge Graph v5 token: ${forbidden}`);
console.log("Library Knowledge Graph v5 verifier passed.");
