import { sha256Hex } from "@/lib/library/epub-validation";

export type EpubManifestItem = {
  id: string;
  href: string;
  mediaType: string;
  properties?: string[];
};
export type EpubSpineItem = { idref: string };
export type EpubPackage = { rootfilePath: string; manifest: EpubManifestItem[]; spine: EpubSpineItem[] };
export type EpubTextResource = {
  path: string;
  title: string | null;
  html: string;
  text: string;
  logicalKey?: string;
};

export type NormalizedEpubSection = {
  sectionKey: string;
  ordinal: number;
  title: string | null;
  contentHtml: string;
  contentText: string;
  contentSha256: string;
};

function normalizePath(baseFile: string, href: string): string {
  const base = baseFile.replaceAll("\\", "/").split("/").slice(0, -1);
  const parts = [...base, ...href.split("#")[0].split("/")];
  const output: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (!output.length) throw new Error("library_epub_manifest_path_escape");
      output.pop();
    } else output.push(part);
  }
  return output.join("/");
}

function asResourceList(value: EpubTextResource | EpubTextResource[] | undefined): EpubTextResource[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export function buildNormalizedSections(
  pkg: EpubPackage,
  resources: Map<string, EpubTextResource | EpubTextResource[]>,
): NormalizedEpubSection[] {
  const manifest = new Map(pkg.manifest.map((item) => [item.id, item]));
  const sections: NormalizedEpubSection[] = [];
  for (const spine of pkg.spine) {
    const item = manifest.get(spine.idref);
    if (!item || !["application/xhtml+xml", "text/html"].includes(item.mediaType)) continue;
    const path = normalizePath(pkg.rootfilePath, item.href);
    for (const [resourceIndex, resource] of asResourceList(resources.get(path)).entries()) {
      if (!resource.text.trim()) continue;
      const contentText = resource.text.trim();
      const contentHtml = resource.html.trim();
      const title = resource.title?.trim() || `Section ${sections.length + 1}`;
      const identity = `${path}#${resource.logicalKey ?? resourceIndex}`;
      sections.push({
        sectionKey: `v1:${sections.length}:${sha256Hex(Buffer.from(identity)).slice(0, 16)}`,
        ordinal: sections.length,
        title,
        contentHtml,
        contentText,
        contentSha256: sha256Hex(Buffer.from(`${contentHtml}\n${contentText}`)),
      });
    }
  }
  if (!sections.length) throw new Error("library_epub_no_readable_sections");
  return sections;
}
