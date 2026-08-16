import fs from "node:fs";

const path = "supabase/migrations/20260816061000_fix_library_note_publication_binding_rls.sql";
const sql = fs.readFileSync(path, "utf8").toLowerCase();
const failures = [];

const required = [
  "create or replace function public.library_note_highlight_binding_valid",
  "h.id = p_highlight_id",
  "h.user_id = p_user_id",
  "h.publication_id = p_publication_id",
  "public.library_note_highlight_binding_valid(user_id, publication_id, highlight_id)",
  "create policy \"members create own notes\"",
  "create policy \"members update own notes\"",
];

for (const token of required) {
  if (!sql.includes(token)) failures.push(`missing repair contract: ${token}`);
}

const unsafeLegacy = "h.publication_id = publication_id";
if (sql.includes(unsafeLegacy)) failures.push("legacy unqualified publication binding remains in repair migration");

if (failures.length) {
  console.error("Library note binding repair verification FAILED");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Library note binding repair verification passed");
console.log("- highlight ownership is explicitly parameter-bound");
console.log("- highlight publication is explicitly parameter-bound");
console.log("- note INSERT and UPDATE policies use the repaired validator");
