export type ProfileNameQualityCode =
  | "profile_name_required"
  | "profile_name_too_short"
  | "profile_name_too_long"
  | "profile_name_not_human"
  | "profile_name_reserved"
  | "profile_name_handle_style"
  | "profile_name_repeated"
  | "profile_name_initials_only"
  | "profile_name_placeholder";

export type ProfileNameQualityResult =
  | {
      ok: true;
      normalizedName: string;
    }
  | {
      ok: false;
      code: ProfileNameQualityCode;
      message: string;
      normalizedName: string;
    };

const RESERVED_EXACT_NAMES = new Set([
  "admin",
  "administrator",
  "anonymous",
  "anonymous user",
  "loombus",
  "loombus admin",
  "loombus moderator",
  "loombus staff",
  "loombus support",
  "moderator",
  "staff",
  "support",
  "test",
  "test account",
  "unknown",
  "user",
]);

const RESERVED_PHRASES = [
  "customer support",
  "help desk",
  "official loombus",
  "team loombus",
];

const PLACEHOLDER_NAMES = new Set([
  "abc",
  "asdf",
  "demo",
  "mar",
  "name",
  "new user",
  "none",
  "sample",
  "testuser",
]);

function normalizePublicName(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function getNameLetters(value: string) {
  return [...value.matchAll(/[\p{L}]/gu)].map((match) => match[0]);
}

export function validatePublicProfileName(
  value: string | null | undefined
): ProfileNameQualityResult {
  const normalizedName = normalizePublicName(value);
  const lowerName = normalizedName.toLowerCase();
  const letters = getNameLetters(normalizedName);

  if (!normalizedName) {
    return {
      ok: false,
      code: "profile_name_required",
      message:
        "Add a recognizable public name before participating. This does not have to be your full legal name.",
      normalizedName,
    };
  }

  if (normalizedName.length < 4 || letters.length < 4) {
    return {
      ok: false,
      code: "profile_name_too_short",
      message: "Use a recognizable public name with at least 4 letters.",
      normalizedName,
    };
  }

  if (normalizedName.length > 80) {
    return {
      ok: false,
      code: "profile_name_too_long",
      message: "Use a shorter public name, 80 characters or fewer.",
      normalizedName,
    };
  }

  if (RESERVED_EXACT_NAMES.has(lowerName)) {
    return {
      ok: false,
      code: "profile_name_reserved",
      message: "Choose a public name that does not impersonate Loombus or platform staff.",
      normalizedName,
    };
  }

  if (PLACEHOLDER_NAMES.has(lowerName)) {
    return {
      ok: false,
      code: "profile_name_placeholder",
      message: "Use a real public name or recognizable contributor name, not placeholder text.",
      normalizedName,
    };
  }

  if (RESERVED_PHRASES.some((phrase) => lowerName.includes(phrase))) {
    return {
      ok: false,
      code: "profile_name_reserved",
      message: "Choose a public name that does not impersonate Loombus or support staff.",
      normalizedName,
    };
  }

  if (/^@/.test(normalizedName) || /^https?:\/\//i.test(normalizedName)) {
    return {
      ok: false,
      code: "profile_name_handle_style",
      message: "Use a public name, not a handle, link, or URL.",
      normalizedName,
    };
  }

  if (!/[\p{L}]/u.test(normalizedName)) {
    return {
      ok: false,
      code: "profile_name_not_human",
      message: "Use a recognizable public name with letters, not only numbers or symbols.",
      normalizedName,
    };
  }

  if (/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s\d_\-.]+$/u.test(normalizedName)) {
    return {
      ok: false,
      code: "profile_name_not_human",
      message: "Use a recognizable public name, not only symbols, numbers, or emoji.",
      normalizedName,
    };
  }

  if (/^([\p{L}]\.?\s*){1,3}$/u.test(normalizedName)) {
    return {
      ok: false,
      code: "profile_name_initials_only",
      message: "Use a recognizable public name, not only initials.",
      normalizedName,
    };
  }

  if (/(.)\1{5,}/i.test(normalizedName.replace(/\s/g, ""))) {
    return {
      ok: false,
      code: "profile_name_repeated",
      message: "Use a recognizable public name without repeated filler characters.",
      normalizedName,
    };
  }

  return {
    ok: true,
    normalizedName,
  };
}
