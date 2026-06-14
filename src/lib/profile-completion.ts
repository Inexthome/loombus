import { validatePublicProfileName } from "@/lib/profile-name-quality";

export type PublicProfileCompletionCode =
  | "public_name_incomplete"
  | "username_required"
  | "username_too_short"
  | "username_invalid"
  | "username_reserved"
  | "username_numeric"
  | "bio_required"
  | "bio_too_short"
  | "bio_placeholder";

export type PublicProfileCompletionResult =
  | {
      ok: true;
      normalizedName: string;
      normalizedUsername: string;
      normalizedBio: string;
    }
  | {
      ok: false;
      code: PublicProfileCompletionCode;
      message: string;
      normalizedName: string;
      normalizedUsername: string;
      normalizedBio: string;
    };

const RESERVED_USERNAMES = new Set([
  "admin",
  "administrator",
  "anonymous",
  "help",
  "loombus",
  "moderator",
  "official",
  "staff",
  "support",
  "test",
  "unknown",
  "user",
]);

const PLACEHOLDER_BIOS = new Set([
  "...",
  "-",
  "--",
  ".",
  "bio",
  "hello",
  "hi",
  "n/a",
  "na",
  "none",
  "test",
  "testing",
]);

function cleanText(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanUsername(value: string | null | undefined) {
  return cleanText(value).replace(/^@+/, "").toLowerCase();
}

function hasEnoughMeaningfulBioContent(value: string) {
  const lettersAndNumbers = value.replace(/[^\p{L}\p{N}]/gu, "");
  const words = value.split(/\s+/).filter(Boolean);

  return lettersAndNumbers.length >= 12 && words.length >= 3;
}

export function validatePublicProfileCompletion({
  fullName,
  username,
  bio,
}: {
  fullName: string | null | undefined;
  username: string | null | undefined;
  bio: string | null | undefined;
}): PublicProfileCompletionResult {
  const nameResult = validatePublicProfileName(fullName);
  const normalizedName = nameResult.normalizedName;
  const normalizedUsername = cleanUsername(username);
  const normalizedBio = cleanText(bio).slice(0, 1000);

  if (!nameResult.ok) {
    return {
      ok: false,
      code: "public_name_incomplete",
      message: nameResult.message,
      normalizedName,
      normalizedUsername,
      normalizedBio,
    };
  }

  if (!normalizedUsername) {
    return {
      ok: false,
      code: "username_required",
      message: "Choose a public username before participating on Loombus.",
      normalizedName,
      normalizedUsername,
      normalizedBio,
    };
  }

  if (normalizedUsername.length < 3) {
    return {
      ok: false,
      code: "username_too_short",
      message: "Username must be at least 3 characters.",
      normalizedName,
      normalizedUsername,
      normalizedBio,
    };
  }

  if (!/^[a-z0-9_]{3,30}$/.test(normalizedUsername)) {
    return {
      ok: false,
      code: "username_invalid",
      message: "Username must be 3-30 characters and can only use letters, numbers, and underscores.",
      normalizedName,
      normalizedUsername,
      normalizedBio,
    };
  }

  if (/^\d+$/.test(normalizedUsername)) {
    return {
      ok: false,
      code: "username_numeric",
      message: "Username must include letters, not only numbers.",
      normalizedName,
      normalizedUsername,
      normalizedBio,
    };
  }

  if (RESERVED_USERNAMES.has(normalizedUsername)) {
    return {
      ok: false,
      code: "username_reserved",
      message: "Choose a username that does not impersonate Loombus or platform staff.",
      normalizedName,
      normalizedUsername,
      normalizedBio,
    };
  }

  if (/^user_[a-f0-9]{16,}$/.test(normalizedUsername)) {
    return {
      ok: false,
      code: "username_reserved",
      message: "Choose a public username instead of the temporary system username.",
      normalizedName,
      normalizedUsername,
      normalizedBio,
    };
  }

  const lowerBio = normalizedBio.toLowerCase();

  if (!normalizedBio) {
    return {
      ok: false,
      code: "bio_required",
      message: "Add a short bio before participating on Loombus.",
      normalizedName,
      normalizedUsername,
      normalizedBio,
    };
  }

  if (normalizedBio.length < 20 || !hasEnoughMeaningfulBioContent(normalizedBio)) {
    return {
      ok: false,
      code: "bio_too_short",
      message: "Bio must be at least 20 characters and explain your perspective in a few words.",
      normalizedName,
      normalizedUsername,
      normalizedBio,
    };
  }

  if (PLACEHOLDER_BIOS.has(lowerBio)) {
    return {
      ok: false,
      code: "bio_placeholder",
      message: "Bio cannot be filler text. Add a real sentence about your perspective or interests.",
      normalizedName,
      normalizedUsername,
      normalizedBio,
    };
  }

  return {
    ok: true,
    normalizedName,
    normalizedUsername,
    normalizedBio,
  };
}
