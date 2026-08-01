export type FloorWatchType = "company" | "theme" | "risk" | "analyst" | "catalyst";

export type FloorWatchItem = {
  id: string;
  type: FloorWatchType;
  label: string;
  note: string;
  createdAt: string;
};

export type FloorJournalEntry = {
  id: string;
  ticker: string;
  title: string;
  body: string;
  conviction: number;
  createdAt: string;
};

export type FloorRoom = {
  id: string;
  name: string;
  focus: string;
  objective: string;
  watchlist: string[];
  tasks: string[];
  createdAt: string;
};

export const FLOOR_WATCHLIST_KEY = "loombus.floor.watchlist.v1";
export const FLOOR_JOURNAL_KEY = "loombus.floor.journal.v1";
export const FLOOR_ROOMS_KEY = "loombus.floor.rooms.v1";

export function makeFloorId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function splitFloorList(value: string) {
  return value.split(/\n|,/g).map((item) => item.trim()).filter(Boolean).slice(0, 20);
}

export function normalizeFloorSymbol(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9.-]/g, "").slice(0, 12);
}
