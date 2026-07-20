import { NextRequest, NextResponse } from "next/server";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import {
  createRequestSupabase,
  createRoomServiceSupabase,
} from "@/lib/room-operations";

function response(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET(request: NextRequest) {
  try {
    const access = await verifyRequestAccountAccess(
      createRequestSupabase(request),
    );

    if (!access.ok) {
      return response(
        { error: access.error, code: access.code ?? "account_access_denied" },
        access.status,
      );
    }

    if (access.profile.is_admin !== true) {
      return response(
        { error: "Administrator access is required.", code: "administrator_required" },
        403,
      );
    }

    const service = createRoomServiceSupabase();
    const [openSignals, pendingScans, scanErrors] = await Promise.all([
      service
        .from("media_duplicate_signals")
        .select("id", { count: "exact", head: true })
        .eq("status", "open"),
      service
        .from("media_fingerprints")
        .select("id", { count: "exact", head: true })
        .in("scan_status", ["pending", "scanning"]),
      service
        .from("media_fingerprints")
        .select("id", { count: "exact", head: true })
        .eq("scan_status", "error"),
    ]);

    const error = openSignals.error || pendingScans.error || scanErrors.error;
    if (error) {
      return response(
        {
          error: error.message || "Media Duplicate Review summary could not load.",
          code: "media_duplicate_summary_unavailable",
        },
        503,
      );
    }

    return response({
      isAdmin: true,
      openSignals: openSignals.count ?? 0,
      pendingScans: pendingScans.count ?? 0,
      scanErrors: scanErrors.count ?? 0,
    });
  } catch (error) {
    console.error("Media duplicate summary request failed:", error);
    return response(
      {
        error: "Media Duplicate Review summary could not load.",
        code: "media_duplicate_summary_failed",
      },
      500,
    );
  }
}
