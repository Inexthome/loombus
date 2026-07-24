import { NextResponse, type NextRequest } from "next/server";
import {
  createRoomModerationReport,
  getRoomModerationOverview,
  performRoomModerationAction,
  RoomModerationError,
} from "@/lib/room-moderation";
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

async function authorize(request: NextRequest) {
  const account = await verifyRequestAccountAccess(createRequestSupabase(request));
  if (!account.ok) return { userId: null, response: json({ error: account.error, code: account.code }, account.status) };
  return { userId: account.user.id, response: null };
}

function moderationError(error: unknown) {
  if (error instanceof RoomModerationError) {
    return json({ error: error.message, code: error.code }, error.status);
  }
  return json({ error: error instanceof Error ? error.message : "Room moderation is temporarily unavailable." }, 503);
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const authorized = await authorize(request);
    if (!authorized.userId) return authorized.response;
    const { roomId } = await context.params;
    if (!validUuid(roomId)) return json({ error: "Invalid Room id." }, 400);
    return json(await getRoomModerationOverview(roomId, authorized.userId));
  } catch (error) {
    return moderationError(error);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const authorized = await authorize(request);
    if (!authorized.userId) return authorized.response;
    const { roomId } = await context.params;
    if (!validUuid(roomId)) return json({ error: "Invalid Room id." }, 400);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "";
    const result =
      action === "report"
        ? await createRoomModerationReport(roomId, authorized.userId, body)
        : await performRoomModerationAction(roomId, authorized.userId, action, body);
    return json(result, action === "report" ? 201 : 200);
  } catch (error) {
    return moderationError(error);
  }
}
