export const DISCUSSION_MODE_KEYS = [
  "open_discussion",
  "debate",
  "research_question",
  "problem_solving",
] as const;

export type DiscussionMode = (typeof DISCUSSION_MODE_KEYS)[number];
export type DiscussionMetadata = Record<string, string>;

export type DiscussionModeFieldDefinition = {
  key: string;
  label: string;
  placeholder: string;
  required: boolean;
  multiline?: boolean;
  maxLength: number;
};

export type DiscussionModeDefinition = {
  key: DiscussionMode;
  label: string;
  shortLabel: string;
  description: string;
  bodyPlaceholder: string;
  fields: DiscussionModeFieldDefinition[];
};

const STRUCTURED_FIELD_MAX_LENGTH = 2000;
const COMMON_METADATA_LIMITS: Record<string, number> = {
  purpose: 600,
  framing: 100,
  realityLens: 120,
  purposeLane: 120,
};

export const DISCUSSION_MODE_DEFINITIONS: Record<
  DiscussionMode,
  DiscussionModeDefinition
> = {
  open_discussion: {
    key: "open_discussion",
    label: "Open Discussion",
    shortLabel: "Open",
    description: "A focused question, update, or idea for thoughtful replies.",
    bodyPlaceholder:
      "Share the context and explain what you want Room members to discuss.",
    fields: [],
  },
  debate: {
    key: "debate",
    label: "Debate",
    shortLabel: "Debate",
    description: "Frame a claim so members can compare reasoning and evidence.",
    bodyPlaceholder:
      "Explain the context, stakes, and what a productive debate should clarify.",
    fields: [
      {
        key: "claim",
        label: "Central claim",
        placeholder: "State the claim being examined",
        required: true,
        maxLength: STRUCTURED_FIELD_MAX_LENGTH,
      },
      {
        key: "supportingArgument",
        label: "Supporting argument",
        placeholder: "Summarize the strongest supporting reasoning",
        required: false,
        multiline: true,
        maxLength: STRUCTURED_FIELD_MAX_LENGTH,
      },
      {
        key: "evidence",
        label: "Evidence or source context",
        placeholder: "Add evidence, references, or facts members should consider",
        required: false,
        multiline: true,
        maxLength: STRUCTURED_FIELD_MAX_LENGTH,
      },
      {
        key: "opposingQuestion",
        label: "Question for opposing views",
        placeholder: "What should members who disagree address?",
        required: false,
        multiline: true,
        maxLength: STRUCTURED_FIELD_MAX_LENGTH,
      },
    ],
  },
  research_question: {
    key: "research_question",
    label: "Research Question",
    shortLabel: "Research",
    description: "Explore a question with context, evidence, and uncertainty.",
    bodyPlaceholder:
      "Explain why this question matters and what a useful research response should contribute.",
    fields: [
      {
        key: "researchQuestion",
        label: "Research question",
        placeholder: "State the question precisely",
        required: true,
        maxLength: STRUCTURED_FIELD_MAX_LENGTH,
      },
      {
        key: "background",
        label: "Background",
        placeholder: "Summarize what is already known",
        required: false,
        multiline: true,
        maxLength: STRUCTURED_FIELD_MAX_LENGTH,
      },
      {
        key: "sources",
        label: "Sources or evidence",
        placeholder: "List relevant sources or evidence",
        required: false,
        multiline: true,
        maxLength: STRUCTURED_FIELD_MAX_LENGTH,
      },
      {
        key: "openQuestions",
        label: "Unresolved questions",
        placeholder: "What remains uncertain or disputed?",
        required: false,
        multiline: true,
        maxLength: STRUCTURED_FIELD_MAX_LENGTH,
      },
    ],
  },
  problem_solving: {
    key: "problem_solving",
    label: "Problem Solving",
    shortLabel: "Problem",
    description: "Define a practical problem and invite realistic solutions.",
    bodyPlaceholder:
      "Explain the situation, why it matters, and what Room members should help solve.",
    fields: [
      {
        key: "problem",
        label: "Problem",
        placeholder: "Define the problem clearly",
        required: true,
        multiline: true,
        maxLength: STRUCTURED_FIELD_MAX_LENGTH,
      },
      {
        key: "tried",
        label: "What has been tried",
        placeholder: "Describe attempted solutions",
        required: false,
        multiline: true,
        maxLength: STRUCTURED_FIELD_MAX_LENGTH,
      },
      {
        key: "constraints",
        label: "Constraints",
        placeholder: "List limits, requirements, or tradeoffs",
        required: false,
        multiline: true,
        maxLength: STRUCTURED_FIELD_MAX_LENGTH,
      },
      {
        key: "desiredOutcome",
        label: "Desired outcome",
        placeholder: "Describe the result or decision needed",
        required: false,
        multiline: true,
        maxLength: STRUCTURED_FIELD_MAX_LENGTH,
      },
    ],
  },
};

export function isDiscussionMode(value: unknown): value is DiscussionMode {
  return (
    typeof value === "string" &&
    (DISCUSSION_MODE_KEYS as readonly string[]).includes(value)
  );
}

export function getDiscussionModeDefinition(value: unknown) {
  const mode = isDiscussionMode(value) ? value : "open_discussion";
  return DISCUSSION_MODE_DEFINITIONS[mode];
}

export type DiscussionModeParseResult =
  | {
      ok: true;
      mode: DiscussionMode;
      metadata: DiscussionMetadata;
    }
  | {
      ok: false;
      error: string;
      code: string;
    };

export function parseDiscussionModeInput(
  input: {
    discussionType?: unknown;
    discussionMetadata?: unknown;
  },
  options: { requireStructuredFields?: boolean } = {}
): DiscussionModeParseResult {
  const requestedMode =
    typeof input.discussionType === "string"
      ? input.discussionType.trim()
      : "open_discussion";

  if (!isDiscussionMode(requestedMode)) {
    return {
      ok: false,
      error: "Choose a valid discussion mode.",
      code: "discussion_mode_invalid",
    };
  }

  const rawMetadata =
    input.discussionMetadata &&
    typeof input.discussionMetadata === "object" &&
    !Array.isArray(input.discussionMetadata)
      ? (input.discussionMetadata as Record<string, unknown>)
      : {};
  const definition = DISCUSSION_MODE_DEFINITIONS[requestedMode];
  const modeLimits = Object.fromEntries(
    definition.fields.map((field) => [field.key, field.maxLength])
  ) as Record<string, number>;
  const allowedLimits = { ...COMMON_METADATA_LIMITS, ...modeLimits };
  const metadata: DiscussionMetadata = {};

  for (const [key, rawValue] of Object.entries(rawMetadata)) {
    if (!Object.prototype.hasOwnProperty.call(allowedLimits, key)) {
      const hasValue =
        rawValue !== null &&
        rawValue !== undefined &&
        String(rawValue).trim().length > 0;
      if (hasValue) {
        return {
          ok: false,
          error: `Unsupported discussion metadata field: ${key}.`,
          code: "discussion_metadata_field_invalid",
        };
      }
      continue;
    }

    if (
      rawValue !== null &&
      rawValue !== undefined &&
      typeof rawValue === "object"
    ) {
      return {
        ok: false,
        error: `Discussion metadata field ${key} must be text.`,
        code: "discussion_metadata_value_invalid",
      };
    }

    const value = String(rawValue ?? "").trim();
    if (!value) continue;
    const maxLength = allowedLimits[key];
    if (value.length > maxLength) {
      return {
        ok: false,
        error: `${
          definition.fields.find((field) => field.key === key)?.label ?? key
        } is too long.`,
        code: "discussion_metadata_value_too_long",
      };
    }
    metadata[key] = value;
  }

  if (options.requireStructuredFields) {
    const missing = definition.fields.find(
      (field) => field.required && !metadata[field.key]
    );
    if (missing) {
      return {
        ok: false,
        error: `${missing.label} is required for ${definition.label}.`,
        code: "discussion_metadata_required",
      };
    }
  }

  const totalLength = Object.values(metadata).reduce(
    (total, value) => total + value.length,
    0
  );
  if (totalLength > 7000) {
    return {
      ok: false,
      error: "Structured discussion details are too long.",
      code: "discussion_metadata_too_long",
    };
  }

  return { ok: true, mode: requestedMode, metadata };
}
