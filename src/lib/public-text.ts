const HTML_ENTITY_MAP: Record<string, string> = {
  quot: '"',
  apos: "'",
  amp: "&",
  lt: "<",
  gt: ">",
  nbsp: " ",
};

function decodeHtmlEntitiesOnce(value: string) {
  return value.replace(/&(#\d+|#x[\da-fA-F]+|[a-zA-Z][a-zA-Z0-9]+);/g, (match, entity) => {
    const normalized = String(entity).toLowerCase();

    if (normalized.startsWith("#x")) {
      const codePoint = Number.parseInt(normalized.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }

    if (normalized.startsWith("#")) {
      const codePoint = Number.parseInt(normalized.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }

    return HTML_ENTITY_MAP[normalized] ?? match;
  });
}

export function normalizePublicText(value: string | null | undefined) {
  let text = String(value ?? "");

  for (let index = 0; index < 3; index += 1) {
    const decoded = decodeHtmlEntitiesOnce(text);

    if (decoded === text) {
      break;
    }

    text = decoded;
  }

  return text
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*\/\s*(p|div|li|h[1-6])\s*>/gi, "\n")
    .replace(/<\s*(p|div|li|h[1-6])(?:\s+[^>]*)?>/gi, "")
    .replace(/<\s*\/?\s*[a-z][^>]*>/gi, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
