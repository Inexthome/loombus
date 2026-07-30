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

export type FloorStance = (typeof FLOOR_STANCE_OPTIONS)[number]["value"];
export type FloorHorizon = (typeof FLOOR_HORIZON_OPTIONS)[number]["value"];

export const FLOOR_TICKER_MAX = 16;
export const FLOOR_EXIT_PLAN_MAX = 1000;
export const FLOOR_THESIS_MAX = 4000;
export const FLOOR_CATALYSTS_MAX = 1000;
export const FLOOR_RISKS_MAX = 800;

export function isFloorStance(value: unknown): value is FloorStance {
  return typeof value === "string" && FLOOR_STANCE_OPTIONS.some((option) => option.value === value);
}

export function isFloorHorizon(value: unknown): value is FloorHorizon {
  return typeof value === "string" && FLOOR_HORIZON_OPTIONS.some((option) => option.value === value);
}

export function floorStanceLabel(value: string) {
  return FLOOR_STANCE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function floorHorizonLabel(value: string) {
  return FLOOR_HORIZON_OPTIONS.find((option) => option.value === value)?.label ?? value;
}
