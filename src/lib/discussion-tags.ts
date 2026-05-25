export const MAX_DISCUSSION_TAGS = 5;

const DISCUSSION_TAG_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 &+.#'-]{0,38}[A-Za-z0-9]$/;

export type DiscussionTagParseResult = {
  tags: string[];
  error: string | null;
};

function normalizeSingleTag(value: string) {
  return value
    .trim()
    .replace(/^#+/, "")
    .replace(/\s+/g, " ");
}

export function normalizeDiscussionTags(input: unknown): DiscussionTagParseResult {
  const rawTags = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(",")
      : [];

  const normalizedTags: string[] = [];
  const seen = new Set<string>();

  for (const rawTag of rawTags) {
    if (typeof rawTag !== "string") {
      return {
        tags: [],
        error: "Discussion tags must be text.",
      };
    }

    const tag = normalizeSingleTag(rawTag);

    if (!tag) {
      continue;
    }

    if (tag.length < 2 || tag.length > 40) {
      return {
        tags: [],
        error: "Each discussion tag must be between 2 and 40 characters.",
      };
    }

    if (!DISCUSSION_TAG_PATTERN.test(tag)) {
      return {
        tags: [],
        error: "Discussion tags can use letters, numbers, spaces, &, +, ., #, apostrophes, and hyphens.",
      };
    }

    const key = tag.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalizedTags.push(tag);

    if (normalizedTags.length > MAX_DISCUSSION_TAGS) {
      return {
        tags: [],
        error: `Use ${MAX_DISCUSSION_TAGS} discussion tags or fewer.`,
      };
    }
  }

  return {
    tags: normalizedTags,
    error: null,
  };
}
