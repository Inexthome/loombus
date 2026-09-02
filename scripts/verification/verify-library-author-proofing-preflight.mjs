import fs from "node:fs";

const files = {
  gate: "supabase/migrations/20260902230000_add_library_author_proofing_preflight.sql",
  metadataInvalidation: "supabase/migrations/20260902230100_invalidate_library_proofing_on_metadata_change.sql",
  proofing: "src/components/library/library-author-proofing-preflight.tsx",
  epub: "src/components/library/library-author-epub-upload.tsx",
  commerce: "src/components/library/library-author-commerce-editor.tsx",
  revisions: "src/app/library/publish/revisions/page.tsx",
  styles: "src/app/library/publish/library-publish-proofing.css",
  layout: "src/app/library/publish/layout.tsx",
};

for (const path of Object.values(files)) {
  if (!fs.existsSync(path)) throw new Error(`Missing Library proofing file: ${path}`);
}

const read = (path) => fs.readFileSync(path, "utf8");
const gate = read(files.gate);
const metadataInvalidation = read(files.metadataInvalidation);
const proofing = read(files.proofing);
const epub = read(files.epub);
const commerce = read(files.commerce);
const revisions = read(files.revisions);
const layout = read(files.layout);
const all = Object.values(files).map(read).join("\n");

for (const fragment of [
  "library_author_proofing_attestations",
  "source_sha256",
  "preview_confirmed_at",
  "rights_attested_at",
  "confirm_library_author_proofing",
  "invalidate_library_author_proofing_on_source_change",
  "library_author_current_source_proofing_required",
  "library_revision_current_source_proofing_required",
  "proof.source_sha256 = s.sha256",
]) {
  if (!gate.includes(fragment)) throw new Error(`Missing database proofing contract: ${fragment}`);
}

for (const fragment of [
  "invalidate_library_author_proofing_on_version_change",
  "before update of title, subtitle, description",
  "subjects, keywords",
]) {
  if (!metadataInvalidation.includes(fragment)) throw new Error(`Missing metadata invalidation contract: ${fragment}`);
}

for (const fragment of [
  "Reader proof reviewed",
  "Publishing rights confirmed",
  "confirm_library_author_proofing",
  "p_preview_confirmed: true",
  "p_rights_attested: true",
  "source_sha256 === source.sha256",
]) {
  if (!proofing.includes(fragment)) throw new Error(`Missing author proofing UI contract: ${fragment}`);
}

if (!epub.includes("LibraryAuthorProofingPreflight")) throw new Error("First-publication EPUB flow is not wired to proofing preflight.");
if (!epub.includes("onReadyChange={onReadyChange}")) throw new Error("First-publication submit readiness is not driven by proofing preflight.");
if (epub.includes("LibraryBibliographicMetadataEditor")) throw new Error("EPUB panel must not duplicate bibliographic metadata editing.");
if (commerce.includes("LibraryBibliographicMetadataEditor")) throw new Error("Commerce panel must not duplicate bibliographic metadata editing.");

for (const fragment of [
  "LibraryAuthorProofingPreflight",
  "proofingReady",
  "!proofingReady",
  "Live vs staged",
  "Version history",
  "LibraryVersionNormalizedPreview",
]) {
  if (!revisions.includes(fragment)) throw new Error(`Missing revision proofing/review contract: ${fragment}`);
}

if (!layout.includes('import "./library-publish-proofing.css"')) throw new Error("Publishing proofing styles are not loaded by the shared layout.");
if (/SUPABASE_SERVICE_ROLE_KEY|service_role/i.test(all)) throw new Error("Author proofing must not introduce service-role access.");
if (proofing.includes("dangerouslySetInnerHTML") || revisions.includes("dangerouslySetInnerHTML")) throw new Error("Author proofing/revision UI must not render raw EPUB HTML.");

console.log("Library author proofing preflight verification passed.");
