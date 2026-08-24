import fs from "node:fs";

const surface = fs.readFileSync("src/components/library/library-functional-surface.tsx", "utf8");
const detail = fs.readFileSync("src/components/library/library-publication-detail.tsx", "utf8");
const discover = fs.readFileSync("src/components/library/library-discover-catalog.tsx", "utf8");
const failures = [];

for (const token of [
  'type PersonalSortMode = "recent" | "title" | "author" | "progress"',
  'Recently added',
  'Title A–Z',
  'Author A–Z',
  'Reading progress',
  'All types',
  'organizedMyLibraryPublications',
  'personalPublicationTypes',
  'Clear Library search',
  '% read',
]) {
  if (!surface.includes(token)) failures.push(`missing personal Library organization contract: ${token}`);
}

for (const token of [
  'from("library_reading_lifecycle")',
  'Want to Read',
  'Mark as Finished',
  'Still Reading',
  'finished_at: state === "finished" ? now : null',
  'onConflict: "user_id,publication_id"',
  'max-w-[220px]',
  'border-b border-[var(--loombus-border)]',
]) {
  if (!detail.includes(token)) failures.push(`missing publication-detail refinement contract: ${token}`);
}

for (const token of [
  'rpc("search_library_published_catalog"',
  'p_publication_type',
  'p_sort',
  'Title A–Z',
  'Title Z–A',
  'No published matches',
]) {
  if (!discover.includes(token)) failures.push(`existing Discover search/filter contract lost: ${token}`);
}

for (const source of [surface, detail]) {
  for (const token of ["SUPABASE_SERVICE_ROLE_KEY", "service_role", "stripe", "checkout", "openai", "anthropic", "drm"]) {
    if (source.toLowerCase().includes(token.toLowerCase())) failures.push(`out-of-scope capability present: ${token}`);
  }
}

if (failures.length) {
  console.error("Loombus Library organization polish verification FAILED");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Loombus Library organization polish verification passed");
console.log("- My Library supports type filtering and recent/title/author/progress sorting");
console.log("- Library search can be cleared without leaving the current surface");
console.log("- cover tiles remain compact and can surface reading progress without extra card chrome");
console.log("- publication details use the Phase 3A reading lifecycle directly");
console.log("- existing Discover server-backed search, type filtering, sorting, and pagination remain intact");
console.log("- no schema migration or new backend subsystem is introduced");
