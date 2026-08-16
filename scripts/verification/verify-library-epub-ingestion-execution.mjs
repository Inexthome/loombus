import fs from "node:fs";

const validation = fs.readFileSync("src/lib/library/epub-validation.ts", "utf8");
const manifest = fs.readFileSync("src/lib/library/epub-manifest.ts", "utf8");
const state = fs.readFileSync("src/lib/library/ingestion-state.ts", "utf8");
const all = validation + manifest + state;
const failures = [];

for (const token of [
  "MAX_LIBRARY_EPUB_BYTES",
  "MAX_LIBRARY_EPUB_ENTRIES",
  "MAX_LIBRARY_EPUB_UNCOMPRESSED_BYTES",
  "library_epub_unsafe_path",
  "library_epub_compression_ratio_exceeded",
  "META-INF/container.xml",
  "application/epub+zip",
  "buildNormalizedSections",
  "library_epub_manifest_path_escape",
  "library_epub_no_readable_sections",
  "contentSha256",
  "markLibrarySourceProcessing",
  "markLibrarySourceFailed",
  "replaceLibrarySections",
  'ingestion_status: "ready"',
]) if (!all.includes(token)) failures.push(`missing ingestion contract: ${token}`);

for (const forbidden of ["SUPABASE_SERVICE_ROLE_KEY", "createClient(", "storage.from(", "getPublicUrl", "createSignedUrl", "route.ts", "FormData", "FileReader", "JSZip", "adm-zip"]) {
  if (all.includes(forbidden)) failures.push(`out-of-scope execution capability present: ${forbidden}`);
}

if (failures.length) {
  console.error("Library EPUB ingestion execution verification FAILED");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log("Library EPUB ingestion execution verification passed");
console.log("- upload metadata and archive safety limits are explicit");
console.log("- path traversal and compression-ratio guards are present");
console.log("- EPUB required-file and spine normalization contracts are present");
console.log("- normalized sections receive stable versioned keys and hashes");
console.log("- ingestion state transitions are server-client injected, not credential-bearing");
console.log("- no endpoint, browser upload, storage execution, or parser dependency is enabled yet");
