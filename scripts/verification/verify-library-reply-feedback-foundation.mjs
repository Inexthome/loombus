import fs from "node:fs";

const migrationPath = "supabase/migrations/20260822090000_add_library_reply_feedback_foundation.sql";
const sql = fs.readFileSync(migrationPath, "utf8");

const required = [
  "create table if not exists public.library_reply_claim_derivations",
  "create table if not exists public.library_reply_knowledge_derivations",
  "reply_id uuid not null references public.replies(id) on delete cascade",
  "reply_author_id uuid not null references auth.users(id) on delete cascade",
  "reply_body_sha256 text not null",
  "start_offset integer not null",
  "end_offset integer not null",
  "selected_text text not null",
  "derived_claim_type in ('claim', 'question', 'conclusion')",
  "derived_claim_status in ('draft', 'working', 'supported', 'contested')",
  "derived_knowledge_type in ('synthesis', 'finding', 'open_question')",
  "derived_knowledge_status in ('draft', 'working', 'synthesized')",
  "join public.replies reply on reply.discussion_id = discussion.id",
  "reply.deleted_at is null",
  "discussion.deleted_at is null",
  "alter table public.library_reply_claim_derivations enable row level security",
  "alter table public.library_reply_knowledge_derivations enable row level security",
  "grant select, insert on table public.library_reply_claim_derivations to authenticated",
  "grant select, insert on table public.library_reply_knowledge_derivations to authenticated",
  "revoke all on table public.library_reply_claim_derivations from anon",
  "revoke all on table public.library_reply_knowledge_derivations from anon",
];

for (const needle of required) {
  if (!sql.includes(needle)) {
    throw new Error(`Missing required reply-feedback foundation contract: ${needle}`);
  }
}

const forbidden = [
  /grant\s+update/i,
  /grant\s+delete/i,
  /service_role/i,
  /library-publication-originals/i,
  /openai/i,
];

for (const pattern of forbidden) {
  if (pattern.test(sql)) {
    throw new Error(`Forbidden reply-feedback foundation capability found: ${pattern}`);
  }
}

console.log("Library reply feedback foundation verification passed.");
