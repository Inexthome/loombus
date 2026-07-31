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
