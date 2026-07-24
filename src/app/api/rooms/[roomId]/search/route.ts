import { NextResponse, type NextRequest } from "next/server";
import {
  RoomLifecycleError,
  searchRoomContent,
  type RoomSearchFilters,
} from "@/lib/room-lifecycle";
import { createRequestSupabase } from "@/lib/room-operations";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";

type RouteContext = { params: Promise<{ roomId: string }> };

function validUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function jsonError(error: unknown) {
  if (error instanceof RoomLifecycleError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      {
        status: error.status,
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  }
  return NextResponse.json(
    { error: "Room search could not be completed.", code: "room_search_error" },
    {
      status: 500,
      headers: { "Cache-Control": "private, no-store" },
    }
  );
}

export async function GET(request: NextRequest, context: RouteContext) {
  const account = await verifyRequestAccountAccess(createRequestSupabase(request));
  if (!account.ok) {
    return NextResponse.json(
      { error: account.error, code: account.code },
      {
        status: account.status,
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  }

  const { roomId } = await context.params;
  if (!validUuid(roomId)) {
    return NextResponse.json(
      { error: "Invalid Room id." },
      { status: 400, headers: { "Cache-Control": "private, no-store" } }
    );
  }

  const params = request.nextUrl.searchParams;
  const filters: RoomSearchFilters = {
    query: (params.get("q") ?? "").trim().slice(0, 200),
    type: (params.get("type") ?? "all").trim().slice(0, 50),
    author: (params.get("author") ?? "").trim().slice(0, 100),
    status: (params.get("status") ?? "all").trim().slice(0, 50),
    fileType: (params.get("fileType") ?? "").trim().slice(0, 100),
    dateFrom: (params.get("dateFrom") ?? "").trim().slice(0, 10),
    dateTo: (params.get("dateTo") ?? "").trim().slice(0, 10),
  };

  try {
    const results = await searchRoomContent(roomId, account.user.id, filters);
    return NextResponse.json(results, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return jsonError(error);
  }
}
