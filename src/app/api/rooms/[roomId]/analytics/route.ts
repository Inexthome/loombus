import { NextResponse, type NextRequest } from "next/server";
import {
  RoomAnalyticsError,
  getRoomAnalyticsOverview,
} from "@/lib/room-analytics";
import {
  createRequestSupabase,
  createRoomServiceSupabase,
} from "@/lib/room-operations";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";

type RouteContext = { params: Promise<{ roomId: string }> };

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function validUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function errorResponse(error: unknown) {
  if (error instanceof RoomAnalyticsError) {
    return json({ error: error.message, code: error.code }, error.status);
  }
  return json(
    {
      error: "Room analytics could not be loaded.",
      code: "room_analytics_unavailable",
    },
    500
  );
}

export async function GET(request: NextRequest, context: RouteContext) {
  let account;
  try {
    account = await verifyRequestAccountAccess(createRequestSupabase(request));
  } catch {
    return json(
      {
        error: "Room analytics service is not configured.",
        code: "room_analytics_not_configured",
      },
      500
    );
  }

  if (!account.ok) {
    return json(
      { error: account.error, code: account.code },
      account.status
    );
  }

  const { roomId } = await context.params;
  if (!validUuid(roomId)) {
    return json({ error: "Invalid Room id.", code: "invalid_room_id" }, 400);
  }

  const rawWindow = Number(request.nextUrl.searchParams.get("window") ?? 30);
  const windowDays = [7, 30, 90].includes(rawWindow) ? rawWindow : 30;

  try {
    const overview = await getRoomAnalyticsOverview(
      roomId,
      account.user.id,
      windowDays
    );

    if (overview.room.supportRoom) {
      const service = createRoomServiceSupabase();
      const openCases = await service
        .from("room_posts")
        .select("id", { count: "exact", head: true })
        .eq("room_id", roomId)
        .is("deleted_at", null)
        .not("status", "in", "(resolved,closed,cancelled)");
      if (openCases.error) {
        throw new RoomAnalyticsError(
          openCases.error.message || "Open Customer Support cases could not be counted.",
          503,
          "room_analytics_storage_unavailable"
        );
      }
      overview.metrics.discussions.openCases = openCases.count ?? 0;
    }

    return json(overview);
  } catch (error) {
    return errorResponse(error);
  }
}
