import { createHash } from "node:crypto";

export const MAX_LIBRARY_EPUB_BYTES = 50 * 1024 * 1024;
export const MAX_LIBRARY_EPUB_ENTRIES = 5000;
export const MAX_LIBRARY_EPUB_UNCOMPRESSED_BYTES = 250 * 1024 * 1024;

export type EpubArchiveEntry = {
  path: string;
  compressedSize: number;
  uncompressedSize: number;
};

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function assertSafeEpubUpload(input: { name: string; type: string; size: number }): void {
  if (!input.name.toLowerCase().endsWith(".epub")) throw new Error("library_epub_extension_required");
  if (input.type !== "application/epub+zip") throw new Error("library_epub_mime_required");
  if (!Number.isSafeInteger(input.size) || input.size <= 0 || input.size > MAX_LIBRARY_EPUB_BYTES) {
    throw new Error("library_epub_size_invalid");
  }
}

export function assertSafeArchiveEntries(entries: EpubArchiveEntry[]): void {
  if (!entries.length || entries.length > MAX_LIBRARY_EPUB_ENTRIES) throw new Error("library_epub_entry_count_invalid");
  let total = 0;
  for (const entry of entries) {
    const normalized = entry.path.replaceAll("\\", "/");
    if (!normalized || normalized.startsWith("/") || normalized.split("/").includes("..") || /^[a-zA-Z]:\//.test(normalized)) {
      throw new Error("library_epub_unsafe_path");
    }
    if (entry.compressedSize < 0 || entry.uncompressedSize < 0) throw new Error("library_epub_entry_size_invalid");
    total += entry.uncompressedSize;
    if (!Number.isSafeInteger(total) || total > MAX_LIBRARY_EPUB_UNCOMPRESSED_BYTES) throw new Error("library_epub_uncompressed_limit_exceeded");
    if (entry.compressedSize > 0 && entry.uncompressedSize / entry.compressedSize > 200) throw new Error("library_epub_compression_ratio_exceeded");
  }
}

export function assertEpubRequiredFiles(paths: string[]): void {
  const normalized = new Set(paths.map((path) => path.replaceAll("\\", "/")));
  if (!normalized.has("mimetype")) throw new Error("library_epub_mimetype_missing");
  if (!normalized.has("META-INF/container.xml")) throw new Error("library_epub_container_missing");
}
