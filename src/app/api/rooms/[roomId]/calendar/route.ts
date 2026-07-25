import { NextResponse, type NextRequest } from "next/server";
import { logAuditEvent } from "@/lib/audit-log";
import {
  cancelRoomCalendarEvent,
  createRoomCalendarEvent,
  loadRoomCalendar,
  normalizeRoomCalendarError,
  roomCalendarIsAdvanced,
  setRoomCalendarRsvp,
  updateRoomCalendarEvent,
  validateRoomCalendarInput,
} from "@/lib/room-calendar-runtime";
import {
  createRequestSupabase,
  createRoomServiceSupabase,
  getRoomAccess,
} from "@/lib/room-operations";
import { ExpansionError, validUuid } from "@/lib/room-expansion-service";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";

type RouteContext = { params: Promise<{ roomId: string }> };

type Authorized =
  | {
      ok: true;
      userId: string;
      service: ReturnType<typeof createRoomServiceSupabase>;
    }
  | { ok: false; response: NextResponse };

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function errorResponse(error: unknown) {
  const normalized = normalizeRoomCalendarError(error);
  if (normalized instanceof ExpansionError) {
    return json(
      { error: normalized.message, code: normalized.code },
      normalized.status
    );
  }
  console.error("Room calendar failure:", normalized);
  return json(
    {
      error: "The Room calendar could not complete this request.",
      code: "room_calendar_unavailable",
    },
    503
  );
}

async function authorize(request: NextRequest): Promise<Authorized> {
  try {
    const account = await verifyRequestAccountAccess(
      createRequestSupabase(request)
    );
    if (!account.ok) {
      return {
        ok: false,
        response: json(
          { error: account.error, code: account.code },
          account.status
        ),
      };
    }
    return {
      ok: true,
      userId: account.user.id,
      service: createRoomServiceSupabase(),
    };
  } catch {
    return {
      ok: false,
      response: json(
        {
          error: "Room calendar service is not configured.",
          code: "room_calendar_not_configured",
        },
        500
      ),
    };
  }
}

async function roomAccess(
  service: ReturnType<typeof createRoomServiceSupabase>,
  roomId: string,
  userId: string
) {
  const access = await getRoomAccess(service, roomId, userId).catch(() => null);
  if (!access) {
    throw new ExpansionError("Room not found.", 404, "room_not_found");
  }
  if (!access.allowed && !access.isOwner) {
    throw new ExpansionError(
      "Active Room membership is required.",
      403,
      "room_membership_required"
    );
  }
  return access;
}

function rangeValue(value: string | null, fallback: Date) {
  if (!value) return fallback.toISOString();
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toISOString()
    : fallback.toISOString();
}

export async function GET(request: NextRequest, context: RouteContext) {
  const authorized = await authorize(request);
  if (!authorized.ok) return authorized.response;
  const { roomId } = await context.params;
  if (!validUuid(roomId)) {
    return json({ error: "Invalid Room id.", code: "invalid_room_id" }, 400);
  }

  try {
    const access = await roomAccess(
      authorized.service,
      roomId,
      authorized.userId
    );
    const advanced = roomCalendarIsAdvanced(access);
    const start = rangeValue(
      request.nextUrl.searchParams.get("start"),
      new Date(Date.now() - 30 * 86400000)
    );
    const end = rangeValue(
      request.nextUrl.searchParams.get("end"),
      new Date(Date.now() + 365 * 86400000)
    );
    const calendar = await loadRoomCalendar(
      authorized.service,
      roomId,
      access,
      authorized.userId,
      {
        advanced,
        rangeStart: start,
        rangeEnd: end,
        includeCancelled: true,
      }
    );
    return json({
      room: {
        id: access.room.id,
        name: access.room.name,
        roomType: access.room.roomType,
        plan: access.room.subscriptionPlan,
      },
      access: {
        role: access.role,
        canManage: access.canManage,
        canModerate: access.canModerate,
        isOwner: access.isOwner,
      },
      advanced,
      calendar,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const authorized = await authorize(request);
  if (!authorized.ok) return authorized.response;
  const { roomId } = await context.params;
  if (!validUuid(roomId)) {
    return json({ error: "Invalid Room id.", code: "invalid_room_id" }, 400);
  }
  const body = await request.json().catch(() => ({}));
  const action = typeof body?.action === "string" ? body.action : "";

  try {
    const access = await roomAccess(
      authorized.service,
      roomId,
      authorized.userId
    );
    const advanced = roomCalendarIsAdvanced(access);
    let result;
    if (action === "create") {
      result = await createRoomCalendarEvent(
        authorized.service,
        access,
        authorized.userId,
        validateRoomCalendarInput(body),
        { advanced }
      );
    } else if (action === "update") {
      result = await updateRoomCalendarEvent(
        authorized.service,
        access,
        authorized.userId,
        validateRoomCalendarInput(body),
        { advanced }
      );
    } else if (action === "cancel") {
      result = await cancelRoomCalendarEvent(
        authorized.service,
        access,
        authorized.userId,
        body
      );
    } else if (action === "rsvp") {
      result = await setRoomCalendarRsvp(
        authorized.service,
        access,
        authorized.userId,
        body
      );
    } else {
      throw new ExpansionError(
        "Choose a supported Room calendar action.",
        400,
        "room_calendar_unknown_action"
      );
    }

    const resultRecord =
      result && typeof result === "object"
        ? (result as Record<string, unknown>)
        : {};

    await logAuditEvent({
      actor_id: authorized.userId,
      action: `room.calendar.${action}`,
      target_type: "room",
      target_id: roomId,
      metadata: {
        room_id: roomId,
        event_id:
          typeof body?.eventId === "string"
            ? body.eventId
            : typeof resultRecord.id === "string"
              ? resultRecord.id
              : null,
        advanced,
      },
    });
    return json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
