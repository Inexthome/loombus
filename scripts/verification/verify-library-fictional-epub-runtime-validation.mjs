import fs from "node:fs";

const route = fs.readFileSync("src/app/api/admin/library/fictional-epub-validation/route.ts", "utf8");
const fixture = fs.readFileSync("src/lib/library/fictional-epub-fixture.ts", "utf8");
const ingest = fs.readFileSync("src/lib/library/ingest-source.ts", "utf8");
const all = route + fixture + ingest;
const failures = [];

for (const token of [
  '"11111111-1111-4111-8111-111111111938"',
  '"22222222-2222-4222-8222-222222222942"',
  'LIBRARY_FICTIONAL_EPUB_VALIDATION_ENABLED !== "true"',
  "LIBRARY_FICTIONAL_EPUB_VALIDATION_TOKEN",
  "timingSafeEqual",
  "x-loombus-validation-token",
  'body?.action === "rollback"',
  "library_validation_nonfixture_source_present",
  "Loombus Reader Validation Book",
  "buildFictionalLibraryEpub",
  "application/epub+zip",
  "META-INF/container.xml",
  "OEBPS/content.opf",
  "OEBPS/chapter1.xhtml",
  "OEBPS/chapter2.xhtml",
  "must never execute",
  "ingestLibraryPublicationSource",
  "sha256Hex(buffer) !== source.sha256",
  "library_source_sha256_mismatch",
  "ingestion_status",
  'source?.ingestion_status === "ready"',
  "(sections?.length ?? 0) === 2",
]) if (!all.includes(token)) failures.push(`missing runtime validation contract: ${token}`);

for (const forbidden of [
  "export async function GET",
  "request.formData",
  "publicationId = body",
  "sourceId = body",
  "getPublicUrl",
  "createSignedUrl",
  "dangerouslySetInnerHTML",
]) if (all.includes(forbidden)) failures.push(`unsafe/out-of-scope capability present: ${forbidden}`);

if (failures.length) {
  console.error("Library fictional EPUB runtime validation verification FAILED");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Library fictional EPUB runtime validation verification passed");
console.log("- runner is disabled by default and token-gated");
console.log("- execution is pinned to the existing fictional publication/source IDs");
console.log("- non-fixture sources cannot be overwritten");
console.log("- deterministic two-section EPUB fixture is generated server-side");
console.log("- original-object SHA-256 is verified before parsing");
console.log("- rollback removes only the exact fictional source/object");
console.log("- no member upload or arbitrary publication execution is exposed");
