export const LIBRARY_ORIGINALS_BUCKET = "library-publication-originals";
export const LIBRARY_CONTENT_MANIFEST_VERSION = 1;

export type LibraryStorageProvider = "supabase" | "r2";
export type LibraryIngestionStatus = "pending" | "processing" | "ready" | "failed";

export type LibraryPublicationSource = {
  id: string;
  publicationId: string;
  storageProvider: LibraryStorageProvider;
  storageBucket: string;
  storagePath: string;
  mediaType: "application/epub+zip";
  byteSize: number;
  sha256: string;
  ingestionStatus: LibraryIngestionStatus;
  manifestVersion: number;
};

export type LibraryNormalizedSection = {
  publicationId: string;
  sourceId: string;
  sectionKey: string;
  ordinal: number;
  title: string | null;
  contentHtml: string;
  contentText: string;
  contentSha256: string;
};

export type LibraryReaderLocator = {
  version: 1;
  sectionKey: string;
  textOffset?: number;
};

export function encodeLibraryReaderLocator(locator: LibraryReaderLocator): string {
  return JSON.stringify(locator);
}

export function decodeLibraryReaderLocator(value: string | null): LibraryReaderLocator | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<LibraryReaderLocator>;
    if (parsed.version !== 1 || typeof parsed.sectionKey !== "string" || !parsed.sectionKey) return null;
    if (parsed.textOffset !== undefined && (!Number.isInteger(parsed.textOffset) || parsed.textOffset < 0)) return null;
    return { version: 1, sectionKey: parsed.sectionKey, ...(parsed.textOffset === undefined ? {} : { textOffset: parsed.textOffset }) };
  } catch {
    return null;
  }
}

export function buildLibraryOriginalPath(publicationId: string, sourceId: string): string {
  return `${publicationId}/${sourceId}/original.epub`;
}
