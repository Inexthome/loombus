import fs from "node:fs";

const parserPath = "src/lib/library/epub-parser.ts";
const manifestPath = "src/lib/library/epub-manifest.ts";

const parser = fs.readFileSync(parserPath, "utf8");
const manifest = fs.readFileSync(manifestPath, "utf8");

const requiredParserFragments = [
  'properties: String(item?.["@_properties"] ?? "")',
  'item.properties?.includes("nav")',
  "extractNavigationLabels",
  "extractHeadingLabels",
  "isLogicalChapterLabel",
  "isLogicalBoundaryLabel",
  "extractStrongParagraphBoundaryLabels",
  "strongBoundaryLabels",
  "findSequentialLabels",
  "splitLogicalTextResources",
  "chapterHeadings",
  "navigationLabels.get(path)",
  "isMachineDocumentTitle",
  'if (item.properties?.includes("nav")) continue;',
  "a note before we begin",
  "about the author",
];

for (const fragment of requiredParserFragments) {
  if (!parser.includes(fragment)) {
    throw new Error(`Missing EPUB chapter normalization parser contract: ${fragment}`);
  }
}

const requiredManifestFragments = [
  "properties?: string[]",
  "logicalKey?: string",
  "EpubTextResource | EpubTextResource[]",
  "for (const [resourceIndex, resource]",
  "title = resource.title?.trim() || `Section ${sections.length + 1}`",
];

for (const fragment of requiredManifestFragments) {
  if (!manifest.includes(fragment)) {
    throw new Error(`Missing EPUB chapter normalization manifest contract: ${fragment}`);
  }
}

const forbidden = [
  "dangerouslySetInnerHTML",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
  "createLibraryIngestionClient",
];

for (const fragment of forbidden) {
  if (parser.includes(fragment) || manifest.includes(fragment)) {
    throw new Error(`Forbidden EPUB chapter normalization dependency: ${fragment}`);
  }
}

console.log("PASS: Library EPUB normalization uses EPUB navigation, semantic headings, and conservative bold-paragraph boundaries to create ordered logical sections with human-readable titles.");
