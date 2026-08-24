import fs from "node:fs";

const bridgePath = "src/components/library/library-knowledge-promotion-bridge.tsx";
const graphContextPath = "src/components/library/library-knowledge-graph-promotion-context.tsx";
const evidencePagePath = "src/app/library/research/evidence/page.tsx";
const graphPagePath = "src/app/library/research/evidence/graph/page.tsx";
const graphRuntimePath = "src/components/library/library-knowledge-graph-v6-surface.tsx";

for (const path of [bridgePath, graphContextPath, evidencePagePath, graphPagePath, graphRuntimePath]) {
  if (!fs.existsSync(path)) throw new Error(`Missing Phase 4C file: ${path}`);
}

const bridge = fs.readFileSync(bridgePath, "utf8");
const graphContext = fs.readFileSync(graphContextPath, "utf8");
const evidencePage = fs.readFileSync(evidencePagePath, "utf8");
const graphPage = fs.readFileSync(graphPagePath, "utf8");
const graphRuntime = fs.readFileSync(graphRuntimePath, "utf8");

for (const token of [
  '.from("library_knowledge_objects")',
  '.from("library_knowledge_claims")',
  '.from("library_research_claims")',
  '.from("library_research_claim_evidence")',
  'item.status === "synthesized"',
  'evidenceBackedClaims > 0',
  'Promotion is never automatic.',
  'Review promotion',
  'Investigate graph',
]) {
  if (!bridge.includes(token)) throw new Error(`Missing deliberate promotion contract: ${token}`);
}

for (const token of [
  'Approved relationships only',
  '.from("library_research_claims")',
  '.from("library_research_claim_evidence")',
  '.from("library_knowledge_objects")',
  '.from("library_knowledge_claims")',
  '.from("library_knowledge_discussion_promotions")',
  'does not generate new claim, evidence, knowledge, or promotion links',
]) {
  if (!graphContext.includes(token)) throw new Error(`Missing graph provenance contract: ${token}`);
}

if (!evidencePage.includes("LibraryKnowledgePromotionBridge")) throw new Error("Evidence & Knowledge page does not render promotion readiness.");
if (!graphPage.includes("LibraryKnowledgeGraphPromotionContext")) throw new Error("Knowledge Graph page does not render provenance context.");

for (const token of [
  '.from("library_research_claim_evidence")',
  '.from("library_knowledge_claims")',
  '.from("library_knowledge_discussion_promotions")',
  'push(nodeKey("claim", row.claim_id), nodeKey("knowledge", row.knowledge_object_id), row.role, "membership")',
  'push(nodeKey("knowledge", row.knowledge_object_id), nodeKey("discussion", row.discussion_id), "promoted to discussion", "promotion")',
]) {
  if (!graphRuntime.includes(token)) throw new Error(`Existing deterministic graph derivation contract lost: ${token}`);
}

for (const source of [bridge, graphContext]) {
  for (const forbidden of ["insert(", "update(", "delete(", "upsert(", "SUPABASE_SERVICE_ROLE_KEY", "OPENAI_API_KEY", "anthropic", "web_search"]) {
    if (source.includes(forbidden)) throw new Error(`Phase 4C review surfaces must remain read-only; found: ${forbidden}`);
  }
}

console.log("PASS: Library Phase 4C knowledge promotion remains deliberate and the Knowledge Graph reflects explicit provenance only.");
console.log("- readiness is computed from synthesized knowledge, summary, linked claims, and explicit evidence");
console.log("- promotion remains a separate confirmation flow");
console.log("- graph context is read-only and documents deterministic provenance relationships");
console.log("- no schema migration or AI-generated relationship subsystem is introduced");
