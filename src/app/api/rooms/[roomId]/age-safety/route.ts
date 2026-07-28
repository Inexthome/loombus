import { NextRequest, NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/audit-log";
import {
  getMemberAgeSafety,
  getRoomMinorSafetySettings,
} from "@/lib/teen-safety-server";
import {
  createRequestSupabase,
  createRoomServiceSupabase,
  getRoomAccess,
} from "@/lib/room-operations";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";

type RouteContext = { params: Promise<{ roomId: string }> };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function response(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

async function authorize(request: NextRequest, roomId: string) {
  let requestClient;
  let service;
  try {
    requestClient = createRequestSupabase(request);
    service = createRoomServiceSupabase();
  } catch {
    return {
      ok: false as const,
      response: response({ error: "Rooms service is not configured." }, 500),
    };
  }

  const accountAccess = await verifyRequestAccountAccess(requestClient);
  if (!accountAccess.ok) {
    return {
      ok: false as const,
      response: response(
        { error: accountAccess.error, code: accountAccess.code },
        accountAccess.status
      ),
    };
  }

  const access = await getRoomAccess(service, roomId, accountAccess.user.id).catch(
    () => null
  );
  if (!access) {
    return {
      ok: false as const,
      response: response({ error: "Room not found." }, 404),
    };
  }
  if (!access.canManage) {
    return {
      ok: false as const,
      response: response({ error: "Room management access is required." }, 403),
    };
  }

  return {
    ok: true as const,
    userId: accountAccess.user.id,
    service,
    access,
  };
}

async function getMinorSummary(
  service: ReturnType<typeof createRoomServiceSupabase>,
  roomId: string
) {
  const [memberResult, applicationResult] = await Promise.all([
    service
      .from("room_members")
      .select("user_id, status")
      .eq("room_id", roomId)
      .not("status", "in", "(blocked,removed,inactive)"),
    service
      .from("room_applications")
      .select("applicant_id, state")
      .eq("room_id", roomId)
      .eq("state", "pending"),
  ]);

  if (memberResult.error || applicationResult.error) {
    throw new Error(
      memberResult.error?.message ??
        applicationResult.error?.message ??
        "Unable to load Room age-safety summary."
    );
  }

  const memberIds = (memberResult.data ?? []).map((row) => String(row.user_id));
  const applicantIds = (applicationResult.data ?? []).map((row) =>
    String(row.applicant_id)
  );
  const userIds = [...new Set([...memberIds, ...applicantIds])];

  if (userIds.length === 0) {
    return { activeTeenMembers: 0, pendingTeenApplications: 0 };
  }

  const { data: sensitiveRows, error } = await service
    .from("profile_sensitive")
    .select("id, age_band")
    .in("id", userIds);
  if (error) throw new Error(error.message);

  const teenIds = new Set(
    (sensitiveRows ?? [])
      .filter((row) => row.age_band === "teen")
      .map((row) => String(row.id))
  );

  return {
    activeTeenMembers: memberIds.filter((id) => teenIds.has(id)).length,
    pendingTeenApplications: applicantIds.filter((id) => teenIds.has(id)).length,
  };
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { roomId } = await context.params;
  if (!UUID_PATTERN.test(roomId)) {
    return response({ error: "Invalid Room id." }, 400);
  }

  const authorized = await authorize(request, roomId);
  if (!authorized.ok) return authorized.response;

  try {
    const [settings, summary, managerAgeSafety] = await Promise.all([
      getRoomMinorSafetySettings(authorized.service, roomId),
      getMinorSummary(authorized.service, roomId),
      getMemberAgeSafety(authorized.service, authorized.userId),
    ]);

    return response({
      room: {
        id: authorized.access.room.id,
        name: authorized.access.room.name,
        roomType: authorized.access.room.roomType,
      },
      access: {
        isOwner: authorized.access.isOwner,
        canManage: authorized.access.canManage,
      },
      settings,
      summary,
      managerAgeBand: managerAgeSafety.ageBand,
    });
  } catch (error) {
    return response(
      {
        error:
          error instanceof Error
            ? error.message
            : "Room age-safety settings could not be loaded.",
        code: "room_age_safety_unavailable",
      },
      503
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { roomId } = await context.params;
  if (!UUID_PATTERN.test(roomId)) {
    return response({ error: "Invalid Room id." }, 400);
  }

  const authorized = await authorize(request, roomId);
  if (!authorized.ok) return authorized.response;
  if (!authorized.access.isOwner) {
    return response(
      { error: "Only the Room owner can change minor-admission settings." },
      403
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return response({ error: "Invalid Room age-safety request." }, 400);
  }
  const allowsMinors = (body as Record<string, unknown>).allowsMinors;
  if (typeof allowsMinors !== "boolean") {
    return response(
      { error: "Choose whether the Room may admit teen members." },
      400
    );
  }

  try {
    const ownerAgeSafety = await getMemberAgeSafety(
      authorized.service,
      authorized.userId
    );
    if (!ownerAgeSafety.lookupAvailable || ownerAgeSafety.ageBand !== "adult") {
      return response(
        {
          error: "Room minor-safety settings require an eligible adult owner.",
          code: "adult_room_owner_required",
        },
        403
      );
    }

    const summary = await getMinorSummary(authorized.service, roomId);
    if (
      !allowsMinors &&
      (summary.activeTeenMembers > 0 || summary.pendingTeenApplications > 0)
    ) {
      return response(
        {
          error:
            "Resolve active and pending teen membership before disabling teen admission.",
          code: "teen_membership_present",
          activeTeenMembers: summary.activeTeenMembers,
          pendingTeenApplications: summary.pendingTeenApplications,
        },
        409
      );
    }

    const { error } = await authorized.service
      .from("room_minor_safety_settings")
      .upsert(
        {
          room_id: roomId,
          allows_minors: allowsMinors,
          minor_admission_mode: allowsMinors
            ? "approval_required"
            : "blocked",
          configured_by: authorized.userId,
        },
        { onConflict: "room_id" }
      );
    if (error) throw new Error(error.message);

    await logAuditEvent({
      actor_id: authorized.userId,
      action: "room.minor_safety.updated",
      target_type: "room",
      target_id: roomId,
      metadata: {
        room_id: roomId,
        allows_minors: allowsMinors,
        minor_admission_mode: allowsMinors
          ? "approval_required"
          : "blocked",
      },
    });

    return response({
      ok: true,
      settings: await getRoomMinorSafetySettings(authorized.service, roomId),
      summary,
    });
  } catch (error) {
    return response(
      {
        error:
          error instanceof Error
            ? error.message
            : "Room age-safety settings could not be saved.",
        code: "room_age_safety_update_failed",
      },
      503
    );
  }
}
