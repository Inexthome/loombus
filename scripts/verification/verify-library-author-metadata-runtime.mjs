import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const migration = read("supabase/migrations/20260824094500_wire_library_richer_metadata_discovery.sql");
const editor = read("src/components/library/library-bibliographic-metadata-editor.tsx");
const authorPublish = read("src/app/library/publish/page.tsx");
const authorUpload = read("src/components/library/library-author-epub-upload.tsx");
const authorCommerce = read("src/components/library/library-author-commerce-editor.tsx");
const revisions = read("src/app/library/publish/revisions/page.tsx");
const adminRevision = read("src/app/admin/library-review/revisions/page.tsx");
const adminPreview = read("src/components/library/library-admin-normalized-preview.tsx");
const detail = read("src/components/library/library-publication-detail.tsx");
const discover = read("src/components/library/library-discover-catalog.tsx");

const checks = [
  [migration.includes("search_library_published_catalog") && migration.includes("published_series_trgm_idx") && migration.includes("published_subjects_gin_idx"), "discovery RPC remains the single indexed richer metadata catalog path"],
  [migration.includes("p.status = 'published'") && migration.includes("security invoker"), "catalog remains published-only and RLS-invoker scoped"],
  [migration.includes("series_title") && migration.includes("subjects") && migration.includes("audience_label"), "richer metadata is returned and searched by discovery"],
  [!migration.includes("generated always as") && !migration.includes("array_to_string(subjects"), "richer discovery avoids non-immutable generated expressions"],
  [editor.includes("update_library_author_bibliographic_metadata") && editor.includes("update_library_author_revision_bibliographic_metadata"), "author editor uses guarded foundation RPCs"],
  [authorPublish.includes("LibraryBibliographicMetadataEditor") && authorPublish.includes('mode="publication"'), "first-publication runtime exposes one bibliographic editor"],
  [!authorUpload.includes("LibraryBibliographicMetadataEditor") && !authorCommerce.includes("LibraryBibliographicMetadataEditor"), "first-publication metadata editor is not duplicated across content and commerce panels"],
  [revisions.includes("LibraryBibliographicMetadataEditor") && revisions.includes('mode="revision"'), "revision runtime exposes version-scoped bibliographic editor"],
  [adminRevision.includes("series_title") && adminRevision.includes("audience_label") && adminRevision.includes("subjects"), "admin revision review shows richer staged metadata"],
  [adminPreview.includes("series_title") && adminPreview.includes("subjects") && adminPreview.includes("audience_label"), "first-publication admin normalized preview shows richer metadata"],
  [detail.includes("get_library_published_author_profile") && detail.includes("/u/${encodeURIComponent(authorProfile.username)}"), "published detail uses the existing authenticated member-profile bridge"],
  [detail.includes("series_title") && detail.includes("edition_label") && detail.includes("subjects") && detail.includes("audience_label"), "published detail renders richer metadata"],
  [discover.includes("series_title") && discover.includes("subjects") && discover.includes("audience_label"), "Discover renders richer metadata from bounded RPC"],
  [!editor.includes("service_role") && !detail.includes("service_role") && !discover.includes("service_role"), "runtime introduces no service-role usage"],
  [!editor.includes("dangerouslySetInnerHTML") && !detail.includes("dangerouslySetInnerHTML") && !discover.includes("dangerouslySetInnerHTML"), "runtime introduces no unsafe HTML rendering"],
  [!migration.includes("library_author_profiles"), "no second Library author identity table is introduced"],
];

let failed = false;
for (const [ok, label] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}: ${label}`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
console.log("Library author/profile + richer metadata runtime verification passed.");
