import yauzl, { type Entry, type ZipFile } from "yauzl";
import { XMLParser } from "fast-xml-parser";
import {
  assertEpubRequiredFiles,
  assertSafeArchiveEntries,
  MAX_LIBRARY_EPUB_ENTRIES,
  type EpubArchiveEntry,
} from "@/lib/library/epub-validation";
import {
  buildNormalizedSections,
  type EpubManifestItem,
  type EpubPackage,
  type EpubSpineItem,
  type EpubTextResource,
  type NormalizedEpubSection,
} from "@/lib/library/epub-manifest";

const XML_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  trimValues: true,
};

const xmlParser = new XMLParser(XML_OPTIONS);
const xhtmlParser = new XMLParser({
  ...XML_OPTIONS,
  alwaysCreateTextNode: true,
});

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function openZip(buffer: Buffer): Promise<ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true, decodeStrings: true, validateEntrySizes: true }, (error, zipFile) => {
      if (error || !zipFile) return reject(error ?? new Error("library_epub_zip_open_failed"));
      resolve(zipFile);
    });
  });
}

function readEntry(zipFile: ZipFile, entry: Entry): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    zipFile.openReadStream(entry, (error, stream) => {
      if (error || !stream) return reject(error ?? new Error("library_epub_entry_stream_failed"));
      const chunks: Buffer[] = [];
      let total = 0;
      stream.on("data", (chunk: Buffer) => {
        total += chunk.length;
        if (total > entry.uncompressedSize) {
          stream.destroy(new Error("library_epub_entry_size_mismatch"));
          return;
        }
        chunks.push(chunk);
      });
      stream.on("error", reject);
      stream.on("end", () => resolve(Buffer.concat(chunks)));
    });
  });
}

async function collectEntries(buffer: Buffer): Promise<{ zipFile: ZipFile; entries: Map<string, Entry> }> {
  const zipFile = await openZip(buffer);
  const entries = new Map<string, Entry>();
  const safetyRows: EpubArchiveEntry[] = [];

  return await new Promise((resolve, reject) => {
    const fail = (error: unknown) => {
      try { zipFile.close(); } catch {}
      reject(error);
    };

    zipFile.on("error", fail);
    zipFile.on("entry", (entry: Entry) => {
      try {
        const path = entry.fileName.replaceAll("\\", "/");
        safetyRows.push({ path, compressedSize: entry.compressedSize, uncompressedSize: entry.uncompressedSize });
        if (safetyRows.length > MAX_LIBRARY_EPUB_ENTRIES) throw new Error("library_epub_entry_count_invalid");
        if (!/\/$/.test(path)) entries.set(path, entry);
        zipFile.readEntry();
      } catch (error) {
        fail(error);
      }
    });
    zipFile.on("end", () => {
      try {
        assertSafeArchiveEntries(safetyRows);
        assertEpubRequiredFiles([...entries.keys()]);
        resolve({ zipFile, entries });
      } catch (error) {
        fail(error);
      }
    });
    zipFile.readEntry();
  });
}

function parseContainer(xml: string): string {
  const parsed = xmlParser.parse(xml) as Record<string, any>;
  const rootfiles = asArray(parsed?.container?.rootfiles?.rootfile);
  const path = rootfiles[0]?.["@_full-path"];
  if (typeof path !== "string" || !path.trim()) throw new Error("library_epub_rootfile_missing");
  return path.replaceAll("\\", "/");
}

function parsePackage(rootfilePath: string, xml: string): EpubPackage {
  const parsed = xmlParser.parse(xml) as Record<string, any>;
  const pkg = parsed?.package;
  const manifestItems = asArray(pkg?.manifest?.item);
  const spineItems = asArray(pkg?.spine?.itemref);
  const manifest: EpubManifestItem[] = manifestItems.map((item: any) => ({
    id: String(item?.["@_id"] ?? ""),
    href: String(item?.["@_href"] ?? ""),
    mediaType: String(item?.["@_media-type"] ?? ""),
    properties: String(item?.["@_properties"] ?? "").split(/\s+/).filter(Boolean),
  })).filter((item) => item.id && item.href && item.mediaType);
  const spine: EpubSpineItem[] = spineItems.map((item: any) => ({
    idref: String(item?.["@_idref"] ?? ""),
  })).filter((item) => item.idref);
  if (!manifest.length || !spine.length) throw new Error("library_epub_package_incomplete");
  return { rootfilePath, manifest, spine };
}

function normalizePath(baseFile: string, href: string): string {
  const base = baseFile.split("/").slice(0, -1);
  const output: string[] = [];
  for (const part of [...base, ...href.split("#")[0].split("/")]) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (!output.length) throw new Error("library_epub_manifest_path_escape");
      output.pop();
    } else output.push(part);
  }
  return output.join("/");
}

const BLOCKED_TEXT_ELEMENTS = new Set(["script", "style", "iframe", "object", "embed"]);

function collectNodeText(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number" || typeof node === "boolean") return String(node);
  if (Array.isArray(node)) return node.map(collectNodeText).filter(Boolean).join(" ");
  if (typeof node !== "object") return "";

  const parts: string[] = [];
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key.startsWith("@_") || key === "?xml" || BLOCKED_TEXT_ELEMENTS.has(key.toLowerCase())) continue;
    if (key === "#text") {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") parts.push(String(value));
      continue;
    }
    const nested = collectNodeText(value);
    if (nested) parts.push(nested);
  }
  return parts.join(" ");
}

function findFirstTagText(node: unknown, target: string): string | null {
  if (node == null || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findFirstTagText(child, target);
      if (found) return found;
    }
    return null;
  }
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key.toLowerCase() === target) {
      const text = collectNodeText(value).replace(/\s+/g, " ").trim();
      if (text) return text;
    }
    if (!key.startsWith("@_") && key !== "#text") {
      const found = findFirstTagText(value, target);
      if (found) return found;
    }
  }
  return null;
}

function escapeHtmlText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeLabel(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isMachineDocumentTitle(value: string | null): boolean {
  if (!value) return false;
  return /(?:^|\/)ch\d+\.(?:x?html?)$/i.test(value) || /\.(?:x?html?)$/i.test(value);
}

function textFromMarkup(markup: string): string {
  try {
    const parsed = xhtmlParser.parse(`<root>${markup}</root>`);
    return normalizeLabel(collectNodeText(parsed));
  } catch {
    return "";
  }
}

function extractHeadingLabels(source: string): Array<{ level: number; label: string }> {
  const labels: Array<{ level: number; label: string }> = [];
  const pattern = /<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi;
  for (const match of source.matchAll(pattern)) {
    const label = textFromMarkup(match[2]);
    if (label) labels.push({ level: Number(match[1]), label });
  }
  return labels;
}

function isLogicalChapterLabel(label: string): boolean {
  return /^(?:chapter\b|prologue\b|epilogue\b|introduction\b|preface\b|foreword\b|afterword\b|part\s+(?:[\divxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten)\b)/i.test(label);
}

function dedupeLabels(labels: string[]): string[] {
  const output: string[] = [];
  for (const label of labels.map(normalizeLabel).filter(Boolean)) {
    if (!output.some((existing) => existing.toLocaleLowerCase() === label.toLocaleLowerCase())) output.push(label);
  }
  return output;
}

function extractNavigationLabels(navPath: string, source: string): Map<string, string[]> {
  const result = new Map<string, string[]>();
  const tocMatch = source.match(/<nav\b[^>]*(?:epub:type|type)\s*=\s*["'][^"']*\btoc\b[^"']*["'][^>]*>([\s\S]*?)<\/nav\s*>/i);
  const scope = tocMatch?.[1] ?? source;
  const anchorPattern = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a\s*>/gi;
  for (const match of scope.matchAll(anchorPattern)) {
    const href = match[1].trim();
    if (!href || /^[a-z][a-z0-9+.-]*:/i.test(href)) continue;
    const label = textFromMarkup(match[2]);
    if (!label) continue;
    let path: string;
    try {
      path = normalizePath(navPath, href);
    } catch {
      continue;
    }
    const existing = result.get(path) ?? [];
    existing.push(label);
    result.set(path, existing);
  }
  for (const [path, labels] of result) result.set(path, dedupeLabels(labels));
  return result;
}

function findSequentialLabels(text: string, labels: string[]): Array<{ label: string; start: number; end: number }> {
  const lowerText = text.toLocaleLowerCase();
  const found: Array<{ label: string; start: number; end: number }> = [];
  let cursor = 0;
  for (const label of labels) {
    const needle = label.toLocaleLowerCase();
    const start = lowerText.indexOf(needle, cursor);
    if (start < 0) continue;
    found.push({ label, start, end: start + label.length });
    cursor = start + label.length;
  }
  return found;
}

function safeTextResource(path: string, title: string | null, text: string, logicalKey?: string): EpubTextResource {
  const normalizedText = normalizeLabel(text);
  return {
    path,
    title: title ? normalizeLabel(title) : null,
    html: normalizedText ? `<p>${escapeHtmlText(normalizedText)}</p>` : "",
    text: normalizedText,
    logicalKey,
  };
}

function splitLogicalTextResources(path: string, source: string, navigationLabels: string[]): EpubTextResource[] {
  let parsed: unknown;
  try {
    parsed = xhtmlParser.parse(source);
  } catch {
    throw new Error("library_epub_xhtml_invalid");
  }

  const text = normalizeLabel(collectNodeText(parsed));
  const rawDocumentTitle = findFirstTagText(parsed, "title");
  const documentTitle = isMachineDocumentTitle(rawDocumentTitle) ? null : rawDocumentTitle;
  if (!text) return [];

  const headings = extractHeadingLabels(source);
  const chapterHeadings = dedupeLabels(headings.filter((heading) => isLogicalChapterLabel(heading.label)).map((heading) => heading.label));
  const h1Labels = dedupeLabels(headings.filter((heading) => heading.level === 1).map((heading) => heading.label));
  const navLabels = dedupeLabels(navigationLabels);

  let candidates: string[] = [];
  if (navLabels.length >= 2) candidates = navLabels;
  else if (chapterHeadings.length) candidates = chapterHeadings;
  else if (h1Labels.length >= 2) candidates = h1Labels;

  if (candidates.length >= 2) {
    const found = findSequentialLabels(text, candidates);
    if (found.length >= 2) {
      const sections: EpubTextResource[] = [];
      const prefix = text.slice(0, found[0].start).trim();
      if (prefix.length >= 80) sections.push(safeTextResource(path, documentTitle, prefix, "frontmatter"));
      for (const [index, marker] of found.entries()) {
        const next = found[index + 1];
        const body = text.slice(marker.end, next?.start ?? text.length).trim();
        if (!body) continue;
        sections.push(safeTextResource(path, marker.label, body, `logical-${index}-${marker.start}`));
      }
      if (sections.length >= 2) return sections;
    }
  }

  const preferredTitle = navLabels[0]
    ?? chapterHeadings[0]
    ?? h1Labels[0]
    ?? documentTitle;
  return [safeTextResource(path, preferredTitle, text, "document")];
}

export async function parseEpubBuffer(buffer: Buffer): Promise<NormalizedEpubSection[]> {
  const { zipFile, entries } = await collectEntries(buffer);
  try {
    const mimetypeEntry = entries.get("mimetype");
    const containerEntry = entries.get("META-INF/container.xml");
    if (!mimetypeEntry || !containerEntry) throw new Error("library_epub_required_file_missing");

    const mimetype = (await readEntry(zipFile, mimetypeEntry)).toString("utf8").trim();
    if (mimetype !== "application/epub+zip") throw new Error("library_epub_mimetype_invalid");

    const rootfilePath = parseContainer((await readEntry(zipFile, containerEntry)).toString("utf8"));
    const rootfileEntry = entries.get(rootfilePath);
    if (!rootfileEntry) throw new Error("library_epub_rootfile_not_found");
    const pkg = parsePackage(rootfilePath, (await readEntry(zipFile, rootfileEntry)).toString("utf8"));

    let navigationLabels = new Map<string, string[]>();
    const navItem = pkg.manifest.find((item) => item.properties?.includes("nav"));
    if (navItem && ["application/xhtml+xml", "text/html"].includes(navItem.mediaType)) {
      const navPath = normalizePath(pkg.rootfilePath, navItem.href);
      const navEntry = entries.get(navPath);
      if (navEntry) {
        navigationLabels = extractNavigationLabels(navPath, (await readEntry(zipFile, navEntry)).toString("utf8"));
      }
    }

    const resources = new Map<string, EpubTextResource[]>();
    const manifest = new Map(pkg.manifest.map((item) => [item.id, item]));
    for (const spine of pkg.spine) {
      const item = manifest.get(spine.idref);
      if (!item || !["application/xhtml+xml", "text/html"].includes(item.mediaType)) continue;
      const path = normalizePath(pkg.rootfilePath, item.href);
      const entry = entries.get(path);
      if (!entry) continue;
      const source = (await readEntry(zipFile, entry)).toString("utf8");
      resources.set(path, splitLogicalTextResources(path, source, navigationLabels.get(path) ?? []));
    }

    return buildNormalizedSections(pkg, resources);
  } finally {
    zipFile.close();
  }
}
