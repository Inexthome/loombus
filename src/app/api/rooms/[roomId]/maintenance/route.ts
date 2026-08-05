import { NextResponse, type NextRequest } from "next/server";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import {
  createRequestSupabase,
  createRoomServiceSupabase,
  getRoomAccess,
} from "@/lib/room-operations";
import {
  RoomMaintenanceError,
  cancelOwnMaintenanceRequest,
  createMaintenanceRequest,
  loadRoomMaintenance,
  updateMaintenanceRequest,
} from "@/lib/room-maintenance-server";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ roomId: string }> };

function json(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function errorResponse(error: unknown) {
  if (error instanceof RoomMaintenanceError) {
    return json({ error: error.message, code: error.code }, error.status);
  }
  console.error("Room maintenance request failed:", error);
  return json({ error: "Maintenance Requests could not complete this action." }, 500);
}

async function authorize(request: NextRequest, roomId: string) {
  const account = await verifyRequestAccountAccess(createRequestSupabase(request));
  if (!account.ok) throw new RoomMaintenanceError(account.error, account.status, account.code);
  const service = createRoomServiceSupabase();
  const access = await getRoomAccess(service, roomId, account.user.id);
  if (!access) throw new RoomMaintenanceError("Room not found.", 404, "room_not_found");
  return { service, access, userId: account.user.id };
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const { roomId } = await context.params;
    const authorized = await authorize(request, roomId);
    return json(await loadRoomMaintenance(authorized.service, authorized.access, authorized.userId));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const { roomId } = await context.params;
    const authorized = await authorize(request, roomId);
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new RoomMaintenanceError("Invalid maintenance request.", 400, "invalid_payload");
    }
    const input = body as Record<string, unknown>;
    const action = String(input.action ?? "");
    if (action === "create") {
      return json(await createMaintenanceRequest(authorized.service, authorized.access, authorized.userId, input), 201);
    }
    if (action === "update") {
      return json(await updateMaintenanceRequest(authorized.service, authorized.access, authorized.userId, input));
    }
    if (action === "cancel_own") {
      return json(await cancelOwnMaintenanceRequest(authorized.service, authorized.access, authorized.userId, input));
    }
    throw new RoomMaintenanceError("Unsupported maintenance action.", 400, "unsupported_action");
  } catch (error) {
    return errorResponse(error);
  }
}
