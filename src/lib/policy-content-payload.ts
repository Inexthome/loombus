export const POLICY_PAYLOAD_SCHEMA_VERSION = "policy_payload.v1" as const;

export type PolicyPayloadTextInline = {
  type: "text";
  text: string;
};

export type PolicyPayloadLinkInline = {
  type: "link";
  text: string;
  href: string;
};

export type PolicyPayloadInline =
  | PolicyPayloadTextInline
  | PolicyPayloadLinkInline;

export type PolicyPayloadParagraphBlock = {
  type: "paragraph";
  content: readonly PolicyPayloadInline[];
};

export type PolicyPayloadBulletListBlock = {
  type: "bullet_list";
  items: readonly string[];
};

export type PolicyPayloadBlock =
  | PolicyPayloadParagraphBlock
  | PolicyPayloadBulletListBlock;

export type PolicyPayloadSection = {
  id: string;
  title: string;
  blocks: readonly PolicyPayloadBlock[];
};

export type PolicyPayloadPageMetadata = {
  title: string;
  description: string;
  canonical: string;
};

export type StructuredPolicyPayload = {
  schemaVersion: typeof POLICY_PAYLOAD_SCHEMA_VERSION;
  documentId: string;
  version: string;
  canonicalRoute: string;
  legacySourcePath: string;
  sourceRevision: string;
  pageMetadata: PolicyPayloadPageMetadata;
  eyebrow: string;
  title: string;
  description: string;
  effectiveDate: string | null;
  reviewedDate: string | null;
  sections: readonly PolicyPayloadSection[];
};

export type PolicyPayloadValidationResult =
  | { ok: true; payload: StructuredPolicyPayload; errors: readonly [] }
  | { ok: false; payload: null; errors: readonly string[] };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isSafePolicyPayloadHref(href: string): boolean {
  if (!href || /[\r\n\0]/.test(href)) return false;

  if (href.startsWith("/")) {
    return !href.startsWith("//") && !href.startsWith("/\\");
  }

  if (href.startsWith("mailto:")) {
    return !/[<>]/.test(href);
  }

  if (href.startsWith("https://")) {
    try {
      const url = new URL(href);
      return url.protocol === "https:";
    } catch {
      return false;
    }
  }

  return false;
}

export function validateStructuredPolicyPayload(
  value: unknown,
): PolicyPayloadValidationResult {
  const errors: string[] = [];

  if (!isObject(value)) {
    return { ok: false, payload: null, errors: ["payload must be an object"] };
  }

  const requiredStrings = [
    "documentId",
    "version",
    "canonicalRoute",
    "legacySourcePath",
    "sourceRevision",
    "eyebrow",
    "title",
    "description",
  ] as const;

  if (value.schemaVersion !== POLICY_PAYLOAD_SCHEMA_VERSION) {
    errors.push(
      `schemaVersion must be ${POLICY_PAYLOAD_SCHEMA_VERSION}`,
    );
  }

  for (const key of requiredStrings) {
    if (!nonEmptyString(value[key])) {
      errors.push(`${key} must be a non-empty string`);
    }
  }

  if (
    value.effectiveDate !== null &&
    value.effectiveDate !== undefined &&
    !nonEmptyString(value.effectiveDate)
  ) {
    errors.push("effectiveDate must be null or a non-empty string");
  }

  if (
    value.reviewedDate !== null &&
    value.reviewedDate !== undefined &&
    !nonEmptyString(value.reviewedDate)
  ) {
    errors.push("reviewedDate must be null or a non-empty string");
  }

  if (!isObject(value.pageMetadata)) {
    errors.push("pageMetadata must be an object");
  } else {
    if (!nonEmptyString(value.pageMetadata.title)) {
      errors.push("pageMetadata.title must be a non-empty string");
    }
    if (!nonEmptyString(value.pageMetadata.description)) {
      errors.push("pageMetadata.description must be a non-empty string");
    }
    if (!nonEmptyString(value.pageMetadata.canonical)) {
      errors.push("pageMetadata.canonical must be a non-empty string");
    } else {
      try {
        const canonical = new URL(value.pageMetadata.canonical);
        if (canonical.protocol !== "https:") {
          errors.push("pageMetadata.canonical must use https");
        }
      } catch {
        errors.push("pageMetadata.canonical must be a valid URL");
      }
    }
  }

  if (!Array.isArray(value.sections) || value.sections.length === 0) {
    errors.push("sections must be a non-empty array");
  } else {
    const sectionIds = new Set<string>();

    for (const [sectionIndex, section] of value.sections.entries()) {
      const context = `sections[${sectionIndex}]`;
      if (!isObject(section)) {
        errors.push(`${context} must be an object`);
        continue;
      }

      if (!nonEmptyString(section.id)) {
        errors.push(`${context}.id must be a non-empty string`);
      } else if (sectionIds.has(section.id)) {
        errors.push(`${context}.id duplicates ${section.id}`);
      } else {
        sectionIds.add(section.id);
      }

      if (!nonEmptyString(section.title)) {
        errors.push(`${context}.title must be a non-empty string`);
      }

      if (!Array.isArray(section.blocks) || section.blocks.length === 0) {
        errors.push(`${context}.blocks must be a non-empty array`);
        continue;
      }

      for (const [blockIndex, block] of section.blocks.entries()) {
        const blockContext = `${context}.blocks[${blockIndex}]`;
        if (!isObject(block)) {
          errors.push(`${blockContext} must be an object`);
          continue;
        }

        if (block.type === "paragraph") {
          if (!Array.isArray(block.content) || block.content.length === 0) {
            errors.push(`${blockContext}.content must be a non-empty array`);
            continue;
          }

          for (const [inlineIndex, inline] of block.content.entries()) {
            const inlineContext = `${blockContext}.content[${inlineIndex}]`;
            if (!isObject(inline)) {
              errors.push(`${inlineContext} must be an object`);
              continue;
            }

            if (inline.type === "text") {
              if (typeof inline.text !== "string") {
                errors.push(`${inlineContext}.text must be a string`);
              }
              continue;
            }

            if (inline.type === "link") {
              if (!nonEmptyString(inline.text)) {
                errors.push(`${inlineContext}.text must be a non-empty string`);
              }
              if (!nonEmptyString(inline.href)) {
                errors.push(`${inlineContext}.href must be a non-empty string`);
              } else if (!isSafePolicyPayloadHref(inline.href)) {
                errors.push(`${inlineContext}.href uses a disallowed scheme or form`);
              }
              continue;
            }

            errors.push(`${inlineContext}.type is unsupported`);
          }
          continue;
        }

        if (block.type === "bullet_list") {
          if (!Array.isArray(block.items) || block.items.length === 0) {
            errors.push(`${blockContext}.items must be a non-empty array`);
            continue;
          }

          for (const [itemIndex, item] of block.items.entries()) {
            if (!nonEmptyString(item)) {
              errors.push(
                `${blockContext}.items[${itemIndex}] must be a non-empty string`,
              );
            }
          }
          continue;
        }

        errors.push(`${blockContext}.type is unsupported`);
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, payload: null, errors };
  }

  return {
    ok: true,
    payload: value as unknown as StructuredPolicyPayload,
    errors: [],
  };
}
