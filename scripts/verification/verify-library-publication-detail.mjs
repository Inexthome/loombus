import fs from "node:fs";

const pagePath = "src/app/library/publication/[publicationId]/page.tsx";
const detailPath = "src/components/library/library-publication-detail.tsx";
const readerPath = "src/app/library/read/[publicationId]/page.tsx";

for (const path of [pagePath, detailPath, readerPath]) {
  if (!fs.existsSync(path)) throw new Error(`Missing Library publication detail file: ${path}`);
}

const page = fs.readFileSync(pagePath, "utf8");
const detail = fs.readFileSync(detailPath, "utf8");
const reader = fs.readFileSync(readerPath, "utf8");

for (const fragment of [
  "LibraryPublicationDetail",
  'params: Promise<{ publicationId: string }>',
]) {
  if (!page.includes(fragment)) throw new Error(`Missing publication detail route contract: ${fragment}`);
}

for (const fragment of [
  '.from("library_publications")',
  '.eq("id", publicationId)',
  '.eq("status", "published")',
  'This publication is no longer available.',
  'library_member_items',
  'library_reading_progress',
  'LibraryCoverImage',
  'Add to My Library',
  'Remove from My Library',
  'Readable sections',
  '?open=1',
]) {
  if (!detail.includes(fragment)) throw new Error(`Missing publication detail behavior: ${fragment}`);
}

for (const fragment of [
  'import { redirect } from "next/navigation"',
  'if (open !== "1") redirect(`/library/publication/${publicationId}`)',
  'LibraryReaderAccessBoundary',
  'LibraryReaderSurface',
]) {
  if (!reader.includes(fragment)) throw new Error(`Missing Reader handoff contract: ${fragment}`);
}

if (detail.includes("dangerouslySetInnerHTML")) {
  throw new Error("Publication detail must not render unsafe HTML.");
}

if (detail.includes("service_role") || detail.includes("SUPABASE_SERVICE_ROLE_KEY")) {
  throw new Error("Publication detail must not use service-role credentials.");
}

console.log("Library publication detail verification passed.");
