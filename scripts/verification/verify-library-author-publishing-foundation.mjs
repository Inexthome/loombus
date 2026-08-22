import fs from "node:fs";

const migrationPath = "supabase/migrations/20260822223000_add_library_author_publishing_foundation.sql";
if (!fs.existsSync(migrationPath)) throw new Error(`Missing ${migrationPath}`);

const sql = fs.readFileSync(migrationPath, "utf8");

for (const token of [
  "create table if not exists public.library_author_publications",
  "publication_id uuid primary key references public.library_publications(id) on delete cascade",
  "user_id uuid not null references auth.users(id) on delete cascade",
  "submission_status text not null default 'draft'",
  "'draft', 'submitted', 'changes_requested', 'approved', 'rejected'",
  "submitted_at timestamptz",
  "reviewed_at timestamptz",
  "review_note text",
  "alter table public.library_author_publications enable row level security",
  'create policy "authors read own library publication ownership"',
  "using (auth.uid() = user_id)",
  'create policy "authors read own library publication metadata"',
  "author_publication.publication_id = library_publications.id",
  "author_publication.user_id = auth.uid()",
  "revoke all on table public.library_author_publications from anon",
  "revoke all on table public.library_author_publications from authenticated",
  "grant select on table public.library_author_publications to authenticated",
]) {
  if (!sql.includes(token)) throw new Error(`Missing author publishing foundation contract: ${token}`);
}

for (const forbidden of [
  "grant insert on table public.library_author_publications to authenticated",
  "grant update on table public.library_author_publications to authenticated",
  "grant delete on table public.library_author_publications to authenticated",
  "library_publications add column user_id",
  "library_publications add column author_user_id",
  "library-publication-originals",
  "storage.objects",
  "library_graph_workspaces",
  "library_graph_saved_views",
]) {
  if (sql.includes(forbidden)) throw new Error(`Forbidden author publishing foundation token: ${forbidden}`);
}

if (sql.includes('drop policy if exists "library publications readable when published"')) {
  throw new Error("Author publishing foundation must preserve the existing published-publication read policy");
}

console.log("Library author publishing foundation verifier passed.");
