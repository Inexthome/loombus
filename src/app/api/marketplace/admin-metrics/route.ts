import { NextRequest, NextResponse } from "next/server";
import { resolveMarketplaceViewer } from "@/lib/marketplace-server-access";
import { MarketplaceError } from "@/lib/marketplace-server-core";

export async function GET(request: NextRequest) {
  try {
    const viewer = await resolveMarketplaceViewer(request, true);
    if (!viewer.isAdmin) {
      return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
    }

    const [listingsResult, reportsResult, savesResult, contactsResult] =
      await Promise.all([
        viewer.service.from("marketplace_listings").select("status"),
        viewer.service
          .from("marketplace_reports")
          .select("id", { count: "exact", head: true })
          .eq("status", "open"),
        viewer.service
          .from("marketplace_saved_listings")
          .select("id", { count: "exact", head: true }),
        viewer.service
          .from("marketplace_contact_threads")
          .select("id", { count: "exact", head: true }),
      ]);

    const firstError =
      listingsResult.error ||
      reportsResult.error ||
      savesResult.error ||
      contactsResult.error;
    if (firstError) throw firstError;

    const counts: Record<string, number> = {};
    for (const row of listingsResult.data ?? []) {
      const status = String(row.status ?? "unknown");
      counts[status] = (counts[status] ?? 0) + 1;
    }

    return NextResponse.json(
      {
        metrics: {
          pending: counts.pending ?? 0,
          active: counts.published ?? 0,
          sold: counts.sold ?? 0,
          expired: counts.expired ?? 0,
          removed: counts.removed ?? 0,
          openReports: reportsResult.count ?? 0,
          savedRelationships: savesResult.count ?? 0,
          contactThreads: contactsResult.count ?? 0,
        },
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    const status = error instanceof MarketplaceError ? error.status : 500;
    const message =
      error instanceof Error ? error.message : "Marketplace metrics could not load.";
    return NextResponse.json({ error: message }, { status });
  }
}
