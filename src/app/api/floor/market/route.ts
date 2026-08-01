import { NextResponse } from "next/server";
import { getFloorEarnings, getFloorMarketData } from "@/lib/floor-twelve-data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [marketsResult, earningsResult] = await Promise.allSettled([
      getFloorMarketData(),
      getFloorEarnings(),
    ]);
    const markets = marketsResult.status === "fulfilled" ? marketsResult.value : [];
    const earnings = earningsResult.status === "fulfilled"
      ? earningsResult.value
      : { available: false, message: "Live earnings data is temporarily unavailable. Your Floor research and coverage remain accessible.", events: [] };
    const configured = Boolean(process.env.TWELVE_DATA_API_KEY);
    return NextResponse.json(
      {
        provider: "Twelve Data",
        configured,
        markets,
        earnings,
        generatedAt: new Date().toISOString(),
        delayed: true,
      },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" } },
    );
  } catch {
    return NextResponse.json(
      { provider: "Twelve Data", configured: Boolean(process.env.TWELVE_DATA_API_KEY), markets: [], earnings: { available: false, message: "Live earnings data is temporarily unavailable. Your Floor research and coverage remain accessible.", events: [] }, error: "Market data unavailable" },
      { status: 503 },
    );
  }
}
