import { NextResponse, type NextRequest } from "next/server";
import {
  RoomAnalyticsError,
  getRoomAnalyticsOverview,
} from "@/lib/room-analytics";
import { createRequestSupabase } from "@/lib/room-operations";
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
  const account = await verifyRequestAccountAccess(
    createRequestSupabase(request)
  );
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
    return json(
      await getRoomAnalyticsOverview(roomId, account.user.id, windowDays)
    );
  } catch (error) {
    return errorResponse(error);
  }
}
