import fs from "node:fs";

const researchPath = "src/components/library/library-research-surface.tsx";
if (!fs.existsSync(researchPath)) throw new Error(`Missing Research workspace file: ${researchPath}`);

const research = fs.readFileSync(researchPath, "utf8");

function requireText(source, text, label) {
  if (!source.includes(text)) throw new Error(`Missing ${label}: ${text}`);
}

function rejectText(source, text, label) {
  if (source.includes(text)) throw new Error(`Forbidden ${label}: ${text}`);
}

requireText(research, '.from("library_research_collections")', "private collections runtime");
requireText(research, '.from("library_research_item_metadata")', "private notes/tags runtime");
requireText(research, '.from("library_research_collection_items")', "collection membership runtime");
requireText(research, 'onConflict: "research_item_id"', "metadata upsert key");
requireText(research, 'normalizeTags(tagsDraft)', "bounded tag normalization");
requireText(research, 'activeCollectionId', "collection filtering");
requireText(research, 'activeTag', "tag filtering");
requireText(research, 'Private note', "private-note presentation");
requireText(research, 'Saved passages will remain in Research.', "collection deletion preserves passages");
requireText(research, '.from("library_reading_progress")', "source chapter navigation");

rejectText(research, '.from("library_research_items").update', "saved-passage provenance update");
rejectText(research, 'SUPABASE_SERVICE_ROLE_KEY', "service-role access");
rejectText(research, 'library-publication-originals', "original EPUB access");
rejectText(research, 'dangerouslySetInnerHTML', "raw HTML rendering");

console.log("PASS: Library Research workspace supports private collections, notes, tags, filtering, and organization without weakening saved-passage provenance.");
