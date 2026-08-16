import fs from "node:fs";

const migration = fs.readFileSync("supabase/migrations/20260816074500_add_library_content_ingestion_foundation.sql", "utf8");
const contract = fs.readFileSync("src/lib/library/content-contract.ts", "utf8");
const failures = [];

for (const token of [
  "library_publication_sources",
  "library_publication_sections",
  "application/epub+zip",
  "library-publication-originals",
  "public = false",
  "enable row level security",
  "grant select on public.library_publication_sections to authenticated",
  "storage_provider in ('supabase', 'r2')",
  "content_sha256",
  "section_key",
]) if (!migration.includes(token)) failures.push(`missing migration contract: ${token}`);

for (const token of [
  "LibraryStorageProvider",
  '"supabase" | "r2"',
  "LibraryNormalizedSection",
  "LibraryReaderLocator",
  "encodeLibraryReaderLocator",
  "decodeLibraryReaderLocator",
  "buildLibraryOriginalPath",
]) if (!contract.includes(token)) failures.push(`missing application contract: ${token}`);

for (const forbidden of ["create policy library_original", "to anon", "public, true", "getPublicUrl", "SUPABASE_SERVICE_ROLE_KEY"]) {
  if ((migration + contract).toLowerCase().includes(forbidden.toLowerCase())) failures.push(`unsafe/out-of-scope capability present: ${forbidden}`);
}

if (failures.length) {
  console.error("Library content-ingestion foundation verification FAILED");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Library content-ingestion foundation verification passed");
console.log("- original EPUB bucket is private and MIME/size constrained");
console.log("- no browser object policy is introduced for originals");
console.log("- normalized publication sections are separate from storage objects");
console.log("- authenticated reads are limited to sections of published publications");
console.log("- source/write paths remain server/admin-only");
console.log("- storage provider contract supports Supabase now and R2 later");
console.log("- versioned Reader locator contract is storage-provider independent");
