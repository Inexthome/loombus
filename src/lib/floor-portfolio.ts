import { normalizeFloorTicker } from "@/lib/floor-companies";

export type PortfolioPosition = {
  id: string;
  ticker: string;
  weight: number;
  thesisNote: string;
  addedAt: string;
};

export type WatchlistItem = {
  id: string;
  ticker: string;
  reason: string;
  addedAt: string;
};

export type PortfolioIntelligence = {
  totalPositions: number;
  concentration: number;
  topPosition: PortfolioPosition | null;
  diversificationLabel: "Empty" | "Concentrated" | "Focused" | "Balanced";
  unallocatedWeight: number;
};

export const FLOOR_PORTFOLIO_STORAGE_KEY = "loombus:the-floor:portfolio:v1";
export const FLOOR_WATCHLIST_STORAGE_KEY = "loombus:the-floor:watchlist:v1";

export function normalizeWeight(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value * 100) / 100));
}

export function buildPosition(ticker: string, weight: number, thesisNote: string): PortfolioPosition {
  const normalizedTicker = normalizeFloorTicker(ticker);
  return {
    id: `${normalizedTicker}-${Date.now()}`,
    ticker: normalizedTicker,
    weight: normalizeWeight(weight),
    thesisNote: thesisNote.trim().slice(0, 500),
    addedAt: new Date().toISOString(),
  };
}

export function buildWatchlistItem(ticker: string, reason: string): WatchlistItem {
  const normalizedTicker = normalizeFloorTicker(ticker);
  return {
    id: `${normalizedTicker}-${Date.now()}`,
    ticker: normalizedTicker,
    reason: reason.trim().slice(0, 300),
    addedAt: new Date().toISOString(),
  };
}

export function calculatePortfolioIntelligence(positions: PortfolioPosition[]): PortfolioIntelligence {
  const sorted = [...positions].sort((a, b) => b.weight - a.weight);
  const totalWeight = sorted.reduce((sum, position) => sum + normalizeWeight(position.weight), 0);
  const topPosition = sorted[0] ?? null;
  const concentration = topPosition?.weight ?? 0;

  let diversificationLabel: PortfolioIntelligence["diversificationLabel"] = "Empty";
  if (positions.length > 0 && (concentration >= 40 || positions.length <= 2)) diversificationLabel = "Concentrated";
  else if (positions.length > 0 && (concentration >= 25 || positions.length <= 4)) diversificationLabel = "Focused";
  else if (positions.length > 0) diversificationLabel = "Balanced";

  return {
    totalPositions: positions.length,
    concentration,
    topPosition,
    diversificationLabel,
    unallocatedWeight: Math.max(0, Math.round((100 - totalWeight) * 100) / 100),
  };
}
