import fs from "node:fs";

const migrationPath = "supabase/migrations/20260818014500_add_library_knowledge_discussion_promotion_foundation.sql";
if (!fs.existsSync(migrationPath)) throw new Error(`Missing migration: ${migrationPath}`);

const sql = fs.readFileSync(migrationPath, "utf8");

function requireText(text, label) {
  if (!sql.includes(text)) throw new Error(`Missing ${label}: ${text}`);
}

function rejectText(text, label) {
  if (sql.includes(text)) throw new Error(`Forbidden ${label}: ${text}`);
}

for (const table of [
  "library_knowledge_discussion_promotions",
  "library_knowledge_discussion_claims",
]) {
  requireText(`create table if not exists public.${table}`, `${table} table`);
  requireText(`alter table public.${table} enable row level security`, `${table} RLS`);
  requireText(`revoke all on table public.${table} from anon`, `${table} anonymous revocation`);
}

requireText("knowledge_object_id uuid references public.library_knowledge_objects(id) on delete set null", "durable source deletion semantics");
requireText("discussion_id uuid not null references public.discussions(id) on delete cascade", "discussion linkage");
requireText("unique (discussion_id)", "one promotion provenance row per discussion");
requireText("published_title text not null", "published title snapshot");
requireText("published_summary text", "published summary snapshot");
requireText("source_updated_at timestamptz not null", "knowledge version binding");
requireText("published_statement text not null", "claim statement snapshot");
requireText("published_role text not null", "claim role snapshot");

for (const role of ["core", "supporting", "counterpoint"]) {
  requireText(`'${role}'`, `knowledge claim role ${role}`);
}

requireText("discussion.user_id = auth.uid()", "discussion ownership check");
requireText("knowledge.user_id = auth.uid()", "knowledge ownership check");
requireText("claim.user_id = auth.uid()", "claim ownership check");
requireText("membership.role = library_knowledge_discussion_claims.published_role", "knowledge membership role binding");

requireText("grant select, insert on table public.library_knowledge_discussion_promotions to authenticated", "promotion immutable grants");
requireText("grant select, insert on table public.library_knowledge_discussion_claims to authenticated", "claim snapshot immutable grants");

rejectText("grant select, insert, update", "promotion browser UPDATE grant");
rejectText("library_research_claim_evidence", "private evidence relation publication");
rejectText("library_research_item_metadata", "private research notes/tags publication");
rejectText("library-publication-originals", "original EPUB access");

console.log("PASS: Library knowledge discussion promotion foundation preserves explicit opt-in publication with immutable private provenance and no automatic evidence exposure.");
