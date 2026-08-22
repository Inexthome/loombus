import fs from "node:fs";

const pagePath = "src/app/library/research/evidence/graph/page.tsx";
const v7Path = "src/components/library/library-knowledge-graph-v7-surface.tsx";
const v6Path = "src/components/library/library-knowledge-graph-v6-surface.tsx";
for (const path of [pagePath, v7Path, v6Path]) if (!fs.existsSync(path)) throw new Error(`Missing ${path}`);

const page = fs.readFileSync(pagePath, "utf8");
const v7 = fs.readFileSync(v7Path, "utf8");
const v6 = fs.readFileSync(v6Path, "utf8");

if (!page.includes("LibraryKnowledgeGraphV7Surface")) throw new Error("Graph route must render v7 surface");
for (const token of [
  "KnowledgeGraphErrorBoundary",
  "getDerivedStateFromError",
  "componentDidCatch",
  "prefers-reduced-motion",
  "Alt+G",
  "navigator.onLine",
  "online",
  "offline",
  "aria-live",
  "Skip to Knowledge Graph",
  "safe-area-inset-bottom",
  "Reload graph",
  "Retry graph",
  "LibraryKnowledgeGraphV6Surface",
]) if (!v7.includes(token)) throw new Error(`Missing v7 hardening contract: ${token}`);

for (const table of ["library_graph_workspaces", "library_graph_saved_views"]) if (!v6.includes(`from(\"${table}\")`)) throw new Error(`V7 must preserve persistent workspace source: ${table}`);
for (const token of ["findShortestPath", "Trace provenance", "cross-device", "RLS-backed", "saved views do not create or infer new facts"]) if (!v6.includes(token)) throw new Error(`V7 must preserve v6 graph contract: ${token}`);
if (!v6.includes("supabase.auth.getUser()")) throw new Error("V7 must preserve authenticated member context");
for (const forbidden of ["SUPABASE_SERVICE_ROLE", "service_role", "library_publication_sources", "library-publication-originals", "dangerouslySetInnerHTML", "OPENAI_API_KEY"]) {
  if (v7.includes(forbidden) || v6.includes(forbidden)) throw new Error(`Forbidden Knowledge Graph v7 token: ${forbidden}`);
}

console.log("Library Knowledge Graph v7 verifier passed.");
