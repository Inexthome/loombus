import { sha256Hex } from "@/lib/library/epub-validation";
import type { NormalizedEpubSection } from "@/lib/library/epub-manifest";

const LEADING_MACHINE_FILENAME = /^[\s\u00a0]*(?:[^\s<>]+\/)*[^\s<>/]+\.(?:xhtml|html?)[\s\u00a0]+/i;
const LEADING_MACHINE_FILENAME_HTML = /^(\s*<p\b[^>]*>)[\s\u00a0]*(?:[^\s<>]+\/)*[^\s<>/]+\.(?:xhtml|html?)[\s\u00a0]+/i;

export function stripLeadingEpubMachineFilename(value: string): string {
  return value.replace(LEADING_MACHINE_FILENAME, "");
}

function stripLeadingEpubMachineFilenameFromHtml(value: string): string {
  return value.replace(LEADING_MACHINE_FILENAME_HTML, "$1");
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
