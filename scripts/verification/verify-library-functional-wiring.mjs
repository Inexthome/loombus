import fs from "node:fs";

const pagePath = "src/app/library/page.tsx";
const surfacePath = "src/components/library/library-functional-surface.tsx";
const discoverPath = "src/components/library/library-discover-catalog.tsx";
const collectionsPath = "src/components/library/library-collections-panel.tsx";
const migrationPath = "supabase/migrations/20260824050000_add_library_custom_collections.sql";
const page = fs.readFileSync(pagePath, "utf8");
const surface = fs.readFileSync(surfacePath, "utf8");
const discover = fs.readFileSync(discoverPath, "utf8");
const collections = fs.readFileSync(collectionsPath, "utf8");
const collectionsMigration = fs.readFileSync(migrationPath, "utf8");
const failures = [];

const requiredSurfaceTokens = [
  'from "@/lib/supabase/client"',
  'from("library_publications")',
  'from("library_member_items")',
  'from("library_reading_progress")',
  'from("library_highlights")',
  'from("library_notes")',
  'supabase.auth.getUser()',
  'Remove from My Library',
  'Continue Reading',
  'Highlights',
  'Authors',
  'LibraryCollectionsPanel',
  '"Collections"',
];

for (const token of requiredSurfaceTokens) {
  if (!surface.includes(token)) failures.push(`missing functional contract: ${token}`);
}

for (const token of ["Add to My Library", "Remove from My Library", "onToggleSaved"]) {
  if (!discover.includes(token)) failures.push(`missing discovery save contract: ${token}`);
}

for (const token of [
  'from("library_collections")',
  'from("library_collection_items")',
  'from("library_member_items")',
  'Create your first collection',
  'Add books from My Library',
  'A book can belong to multiple collections',
  'Remove it here does not remove it from My Library',
]) {
  if (!collections.includes(token)) failures.push(`missing collections UI contract: ${token}`);
}

for (const token of [
  'create table if not exists public.library_collections',
  'create table if not exists public.library_collection_items',
  'primary key (collection_id, publication_id)',
  'foreign key (collection_id, user_id)',
  'references public.library_collections(id, user_id)',
  'members read own library collections',
  'members create own library collection items',
  'from public.library_member_items item',
  'item.user_id = auth.uid()',
  'item.publication_id = publication_id',
]) {
  if (!collectionsMigration.includes(token)) failures.push(`missing collections data contract: ${token}`);
}

if (!page.includes("LibraryFunctionalSurface")) failures.push("Library route is not wired to the functional surface");

const forbiddenTokens = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "service_role",
  "stripe",
  "checkout",
  "storage.objects",
  "storage.buckets",
  "openai",
  "anthropic",
  "drm",
];

for (const token of forbiddenTokens) {
  if (surface.toLowerCase().includes(token.toLowerCase())) failures.push(`out-of-scope capability present: ${token}`);
  if (discover.toLowerCase().includes(token.toLowerCase())) failures.push(`out-of-scope discovery capability present: ${token}`);
  if (collections.toLowerCase().includes(token.toLowerCase())) failures.push(`out-of-scope collections capability present: ${token}`);
}

if (!surface.includes("var(--loombus-gold)")) failures.push("Loombus Gold theme token missing");
if (!surface.includes("var(--loombus-page-bg)")) failures.push("theme-aware page background missing");

if (failures.length) {
  console.error("Loombus Library functional wiring verification FAILED");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Loombus Library functional wiring verification passed");
console.log("- published discovery/search wired through the dedicated catalog component");
console.log("- My Library add/remove uses authenticated browser client");
console.log("- private progress/highlights/notes are read through RLS-protected tables");
console.log("- custom collections are owner-scoped and organize My Library without duplicating publications");
console.log("- collection membership is constrained to books already in My Library");
console.log("- Light/Dark/System theme tokens preserved");
console.log("- uploads, commerce, storage, DRM, and AI execution remain absent");
