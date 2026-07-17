import "server-only";

import { asString } from "@/lib/room-operations";

export type MarketplaceInput = Record<string, unknown>;

export class MarketplaceError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 500, code = "marketplace_error") {
    super(message);
    this.name = "MarketplaceError";
    this.status = status;
    this.code = code;
  }
}

export function cleanMarketplaceText(value: unknown, max = 500) {
  return asString(value).replace(/\s+/g, " ").trim().slice(0, max);
}

export function cleanLongText(value: unknown, max = 16000) {
  return asString(value).replace(/\r\n/g, "\n").trim().slice(0, max);
}

export function cleanUuid(value: unknown, label = "id") {
  const id = cleanMarketplaceText(value, 60);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id
    )
  ) {
    throw new MarketplaceError(`Invalid ${label}.`, 400, "invalid_id");
  }
  return id;
}

export function cleanOptionalUuid(value: unknown, label = "id") {
  const id = cleanMarketplaceText(value, 60);
  return id ? cleanUuid(id, label) : null;
}

export function cleanDate(value: unknown, label: string) {
  const date = cleanMarketplaceText(value, 10);
  if (!date) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new MarketplaceError(`Enter a valid ${label}.`, 400, "invalid_date");
  }
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  ) {
    throw new MarketplaceError(`Enter a valid ${label}.`, 400, "invalid_date");
  }
  return date;
}

export function cleanExpiry(value: unknown) {
  const date = cleanDate(value, "expiration date");
  return date ? `${date}T23:59:59.999Z` : null;
}

export function cleanStringArray(value: unknown, maxLength: number) {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .map((item) => cleanMarketplaceText(item, maxLength))
        .filter(Boolean)
    ),
  ];
}

export function cleanAttributes(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const attributes: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(value)) {
    const key = cleanMarketplaceText(rawKey, 80);
    const item = cleanMarketplaceText(rawValue, 300);
    if (key && item) attributes[key] = item;
  }
  return attributes;
}

function cleanHttpsUrl(value: unknown, label: string) {
  const url = cleanMarketplaceText(value, 2048);
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") throw new Error("protocol");
    return parsed.toString();
  } catch {
    throw new MarketplaceError(
      `Use a complete HTTPS ${label}.`,
      400,
      "invalid_url"
    );
  }
}

export function cleanPhotos(input: MarketplaceInput, userId: string) {
  const urls = cleanStringArray(input.photoUrls, 2048).map((url) =>
    cleanHttpsUrl(url, "photo address")
  );
  const paths = cleanStringArray(input.photoPaths, 500);
  if (urls.length !== paths.length) {
    throw new MarketplaceError(
      "Marketplace photo data is incomplete.",
      400,
      "invalid_photo_data"
    );
  }
  const publicMarker = "/storage/v1/object/public/marketplace-images/";
  for (let index = 0; index < paths.length; index += 1) {
    const path = paths[index];
    if (!path.startsWith(`${userId}/`)) {
      throw new MarketplaceError(
        "A marketplace photo does not belong to this seller.",
        403,
        "photo_forbidden"
      );
    }

    const parsedUrl = new URL(urls[index]);
    const markerIndex = parsedUrl.pathname.indexOf(publicMarker);
    const publicPath =
      markerIndex >= 0
        ? decodeURIComponent(
            parsedUrl.pathname.slice(markerIndex + publicMarker.length)
          )
        : "";
    if (publicPath !== path) {
      throw new MarketplaceError(
        "Marketplace photos must come from the protected listing uploader.",
        400,
        "invalid_photo_source"
      );
    }
  }
  return { urls, paths };
}

const PROHIBITED_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  {
    pattern:
      /\b(gun|firearm|rifle|shotgun|pistol|revolver|ammunition|ammo|silencer|suppressor|switchblade|tactical knife|taser|brass knuckles|pepper spray|mace weapon)\b/i,
    label: "weapons, restricted self-defense items, or ammunition",
  },
  {
    pattern: /\b(explosive|dynamite|grenade|firework|detonator)\b/i,
    label: "explosives",
  },
  {
    pattern:
      /\b(cocaine|heroin|fentanyl|methamphetamine|marijuana|cannabis|thc|psychedelic|magic mushrooms)\b/i,
    label: "illegal or recreational drugs",
  },
  {
    pattern:
      /\b(beer|wine|liquor|vodka|whiskey|whisky|rum|tequila|champagne|alcohol)\b/i,
    label: "alcohol",
  },
  {
    pattern:
      /\b(cigarette|cigar|vape|vaping|nicotine|tobacco|hookah)\b/i,
    label: "nicotine or tobacco products",
  },
  {
    pattern:
      /\b(prescription drug|prescription medication|controlled substance|oxycodone|adderall|xanax)\b/i,
    label: "prescription or controlled medication",
  },
  {
    pattern:
      /\b(counterfeit|replica designer|fake designer|stolen goods|stolen item)\b/i,
    label: "counterfeit or stolen goods",
  },
  {
    pattern:
      /\b(sex toy|vibrator|dildo|pornography|pornographic|adult toy|bdsm)\b/i,
    label: "adult products",
  },
  {
    pattern:
      /\b(arsenic|cyanide|mercury compound|radioactive material|hazardous chemical|poison)\b/i,
    label: "hazardous materials",
  },
  {
    pattern:
      /\b(ivory|endangered species parts|wildlife contraband|stolen wildlife)\b/i,
    label: "wildlife or environmental contraband",
  },
  {
    pattern:
      /\b(lottery ticket|casino gambling device|slot machine for gambling)\b/i,
    label: "regulated gambling items",
  },
];

export function enforceMarketplacePolicy(parts: unknown[]) {
  const text = parts
    .map((part) =>
      typeof part === "string"
        ? part
        : Array.isArray(part)
          ? part.join(" ")
          : part && typeof part === "object"
            ? Object.entries(part as Record<string, unknown>)
                .flat()
                .join(" ")
            : ""
    )
    .join(" ")
    .replace(
      /\b(wine rack|wine glass|wine opener|beer glass|liquor cabinet|cigar box|gun safe|gun cabinet|shotgun microphone)\b/gi,
      ""
    );

  for (const rule of PROHIBITED_PATTERNS) {
    if (rule.pattern.test(text)) {
      throw new MarketplaceError(
        `Loombus Marketplace does not allow ${rule.label}.`,
        400,
        "prohibited_marketplace_item"
      );
    }
  }
}

export function cleanMoney(value: unknown) {
  const amount = typeof value === "number" ? value : Number(String(value ?? ""));
  if (!Number.isFinite(amount) || amount < 0 || amount > 999999999.99) {
    throw new MarketplaceError(
      "Enter a valid listing price.",
      400,
      "invalid_price"
    );
  }
  return Math.round(amount * 100) / 100;
}

export function slugifyMarketplace(value: string) {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "listing"
  );
}

export function nestedRow(row: Record<string, unknown>, key: string) {
  const raw = row[key];
  if (Array.isArray(raw)) return (raw[0] ?? {}) as Record<string, unknown>;
  return (raw ?? {}) as Record<string, unknown>;
}

export function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
