import fs from "node:fs";

const migrationPath = "supabase/migrations/20260822083000_add_library_discussion_feedback_foundation.sql";
if (!fs.existsSync(migrationPath)) throw new Error(`Missing migration: ${migrationPath}`);
const sql = fs.readFileSync(migrationPath, "utf8");

function requireText(text, label) {
  if (!sql.includes(text)) throw new Error(`Missing ${label}: ${text}`);
}
function rejectText(text, label) {
  if (sql.includes(text)) throw new Error(`Forbidden ${label}: ${text}`);
}

for (const table of [
  "library_discussion_claim_derivations",
  "library_discussion_knowledge_derivations",
]) {
  requireText(`create table if not exists public.${table}`, `${table} table`);
  requireText(`alter table public.${table} enable row level security`, `${table} RLS`);
  requireText(`revoke all on table public.${table} from anon`, `${table} anon revoke`);
  requireText(`grant select, insert on table public.${table} to authenticated`, `${table} immutable authenticated grants`);
}

for (const field of ["selected_text", "start_offset", "end_offset", "body_sha256"]) {
  requireText(field, `exact discussion-body provenance field ${field}`);
}

for (const claimType of ["claim", "question", "conclusion"]) {
  requireText(`'${claimType}'`, `claim type ${claimType}`);
}
for (const knowledgeType of ["synthesis", "finding", "open_question"]) {
  requireText(`'${knowledgeType}'`, `knowledge type ${knowledgeType}`);
}

requireText("claim.user_id = auth.uid()", "claim ownership gate");
requireText("knowledge.user_id = auth.uid()", "knowledge ownership gate");
requireText("discussion.title = library_discussion_claim_derivations.source_discussion_title", "claim source snapshot match");
requireText("discussion.title = library_discussion_knowledge_derivations.source_discussion_title", "knowledge source snapshot match");
requireText("PostgreSQL text indexing is not UTF-16 compatible", "server exact-validation contract");
requireText("discussion body only", "phase-one source boundary");

rejectText("grant select, insert, update", "browser update grant");
rejectText("grant select, insert, delete", "browser delete grant");
rejectText("SUPABASE_SERVICE_ROLE_KEY", "service-role dependency");
rejectText("library-publication-originals", "original EPUB access");
rejectText("library_research_items set", "saved passage mutation");

console.log("PASS: Library discussion feedback foundation preserves explicit public discussion body -> private claim/knowledge provenance without mutating existing Library research.");
