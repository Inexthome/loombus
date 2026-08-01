const TWELVE_BASE = "https://api.twelvedata.com";

export const FLOOR_MARKETS = [
  { key: "SPX", name: "S&P 500", symbol: "SPY", note: "SPY proxy" },
  { key: "IXIC", name: "Nasdaq", symbol: "QQQ", note: "QQQ proxy" },
  { key: "DJI", name: "Dow", symbol: "DIA", note: "DIA proxy" },
  { key: "RUT", name: "Russell 2000", symbol: "IWM", note: "IWM proxy" },
  { key: "VIX", name: "VIX", symbol: "VIX", note: "Volatility index" },
  { key: "XAU", name: "Gold", symbol: "XAU/USD", note: "Spot gold" },
  { key: "WTI", name: "Oil", symbol: "WTI/USD", note: "WTI crude" },
  { key: "US10Y", name: "10Y Treasury", symbol: "IEF", note: "IEF Treasury proxy" },
] as const;

type Quote = { symbol?: string; close?: string; previous_close?: string; change?: string; percent_change?: string; datetime?: string; status?: string; message?: string };
type Earnings = { symbol?: string; name?: string; date?: string; time?: string; eps_estimate?: number | string | null; revenue_estimate?: number | string | null };

const EARNINGS_UNAVAILABLE_MESSAGE = "Live earnings data is temporarily unavailable. Your Floor research and coverage remain accessible.";

function key() {
  const value = process.env.TWELVE_DATA_API_KEY;
  if (!value) throw new Error("TWELVE_DATA_API_KEY is not configured");
  return value;
}

function date(value: Date) { return value.toISOString().slice(0, 10); }
function numeric(value: unknown) { const number = Number(value); return Number.isFinite(number) ? number : null; }

export async function getFloorMarketData() {
  const symbols = FLOOR_MARKETS.map((item) => item.symbol).join(",");
  const response = await fetch(`${TWELVE_BASE}/quote?symbol=${encodeURIComponent(symbols)}&apikey=${encodeURIComponent(key())}`, { next: { revalidate: 300 } });
  if (!response.ok) throw new Error(`Twelve Data quote request failed: ${response.status}`);
  const raw = await response.json() as Quote | Record<string, Quote>;
  const quotes = new Map<string, Quote>();
  const single = raw as Quote;
  if (typeof single.symbol === "string" && single.symbol) {
    quotes.set(single.symbol, single);
  } else {
    for (const [symbol, value] of Object.entries(raw as Record<string, Quote>)) {
      quotes.set(symbol, value);
    }
  }

  return FLOOR_MARKETS.map((market) => {
    const quote = quotes.get(market.symbol);
    return {
      ...market,
      price: numeric(quote?.close),
      previousClose: numeric(quote?.previous_close),
      change: numeric(quote?.change),
      percentChange: numeric(quote?.percent_change),
      asOf: quote?.datetime ?? null,
      available: Boolean(quote?.close),
      message: quote?.message ?? null,
    };
  });
}

export async function getFloorEarnings() {
  const start = new Date();
  const end = new Date(start.getTime() + 14 * 86400000);
  const response = await fetch(`${TWELVE_BASE}/earnings_calendar?start_date=${date(start)}&end_date=${date(end)}&country=United%20States&apikey=${encodeURIComponent(key())}`, { next: { revalidate: 21600 } });
  const raw = await response.json() as { data?: Earnings[]; status?: string; message?: string };
  // Provider errors can contain plan, account, or endpoint details that should
  // remain server-side rather than being rendered in the customer experience.
  if (!response.ok || raw.status === "error") {
    console.warn("Twelve Data earnings calendar unavailable", {
      status: response.status,
      providerStatus: raw.status ?? null,
      providerMessage: raw.message ?? null,
    });
    return { available: false, message: EARNINGS_UNAVAILABLE_MESSAGE, events: [] };
  }
  return {
    available: true,
    message: null,
    events: (raw.data ?? []).slice(0, 30).map((event) => ({
      symbol: event.symbol ?? "",
      name: event.name ?? event.symbol ?? "Company",
      date: event.date ?? "",
      time: event.time ?? null,
      epsEstimate: numeric(event.eps_estimate),
      revenueEstimate: numeric(event.revenue_estimate),
    })),
  };
}
