import { sha256Hex } from "@/lib/library/epub-validation";
import type { NormalizedEpubSection } from "@/lib/library/epub-manifest";

function isWhitespace(value: string) {
  return /\s|\u00a0/u.test(value);
}

function machineFilenamePrefixLength(value: string): number {
  let cursor = 0;
  while (cursor < value.length && isWhitespace(value[cursor])) cursor += 1;
  const tokenStart = cursor;
  while (cursor < value.length && !isWhitespace(value[cursor])) cursor += 1;
  if (cursor === tokenStart || cursor >= value.length) return 0;

  const token = value.slice(tokenStart, cursor);
  const basename = token.split("/").at(-1)?.toLowerCase() ?? "";
  const machineFilename = basename.endsWith(".xhtml") || basename.endsWith(".html") || basename.endsWith(".htm");
  if (!machineFilename || basename.startsWith(".")) return 0;

  while (cursor < value.length && isWhitespace(value[cursor])) cursor += 1;
  return cursor;
}

export function stripLeadingEpubMachineFilename(value: string): string {
  const prefixLength = machineFilenamePrefixLength(value);
  return prefixLength ? value.slice(prefixLength) : value;
}

function stripLeadingEpubMachineFilenameFromHtml(value: string): string {
  const leadingTrimmed = value.trimStart();
  if (!leadingTrimmed.toLowerCase().startsWith("<p")) return value;
  const paragraphStart = value.length - leadingTrimmed.length;
  const openingTagEnd = value.indexOf(">", paragraphStart);
  if (openingTagEnd < 0) return value;

  const bodyStart = openingTagEnd + 1;
  const prefixLength = machineFilenamePrefixLength(value.slice(bodyStart));
  if (!prefixLength) return value;
  return `${value.slice(0, bodyStart)}${value.slice(bodyStart + prefixLength)}`;
}

export function sanitizeNormalizedEpubSection(section: NormalizedEpubSection): NormalizedEpubSection {
  const contentText = stripLeadingEpubMachineFilename(section.contentText).trim();
  const contentHtml = stripLeadingEpubMachineFilenameFromHtml(section.contentHtml).trim();

  if (contentText === section.contentText.trim() && contentHtml === section.contentHtml.trim()) {
    return section;
  }

  if (!contentText || !contentHtml) {
    throw new Error("library_epub_section_empty_after_machine_filename_cleanup");
  }

  return {
    ...section,
    contentText,
    contentHtml,
    contentSha256: sha256Hex(Buffer.from(`${contentHtml}\n${contentText}`)),
  };
}
