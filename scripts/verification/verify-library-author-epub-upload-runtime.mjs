import fs from "node:fs";

const migrationPath = "supabase/migrations/20260823024500_add_library_author_epub_ingestion_runtime.sql";
const routePath = "src/app/api/library/author/ingest-epub/route.ts";
const uploadPath = "src/components/library/library-author-epub-upload.tsx";
const pagePath = "src/app/library/publish/page.tsx";
const envPath = ".env.example";

for (const path of [migrationPath, routePath, uploadPath, pagePath, envPath]) {
  if (!fs.existsSync(path)) throw new Error(`Missing required file: ${path}`);
}

const migration = fs.readFileSync(migrationPath, "utf8");
const route = fs.readFileSync(routePath, "utf8");
const upload = fs.readFileSync(uploadPath, "utf8");
const page = fs.readFileSync(pagePath, "utf8");
const env = fs.readFileSync(envPath, "utf8");
const protectedRuntime = `${migration}\n${route}\n${upload}\n${page}`;

for (const fragment of [
  "begin_library_author_epub_ingestion",
  "complete_library_author_epub_ingestion",
  "fail_library_author_epub_ingestion",
  "library_ingestion_route_token_valid",
  "jsonb_to_recordset",
  "library_author_readable_content_required",
  "library_publish_readable_content_required",
  "ingestion_status = 'ready'",
]) {
  if (!migration.includes(fragment)) throw new Error(`Missing ingestion runtime guard: ${fragment}`);
}

for (const fragment of [
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "LIBRARY_INGESTION_ROUTE_TOKEN",
  "parseEpubBuffer",
  "sha256Hex",
  'rpc("begin_library_author_epub_ingestion"',
  'rpc("complete_library_author_epub_ingestion"',
  'rpc("fail_library_author_epub_ingestion"',
]) {
  if (!route.includes(fragment)) throw new Error(`Missing request-scoped ingestion route contract: ${fragment}`);
}

for (const fragment of [
  'rpc("prepare_library_author_epub_source"',
  '.storage',
  '.upload(',
  'fetch("/api/library/author/ingest-epub"',
  "MAX_EPUB_BYTES",
  "onReadyChange",
  "Ready for review",
]) {
  if (!upload.includes(fragment)) throw new Error(`Missing author EPUB upload contract: ${fragment}`);
}

for (const fragment of [
  "LibraryAuthorEpubUpload",
  "contentReady",
  "Upload and process an EPUB before submitting",
  "disabled={saving || !contentReady}",
]) {
  if (!page.includes(fragment)) throw new Error(`Missing author publishing ready-content gate: ${fragment}`);
}

if (!env.includes("LIBRARY_INGESTION_ROUTE_TOKEN=your_library_ingestion_route_token")) {
  throw new Error("Missing server-only Library ingestion capability deployment contract.");
}

for (const forbidden of [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
  "server-ingestion-client",
  "createLibraryIngestionClient",
  "dangerouslySetInnerHTML",
]) {
  if (protectedRuntime.includes(forbidden)) throw new Error(`Forbidden Library ingestion dependency: ${forbidden}`);
}

if (route.includes("NEXT_PUBLIC_LIBRARY_INGESTION_ROUTE_TOKEN") || upload.includes("LIBRARY_INGESTION_ROUTE_TOKEN")) {
  throw new Error("Library ingestion route capability must remain server-only.");
}

console.log("Library author EPUB upload runtime verification passed.");
