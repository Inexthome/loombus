import "server-only";

export type FloorMarketClose = {
  price: number;
  tradingDate: string;
};

type TwelveDataRow = { datetime?: unknown; close?: unknown };

/**
 * Twelve Data's `end_date` bar isn't guaranteed to land on `onOrBefore` --
 * weekends, holidays, or a not-yet-closed session all shift it earlier.
 * Requesting a short window and picking the latest bar at or before the
 * target date is what actually resolves a call against the right session.
 */
export async function fetchDailyCloseOnOrBefore(
  ticker: string,
  onOrBefore: Date
): Promise<FloorMarketClose | null> {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) {
    throw new Error("Market data is not configured yet.");
  }

  const endDate = onOrBefore.toISOString().slice(0, 10);
  const url = new URL("https://api.twelvedata.com/time_series");
  url.searchParams.set("symbol", ticker);
  url.searchParams.set("interval", "1day");
  url.searchParams.set("end_date", endDate);
  url.searchParams.set("outputsize", "5");
  url.searchParams.set("apikey", apiKey);

  const response = await fetch(url.toString());
  const payload = await response.json();

  if (!response.ok || payload?.status === "error") {
    throw new Error(payload?.message || `Twelve Data request failed for ${ticker}.`);
  }

  const values = (Array.isArray(payload?.values) ? payload.values : []) as TwelveDataRow[];
  const match = values.find(
    (row) => typeof row.datetime === "string" && row.datetime <= endDate
  );
  if (!match || typeof match.datetime !== "string") return null;

  const price = Number(match.close);
  if (!Number.isFinite(price)) return null;

  return { price, tradingDate: match.datetime };
}
