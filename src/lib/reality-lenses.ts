export const REALITY_LENSES = [
  "Loneliness",
  "Hidden Financial Stress",
  "Fear of Irrelevance",
  "Psychological Exhaustion",
  "Quiet Regret",
  "Rebuilding Meaning",
  "Entrepreneur Isolation",
  "Reality Behind Success",
  "AI and Human Purpose",
  "Life Transition",
] as const;

export type RealityLens = (typeof REALITY_LENSES)[number];

export function normalizeRealityLens(value: unknown): RealityLens | null {
  const requestedLens = typeof value === "string" ? value.trim() : "";

  return REALITY_LENSES.includes(requestedLens as RealityLens)
    ? requestedLens as RealityLens
    : null;
}
