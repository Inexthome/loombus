import { NextRequest, NextResponse } from "next/server";
import { listPublicMarketplaceForIdentity } from "@/lib/marketplace-public-server";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const listings = await listPublicMarketplaceForIdentity({
    sellerUsername: params.get("sellerUsername"),
    businessSlug: params.get("businessSlug"),
    limit: params.get("limit"),
  });

  return NextResponse.json(
    { listings },
    { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } }
  );
}
