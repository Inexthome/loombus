import fs from "node:fs";

const migrationPath = "supabase/migrations/20260817235500_add_library_evidence_knowledge_foundation.sql";
if (!fs.existsSync(migrationPath)) throw new Error(`Missing migration: ${migrationPath}`);
const sql = fs.readFileSync(migrationPath, "utf8");

function requireText(text, label) {
  if (!sql.includes(text)) throw new Error(`Missing ${label}: ${text}`);
}

for (const table of [
  "library_research_claims",
  "library_research_claim_evidence",
  "library_knowledge_objects",
  "library_knowledge_claims",
]) {
  requireText(`create table if not exists public.${table}`, `${table} table`);
  requireText(`alter table public.${table} enable row level security`, `${table} RLS`);
  requireText(`revoke all on table public.${table} from anon`, `${table} anonymous revoke`);
}

requireText("references public.library_research_items(id) on delete cascade", "immutable saved-passage evidence provenance");
requireText("relation in ('supports', 'challenges', 'context')", "evidence relation vocabulary");
requireText("role in ('core', 'supporting', 'counterpoint')", "knowledge claim-role vocabulary");
requireText("claim_type in ('claim', 'question', 'conclusion')", "claim type vocabulary");
requireText("knowledge_type in ('synthesis', 'finding', 'open_question')", "knowledge type vocabulary");
requireText("item.user_id = auth.uid()", "saved-passage ownership enforcement");
requireText("claim.user_id = auth.uid()", "claim ownership enforcement");
requireText("knowledge.user_id = auth.uid()", "knowledge ownership enforcement");

if (/alter table public\.library_research_items[\s\S]*?(enable|disable|add|drop|alter)/i.test(sql)) {
  throw new Error("Foundation must not alter immutable library_research_items provenance.");
}
if (/\bservice_role\b/i.test(sql)) throw new Error("Foundation must not grant or depend on service_role.");
if (/\bpublic\s+read\b/i.test(sql)) throw new Error("Foundation must remain private; public-read semantics are not authorized.");

console.log("PASS: Library evidence/knowledge foundation preserves private owner-scoped passage -> evidence -> claim -> knowledge provenance.");
