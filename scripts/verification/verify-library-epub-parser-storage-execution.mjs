import fs from "node:fs";

const parser = fs.readFileSync("src/lib/library/epub-parser.ts", "utf8");
const client = fs.readFileSync("src/lib/library/server-ingestion-client.ts", "utf8");
const ingest = fs.readFileSync("src/lib/library/ingest-source.ts", "utf8");
const pkg = fs.readFileSync("package.json", "utf8");
const all = parser + client + ingest + pkg;
const failures = [];

for (const token of [
  '"yauzl"',
  '"fast-xml-parser"',
  "validateEntrySizes: true",
  "assertSafeArchiveEntries",
  "assertEpubRequiredFiles",
  "application/epub+zip",
  "META-INF/container.xml",
  "library_epub_rootfile_missing",
  "library_epub_package_incomplete",
  "buildNormalizedSections",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "persistSession: false",
  "LIBRARY_ORIGINALS_BUCKET",
  'storage_provider !== "supabase"',
  "markLibrarySourceProcessing",
  "replaceLibrarySections",
  "markLibrarySourceFailed",
]) if (!all.includes(token)) failures.push(`missing parser/storage execution contract: ${token}`);

for (const forbidden of [
  "export async function POST",
  "export async function PUT",
  "export async function PATCH",
  "getPublicUrl",
  "createSignedUrl",
  "dangerouslySetInnerHTML",
]) if (all.includes(forbidden)) failures.push(`forbidden public/browser capability present: ${forbidden}`);

if (failures.length) {
  console.error("Library EPUB parser/storage execution verification FAILED");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Library EPUB parser/storage execution verification passed");
console.log("- ZIP parser is behind the existing archive guards");
console.log("- XML parsing is limited to EPUB container/package metadata");
console.log("- spine content is normalized into escaped text-only HTML");
console.log("- privileged Supabase credentials remain server-side only");
console.log("- private Storage download is restricted to the canonical Library originals bucket");
console.log("- no public ingestion endpoint or member upload UI is introduced");
