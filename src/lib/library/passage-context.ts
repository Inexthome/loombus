export const LIBRARY_PASSAGE_CONTEXT_KEYS = {
  discuss: "loombus:library:discuss-passage:v1",
  ask: "loombus:library:ask-loombus:v1",
  research: "loombus:library:research-passage:v1",
} as const;

export type LibraryPassageDestination = keyof typeof LIBRARY_PASSAGE_CONTEXT_KEYS;

export type LibraryPassageContext = {
  publicationId: string;
  publicationTitle: string;
  authorName: string | null;
  locator: string;
  sectionTitle: string | null;
  selectedText: string;
  startOffset: number;
  endOffset: number;
  textSha256: string;
  capturedAt: string;
};

export function isLibraryPassageContext(value: unknown): value is LibraryPassageContext {
  if (!value || typeof value !== "object") return false;
  const passage = value as Partial<LibraryPassageContext>;
  return (
    typeof passage.publicationId === "string" &&
    typeof passage.publicationTitle === "string" &&
    (typeof passage.authorName === "string" || passage.authorName === null || passage.authorName === undefined) &&
    typeof passage.locator === "string" &&
    (typeof passage.sectionTitle === "string" || passage.sectionTitle === null || passage.sectionTitle === undefined) &&
    typeof passage.selectedText === "string" &&
    typeof passage.startOffset === "number" &&
    Number.isInteger(passage.startOffset) &&
    passage.startOffset >= 0 &&
    typeof passage.endOffset === "number" &&
    Number.isInteger(passage.endOffset) &&
    passage.endOffset > passage.startOffset &&
    typeof passage.textSha256 === "string" &&
    passage.textSha256.length === 64 &&
    typeof passage.capturedAt === "string"
  );
}

export function writeLibraryPassageContext(destination: LibraryPassageDestination, passage: LibraryPassageContext) {
  window.sessionStorage.setItem(LIBRARY_PASSAGE_CONTEXT_KEYS[destination], JSON.stringify(passage));
}

export function readLibraryPassageContext(destination: LibraryPassageDestination): LibraryPassageContext | null {
  try {
    const raw = window.sessionStorage.getItem(LIBRARY_PASSAGE_CONTEXT_KEYS[destination]);
    if (!raw) return null;
    const value = JSON.parse(raw) as unknown;
    return isLibraryPassageContext(value) ? value : null;
  } catch {
    return null;
  }
}

export function clearLibraryPassageContext(destination: LibraryPassageDestination) {
  window.sessionStorage.removeItem(LIBRARY_PASSAGE_CONTEXT_KEYS[destination]);
}

export function libraryReaderHref(publicationId: string) {
  return `/library/read/${encodeURIComponent(publicationId)}?open=1`;
}

export function libraryPassageIdentity(
  passage: Pick<LibraryPassageContext, "publicationId" | "locator" | "startOffset" | "endOffset" | "textSha256">
) {
  return `${passage.publicationId}:${passage.locator}:${passage.startOffset}:${passage.endOffset}:${passage.textSha256}`;
}
