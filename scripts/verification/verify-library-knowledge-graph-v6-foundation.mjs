import fs from "node:fs";

const migrationPath = "supabase/migrations/20260822203500_add_library_graph_workspace_foundation.sql";
if (!fs.existsSync(migrationPath)) throw new Error(`Missing ${migrationPath}`);
const sql = fs.readFileSync(migrationPath, "utf8");

for (const table of ["library_graph_workspaces", "library_graph_saved_views"]) {
  if (!sql.includes(`create table if not exists public.${table}`)) throw new Error(`Missing table ${table}`);
  if (!sql.includes(`alter table public.${table} enable row level security`)) throw new Error(`RLS missing for ${table}`);
  if (!sql.includes(`revoke all on table public.${table} from anon`)) throw new Error(`Anon revoke missing for ${table}`);
}

for (const token of [
  "user_id uuid not null references auth.users(id) on delete cascade",
  "workspace_id uuid references public.library_graph_workspaces(id) on delete set null",
  "start_node_key text not null",
  "target_node_key text not null",
  "max_hops smallint not null default 4",
  "direction_mode text not null default 'either'",
  "max_hops between 2 and 5",
  "direction_mode in ('either', 'recorded')",
  "start_node_key <> target_node_key",
  "workspace.user_id = auth.uid()",
]) {
  if (!sql.includes(token)) throw new Error(`Missing v6 foundation contract: ${token}`);
}

for (const operation of ["for select", "for insert", "for update", "for delete"]) {
  if (!sql.includes(operation)) throw new Error(`Missing owner RLS operation: ${operation}`);
}

if (!sql.includes("graph truth remains in existing Library provenance tables")) throw new Error("Truth-layer boundary comment missing");
if (!sql.includes("not inferred graph relationships")) throw new Error("Saved-view truth boundary missing");

console.log("Library Knowledge Graph v6 foundation verifier passed.");
