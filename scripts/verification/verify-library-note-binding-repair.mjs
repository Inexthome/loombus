import fs from "node:fs";

const path = "supabase/migrations/20260816021500_repair_library_note_publication_binding_rls.sql";
const sql = fs.readFileSync(path, "utf8").toLowerCase();
const failures = [];

for (const token of [
  'drop policy if exists "members create own notes"',
  'create policy "members create own notes"',
  'drop policy if exists "members update own notes"',
  'create policy "members update own notes"',
  'h.id = library_notes.highlight_id',
  'h.publication_id = library_notes.publication_id',
  'auth.uid() = library_notes.user_id',
]) {
  if (!sql.includes(token)) failures.push(`missing: ${token}`);
}

if (sql.includes('h.publication_id = publication_id')) {
  failures.push('unqualified publication binding remains');
}

for (const token of ['drop table', 'truncate ', 'delete from ', 'alter table auth.']) {
  if (sql.includes(token)) failures.push(`destructive operation present: ${token.trim()}`);
}

if (failures.length) {
  console.error('Library note binding repair verification FAILED');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Library note binding repair verification passed');
console.log('- insert and update note policies repaired');
console.log('- outer note publication/highlight columns are explicitly qualified');
console.log('- no destructive data/schema operation added');
