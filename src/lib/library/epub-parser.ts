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

function htmlToSafeTextResource(path: string, source: string): EpubTextResource {
  let parsed: unknown;
  try {
    parsed = xhtmlParser.parse(source);
  } catch {
    throw new Error("library_epub_xhtml_invalid");
  }

  const text = collectNodeText(parsed).replace(/\s+/g, " ").trim();
  const title = findFirstTagText(parsed, "title");
  const contentHtml = text ? `<p>${escapeHtmlText(text)}</p>` : "";
  return { path, title, html: contentHtml, text };
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

    const resources = new Map<string, EpubTextResource>();
    const manifest = new Map(pkg.manifest.map((item) => [item.id, item]));
    for (const spine of pkg.spine) {
      const item = manifest.get(spine.idref);
      if (!item || !["application/xhtml+xml", "text/html"].includes(item.mediaType)) continue;
      const path = normalizePath(pkg.rootfilePath, item.href);
      const entry = entries.get(path);
      if (!entry) continue;
      resources.set(path, htmlToSafeTextResource(path, (await readEntry(zipFile, entry)).toString("utf8")));
    }

    return buildNormalizedSections(pkg, resources);
  } finally {
    zipFile.close();
  }
}
