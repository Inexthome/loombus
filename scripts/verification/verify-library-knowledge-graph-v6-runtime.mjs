import fs from "node:fs";

const page = fs.readFileSync("src/app/library/research/evidence/graph/page.tsx", "utf8");
const surface = fs.readFileSync("src/components/library/library-knowledge-graph-v6-surface.tsx", "utf8");
if (!["LibraryKnowledgeGraphV6Surface", "LibraryKnowledgeGraphV7Surface"].some((token) => page.includes(token))) throw new Error("Graph route must render v6 or approved successor surface");
for (const table of ["library_graph_workspaces", "library_graph_saved_views"]) if (!surface.includes(`from(\"${table}\")`)) throw new Error(`Missing v6 workspace source: ${table}`);
for (const token of ["findShortestPath", "createWorkspace", "saveView", "deleteView", "deleteWorkspace", "workspace_id", "start_node_key", "target_node_key", "max_hops", "direction_mode", "cross-device", "RLS-backed", "Trace provenance", "LibraryKnowledgeGraphV4Surface"]) if (!surface.includes(token)) throw new Error(`Missing v6 persistent workspace contract: ${token}`);
for (const source of ["library_research_claims","library_knowledge_objects","library_research_items","library_research_claim_evidence","library_knowledge_claims","library_discussion_claim_derivations","library_discussion_knowledge_derivations","library_reply_claim_derivations","library_reply_knowledge_derivations","library_knowledge_discussion_promotions","library_publications","discussions"]) if (!surface.includes(`from(\"${source}\")`)) throw new Error(`Missing canonical v6 graph source: ${source}`);
for (const relation of ["derived from opening post", "derived from reply", "promoted to discussion"]) if (!surface.includes(relation)) throw new Error(`Missing v6 fixed relationship: ${relation}`);
if (!surface.includes("row.relation") || !surface.includes("row.role")) throw new Error("V6 must preserve canonical stored relation labels");
if (!surface.includes("supabase.auth.getUser()")) throw new Error("V6 workspace must require authenticated member context");
if (!surface.includes("saved views do not create or infer new facts")) throw new Error("V6 must state the truth-layer boundary");
for (const forbidden of ["SUPABASE_SERVICE_ROLE", "service_role", "library_publication_sources", "library-publication-originals", "dangerouslySetInnerHTML", "OPENAI_API_KEY", "localStorage"]) if (surface.includes(forbidden)) throw new Error(`Forbidden Knowledge Graph v6 token: ${forbidden}`);
console.log("Library Knowledge Graph v6 runtime verifier passed.");
