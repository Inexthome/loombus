import fs from "node:fs";

const pagePath = "src/app/library/research/evidence/graph/page.tsx";
const surfacePath = "src/components/library/library-knowledge-graph-v4-surface.tsx";
for (const path of [pagePath, surfacePath]) if (!fs.existsSync(path)) throw new Error(`Missing ${path}`);
const page = fs.readFileSync(pagePath, "utf8");
const surface = fs.readFileSync(surfacePath, "utf8");
if (!page.includes("LibraryKnowledgeGraphV4Surface") && !page.includes("LibraryKnowledgeGraphV5Surface")) throw new Error("Graph route must render v4 or approved successor surface");
for (const table of ["library_research_claims","library_knowledge_objects","library_research_items","library_research_claim_evidence","library_knowledge_claims","library_discussion_claim_derivations","library_discussion_knowledge_derivations","library_reply_claim_derivations","library_reply_knowledge_derivations","library_knowledge_discussion_promotions","library_publications","discussions"]) if (!surface.includes(`from(\"${table}\")`)) throw new Error(`Missing graph source: ${table}`);
for (const token of ["canvasRef","beginPan","movePan","fitToScreen","ResizeObserver","Knowledge Graph minimap","denseMode","dense labels simplified","slice(0, 1000)","slice(0, 500)","Fit graph to screen","Zoom in","Zoom out","Trace provenance"]) if (!surface.includes(token)) throw new Error(`Missing Knowledge Graph v4 scale/interaction contract: ${token}`);
for (const relation of ["derived from opening post", "derived from reply", "promoted to discussion"]) if (!surface.includes(relation)) throw new Error(`Missing fixed relationship: ${relation}`);
if (!surface.includes("row.relation") || !surface.includes("row.role")) throw new Error("Canonical relation/role labels must remain data-driven");
if (!surface.includes("supabase.auth.getUser()") || !surface.includes("This graph is private and read-only")) throw new Error("Graph auth/privacy contract incomplete");
for (const forbidden of ["SUPABASE_SERVICE_ROLE", "service_role", "library_publication_sources", "library-publication-originals", "dangerouslySetInnerHTML", ".insert(", ".update(", ".delete(", ".upsert("]) if (surface.includes(forbidden)) throw new Error(`Forbidden Knowledge Graph v4 token: ${forbidden}`);
console.log("Library Knowledge Graph v4 verifier passed.");
