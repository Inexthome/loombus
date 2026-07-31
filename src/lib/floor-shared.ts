export const FLOOR_STANCE_OPTIONS = [
  { value: "long", label: "Long" },
  { value: "short", label: "Short" },
  { value: "neutral", label: "Neutral" },
] as const;

export const FLOOR_HORIZON_OPTIONS = [
  { value: "days", label: "Days" },
  { value: "weeks", label: "Weeks" },
  { value: "months", label: "Months" },
  { value: "quarters", label: "Quarters" },
  { value: "years", label: "Years" },
] as const;

export const FLOOR_COMPARATOR_OPTIONS = [
  { value: "gte", label: "At or above" },
  { value: "lte", label: "At or below" },
  { value: "eq", label: "Equal to" },
  { value: "range", label: "Between" },
] as const;

export type FloorStance = (typeof FLOOR_STANCE_OPTIONS)[number]["value"];
export type FloorHorizon = (typeof FLOOR_HORIZON_OPTIONS)[number]["value"];
export type FloorComparator = (typeof FLOOR_COMPARATOR_OPTIONS)[number]["value"];

export const FLOOR_TICKER_MAX = 16;
export const FLOOR_EXIT_PLAN_MAX = 1000;
export const FLOOR_THESIS_MAX = 4000;
export const FLOOR_CATALYSTS_MAX = 1000;
export const FLOOR_RISKS_MAX = 800;
export const FLOOR_PREDICTION_MAX = 500;
export const FLOOR_POST_TITLE_MAX = 160;
export const FLOOR_POST_BODY_MAX = 5000;
export const FLOOR_REPLY_BODY_MAX = 3000;

export function isFloorStance(value: unknown): value is FloorStance {
  return typeof value === "string" && FLOOR_STANCE_OPTIONS.some((option) => option.value === value);
}

export function isFloorHorizon(value: unknown): value is FloorHorizon {
  return typeof value === "string" && FLOOR_HORIZON_OPTIONS.some((option) => option.value === value);
}

export function isFloorComparator(value: unknown): value is FloorComparator {
  return typeof value === "string" && FLOOR_COMPARATOR_OPTIONS.some((option) => option.value === value);
}

export function floorStanceLabel(value: string) {
  return FLOOR_STANCE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function floorHorizonLabel(value: string) {
  return FLOOR_HORIZON_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function floorComparatorLabel(value: string) {
  return FLOOR_COMPARATOR_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function formatFloorCallTarget(
  comparator: string,
  targetValue: number | null,
  targetValueHigh: number | null
) {
  if (comparator === "range" && targetValue !== null && targetValueHigh !== null) {
    return `between ${targetValue} and ${targetValueHigh}`;
  }
  if (targetValue === null) return "";
  return `${floorComparatorLabel(comparator).toLowerCase()} ${targetValue}`;
}

export function floorDisplayName(
  fullName: string | null | undefined,
  username: string | null | undefined,
  fallback = "A Loombus member"
) {
  return fullName || username || fallback;
}

function formatFloorCallResolvesByLabel(resolvesByIso: string) {
  const date = new Date(resolvesByIso);
  if (Number.isNaN(date.getTime())) return null;
  // Pinned locale AND timeZone so the stored sentence is identical regardless
  // of the client's or server's runtime locale/timezone -- it's the source of
  // truth, not just a display string. resolves_by is stored as UTC midnight
  // for a date-only pick (per the date-only parsing rule), so formatting in
  // anything other than UTC silently shows the wrong calendar day to anyone
  // west of it -- the same "sentence disagrees with the claim" bug this fix
  // exists to prevent.
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * The prediction sentence is derived from the structured claim, never typed
 * freehand -- this is what keeps the human-readable text and the fields the
 * resolver actually scores from ever disagreeing. Both the composer's live
 * preview and the API route that inserts the row call this same function.
 */
export function formatFloorCallPrediction(
  ticker: string,
  comparator: string,
  targetValue: number | null,
  targetValueHigh: number | null,
  resolvesByIso: string | null
) {
  const target = formatFloorCallTarget(comparator, targetValue, targetValueHigh);
  if (!ticker.trim() || !target) return "";

  const dateLabel = resolvesByIso ? formatFloorCallResolvesByLabel(resolvesByIso) : null;
  return dateLabel
    ? `${ticker} closes ${target} by ${dateLabel}.`
    : `${ticker} closes ${target}.`;
}
