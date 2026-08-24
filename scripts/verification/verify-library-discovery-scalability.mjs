import fs from "node:fs";

const migrationPath = "supabase/migrations/20260824084500_scale_library_discovery_search.sql";
const surfacePath = "src/components/library/library-functional-surface.tsx";
const discoverPath = "src/components/library/library-discover-catalog.tsx";
const authorsPath = "src/components/library/library-authors-catalog.tsx";

for (const path of [migrationPath, surfacePath, discoverPath, authorsPath]) {
  if (!fs.existsSync(path)) throw new Error(`Missing Library discovery scalability file: ${path}`);
}

const migration = fs.readFileSync(migrationPath, "utf8");
const surface = fs.readFileSync(surfacePath, "utf8");
const discover = fs.readFileSync(discoverPath, "utf8");
const authors = fs.readFileSync(authorsPath, "utf8");
const all = [migration, surface, discover, authors].join("\n");

for (const fragment of [
  "create extension if not exists pg_trgm",
  "discovery_search_text",
  "library_publications_discovery_search_trgm_idx",
  "library_publications_published_newest_idx",
  "library_publications_published_oldest_idx",
  "library_publications_published_title_idx",
  "search_library_published_catalog",
  "search_library_published_authors",
  "p.status = 'published'",
  "security invoker",
  "greatest(1, least(coalesce(p_limit, 24), 48))",
  "greatest(0, least(coalesce(p_offset, 0), 10000))",
]) {
  if (!migration.toLowerCase().includes(fragment.toLowerCase())) throw new Error(`Missing scalable discovery database contract: ${fragment}`);
}

for (const fragment of [
  'LibraryDiscoverCatalog',
  'LibraryAuthorsCatalog',
  '.in("id", publicationIds)',
  '.eq("status", "published")',
]) {
  if (!surface.includes(fragment)) throw new Error(`Missing scalable Library surface behavior: ${fragment}`);
}

const legacyFullCatalog = '.from("library_publications").select("id, slug, title, subtitle, description, publication_type, author_name, publisher_name, cover_url, publication_date").eq("status", "published").order(';
if (surface.includes(legacyFullCatalog)) throw new Error("Library surface still performs the legacy full published-catalog download.");

for (const fragment of [
  '.rpc("search_library_published_catalog"',
  'p_limit: PAGE_SIZE',
  'p_offset: page * PAGE_SIZE',
  'const PAGE_SIZE = 24',
  'Type',
  'Newest',
  'Title A–Z',
]) {
  if (!discover.includes(fragment)) throw new Error(`Missing paginated discovery UI contract: ${fragment}`);
}

for (const fragment of [
  '.rpc("search_library_published_authors"',
  'const PAGE_SIZE = 36',
  'p_offset: page * PAGE_SIZE',
  'work_count',
]) {
  if (!authors.includes(fragment)) throw new Error(`Missing scalable Authors contract: ${fragment}`);
}

if (/dangerouslySetInnerHTML/.test(all)) throw new Error("Discovery scalability work must not introduce unsafe HTML rendering.");
if (/SUPABASE_SERVICE_ROLE_KEY|service_role/i.test(all)) throw new Error("Discovery scalability work must not introduce service-role usage.");
if (/from public\.library_publication_sections/i.test(migration)) throw new Error("Catalog search must not index or expose normalized book body text.");

console.log("Library discovery scalability verification passed.");
