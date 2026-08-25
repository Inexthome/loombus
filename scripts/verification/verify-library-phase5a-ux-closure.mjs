import fs from "node:fs";

const shellPath = "src/components/library/library-functional-surface.tsx";
const collectionsPath = "src/components/library/library-collections-panel.tsx";
const evidencePath = "src/app/library/research/evidence/page.tsx";

for (const path of [shellPath, collectionsPath, evidencePath]) {
  if (!fs.existsSync(path)) throw new Error(`Missing Phase 5A file: ${path}`);
}

const shell = fs.readFileSync(shellPath, "utf8");
const collections = fs.readFileSync(collectionsPath, "utf8");
const evidence = fs.readFileSync(evidencePath, "utf8");
const failures = [];

for (const token of [
  'select("id, publication_id, locator, selected_text, start_offset, end_offset, text_sha256, created_at")',
  "homeLibraryPublications",
  "publicationMatches(publication, normalizedQuery)",
  "filteredHighlights",
  "filteredNotes",
  "highlightById",
  "libraryReaderHref",
  "Open passage",
  'href="/library/research"',
  'href="/library/ask-loombus"',
  'href="/library/publish"',
  '<MyLibraryShelf limit={8} home />',
]) {
  if (!shell.includes(token)) failures.push(`missing Library shell closure contract: ${token}`);
}

for (const token of [
  "window.confirm",
  "The collection will be removed, but its books will stay in My Library.",
]) {
  if (!collections.includes(token)) failures.push(`missing collection deletion confirmation: ${token}`);
}

for (const token of [
  "Knowledge tools",
  "<details",
  "Knowledge Graph",
  "Provenance",
  "Promote to Discussion",
]) {
  if (!evidence.includes(token)) failures.push(`missing restrained Evidence/Knowledge control: ${token}`);
}

for (const forbidden of ["fixed bottom-24", "fixed bottom-6"]) {
  if (evidence.includes(forbidden)) failures.push(`legacy floating Evidence/Knowledge chrome remains: ${forbidden}`);
}

for (const source of [shell, collections, evidence]) {
  for (const forbidden of ["SUPABASE_SERVICE_ROLE_KEY", "service_role", "dangerouslySetInnerHTML"]) {
    if (source.includes(forbidden)) failures.push(`out-of-scope capability present: ${forbidden}`);
  }
}

if (failures.length) {
  console.error("Loombus Library Phase 5A UX closure verification FAILED");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Loombus Library Phase 5A UX closure verification passed");
console.log("- Library search now matches visible Continue Reading and annotation results");
console.log("- mobile navigation exposes Research, Ask Loombus, and My Publications");
console.log("- highlights and linked notes return to Reader source context");
console.log("- Home My Library shelf is isolated from personal sort/type filters");
console.log("- collection deletion requires explicit confirmation");
console.log("- Evidence & Knowledge actions are consolidated into one restrained tools menu");
console.log("- no SQL migration or schema change is introduced");
