import { NextResponse, type NextRequest } from "next/server";
import {
  RoomGovernanceError,
  getRoomGovernanceOverview,
  performRoomGovernanceAction,
} from "@/lib/room-governance";
import { createRequestSupabase } from "@/lib/room-operations";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";

type RouteContext = { params: Promise<{ roomId: string }> };

function validUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function errorResponse(error: unknown) {
  if (error instanceof RoomGovernanceError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status, headers: { "Cache-Control": "private, no-store" } }
    );
  }
  return NextResponse.json(
    { error: "Room governance could not be completed." },
    { status: 500, headers: { "Cache-Control": "private, no-store" } }
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
  return { ok: true as const, userId: account.user.id };
}

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const { roomId } = await context.params;
  if (!validUuid(roomId)) {
    return NextResponse.json({ error: "Invalid Room id." }, { status: 400 });
  }
  try {
    return NextResponse.json(
      await getRoomGovernanceOverview(roomId, auth.userId),
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const { roomId } = await context.params;
  if (!validUuid(roomId)) {
    return NextResponse.json({ error: "Invalid Room id." }, { status: 400 });
  }
  const body = await request.json().catch(() => ({}));
  const action = typeof body?.action === "string" ? body.action : "";
  try {
    return NextResponse.json(
      await performRoomGovernanceAction(roomId, auth.userId, action, body ?? {}),
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
