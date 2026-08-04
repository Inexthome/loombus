import { NextResponse, type NextRequest } from "next/server";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import {
  createRequestSupabase,
  createRoomServiceSupabase,
  getRoomAccess,
} from "@/lib/room-operations";
import {
  RoomReservationError,
  cancelOwnRoomReservation,
  createRoomResource,
  loadRoomReservations,
  managerReservationAction,
  requestRoomReservation,
  setRoomResourceStatus,
} from "@/lib/room-reservations-server";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ roomId: string }> };

function json(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function errorResponse(error: unknown) {
  if (error instanceof RoomReservationError) {
    return json({ error: error.message, code: error.code }, error.status);
  }
  console.error("Room reservation request failed:", error);
  return json(
    {
      error: "Room reservations could not complete this request.",
      code: "room_reservations_failed",
    },
    500
  );
}

async function authorize(request: NextRequest, roomId: string) {
  const account = await verifyRequestAccountAccess(createRequestSupabase(request));
  if (!account.ok) {
    throw new RoomReservationError(account.error, account.status, account.code);
  }
  const service = createRoomServiceSupabase();
  const access = await getRoomAccess(service, roomId, account.user.id);
  if (!access) {
    throw new RoomReservationError("Room not found.", 404, "room_not_found");
  }
  return { service, access, userId: account.user.id };
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const { roomId } = await context.params;
    const authorized = await authorize(request, roomId);
    return json(
      await loadRoomReservations(
        authorized.service,
        authorized.access,
        authorized.userId
      )
    );
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
      throw new RoomReservationError("Invalid reservation request.", 400, "invalid_payload");
    }
    const input = body as Record<string, unknown>;
    const action = String(input.action ?? "").trim();

    if (action === "create_resource") {
      return json(
        await createRoomResource(
          authorized.service,
          authorized.access,
          authorized.userId,
          input
        ),
        201
      );
    }
    if (action === "set_resource_status") {
      return json(
        await setRoomResourceStatus(
          authorized.service,
          authorized.access,
          input
        )
      );
    }
    if (action === "request") {
      return json(
        await requestRoomReservation(
          authorized.service,
          authorized.access,
          authorized.userId,
          input
        ),
        201
      );
    }
    if (action === "manager_action") {
      return json(
        await managerReservationAction(
          authorized.service,
          authorized.access,
          authorized.userId,
          input
        )
      );
    }
    if (action === "cancel_own") {
      return json(
        await cancelOwnRoomReservation(
          authorized.service,
          authorized.access,
          authorized.userId,
          input
        )
      );
    }

    throw new RoomReservationError(
      "Unsupported Room reservation action.",
      400,
      "unsupported_action"
    );
  } catch (error) {
    return errorResponse(error);
  }
}
