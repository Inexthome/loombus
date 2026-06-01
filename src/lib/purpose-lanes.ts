export const PURPOSE_LANES = [
  "Learning",
  "Mastery",
  "Contribution",
  "Community",
  "Career transition",
  "Human development",
  "Local problem-solving",
  "Life after automation",
] as const;

export type PurposeLane = (typeof PURPOSE_LANES)[number];

export function normalizePurposeLane(value: unknown): PurposeLane | null {
  const requestedLane = typeof value === "string" ? value.trim() : "";

  return PURPOSE_LANES.includes(requestedLane as PurposeLane)
    ? requestedLane as PurposeLane
    : null;
}
