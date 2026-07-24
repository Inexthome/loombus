import { NextResponse, type NextRequest } from "next/server";
import {
  RoomLifecycleError,
  exportRoomData,
  getRoomLifecycleOverview,
  updateRoomLifecycle,
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
    {
      error: "Room lifecycle controls could not be completed.",
      code: "room_lifecycle_error",
    },
    {
      status: 500,
      headers: { "Cache-Control": "private, no-store" },
    }
  );
}

async function authorize(request: NextRequest) {
  const account = await verifyRequestAccountAccess(createRequestSupabase(request));
  if (!account.ok) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: account.error, code: account.code },
        {
          status: account.status,
          headers: { "Cache-Control": "private, no-store" },
        }
      ),
    };
  }
  return { ok: true as const, user: account.user };
}

export async function GET(request: NextRequest, context: RouteContext) {
  const authorized = await authorize(request);
  if (!authorized.ok) return authorized.response;

  const { roomId } = await context.params;
  if (!validUuid(roomId)) {
    return NextResponse.json(
      { error: "Invalid Room id." },
      { status: 400, headers: { "Cache-Control": "private, no-store" } }
    );
  }

  try {
    return NextResponse.json(
      await getRoomLifecycleOverview(roomId, authorized.user.id),
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const authorized = await authorize(request);
  if (!authorized.ok) return authorized.response;

  const { roomId } = await context.params;
  if (!validUuid(roomId)) {
    return NextResponse.json(
      { error: "Invalid Room id." },
      { status: 400, headers: { "Cache-Control": "private, no-store" } }
    );
  }

  const body = await request.json().catch(() => ({}));
  const action = typeof body?.action === "string" ? body.action : "";

  try {
    if (action === "export") {
      return NextResponse.json(
        await exportRoomData(roomId, authorized.user.id),
        { headers: { "Cache-Control": "private, no-store" } }
      );
    }
    if (action === "archive" || action === "restore" || action === "delete") {
      return NextResponse.json(
        await updateRoomLifecycle(
          roomId,
          authorized.user.id,
          action,
          typeof body?.confirmation === "string" ? body.confirmation : undefined
        ),
        { headers: { "Cache-Control": "private, no-store" } }
      );
    }
    return NextResponse.json(
      { error: "Unknown Room lifecycle action." },
      { status: 400, headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    return jsonError(error);
  }
}
