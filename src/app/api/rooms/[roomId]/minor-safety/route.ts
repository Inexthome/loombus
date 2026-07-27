import { NextRequest, NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/audit-log";
import {
  createRequestSupabase,
  createRoomServiceSupabase,
  getRoomAccess,
} from "@/lib/room-operations";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import { getRoomMinorSafetySettings } from "@/lib/teen-safety-server";

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
  const requestClient = createRequestSupabase(request);
  const accountAccess = await verifyRequestAccountAccess(requestClient);
  if (!accountAccess.ok) {
    return { response: response({ error: accountAccess.error }, accountAccess.status) };
  }
  const service = createRoomServiceSupabase();
  const access = await getRoomAccess(service, roomId, accountAccess.user.id);
  if (!access) return { response: response({ error: "Room not found." }, 404) };
  return { service, access, userId: accountAccess.user.id };
}

async function activeTeenMemberCount(
  service: ReturnType<typeof createRoomServiceSupabase>,
  roomId: string,
) {
  const { data: members, error: memberError } = await service
    .from("room_members")
    .select("user_id")
    .eq("room_id", roomId)
    .not("status", "in", "(blocked,removed,inactive)")
    .limit(5000);
  if (memberError) throw memberError;

  const userIds = [...new Set((members ?? []).map((row) => row.user_id).filter(Boolean))];
  if (!userIds.length) return 0;

  const { count, error } = await service
    .from("profile_sensitive")
    .select("id", { count: "exact", head: true })
    .in("id", userIds)
    .eq("age_band", "teen");
  if (error) throw error;
  return count ?? 0;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { roomId } = await context.params;
    if (!UUID_PATTERN.test(roomId)) return response({ error: "Invalid Room." }, 400);
    const authorized = await authorize(request, roomId);
    if ("response" in authorized) return authorized.response;
    if (!authorized.access.canManage) {
      return response({ canManage: false, roomId }, 200);
    }

    const [settings, teenCount] = await Promise.all([
      getRoomMinorSafetySettings(authorized.service, roomId),
      activeTeenMemberCount(authorized.service, roomId),
    ]);

    return response({
      canManage: true,
      room: { id: roomId, name: authorized.access.room.name },
      settings,
      activeTeenMemberCount: teenCount,
    });
  } catch (error) {
    console.error("Room minor safety load failed:", error);
    return response({ error: "Room minor safety is not configured." }, 500);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { roomId } = await context.params;
    if (!UUID_PATTERN.test(roomId)) return response({ error: "Invalid Room." }, 400);
    const authorized = await authorize(request, roomId);
    if ("response" in authorized) return authorized.response;
    if (!authorized.access.canManage) {
      return response({ error: "Room management access required." }, 403);
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return response({ error: "Invalid Room minor-safety settings." }, 400);
    }
    const input = body as Record<string, unknown>;
    const allowsMinors = input.allowsMinors === true;
    const adultContactMode =
      input.adultContactMode === "disabled" ? "disabled" : "teen_initiated";

    const teenCount = await activeTeenMemberCount(authorized.service, roomId);
    if (!allowsMinors && teenCount > 0) {
      return response(
        { error: "Remove or resolve active teen memberships before disabling minor participation." },
        409,
      );
    }

    const now = new Date().toISOString();
    const { data, error } = await authorized.service
      .from("room_minor_safety_settings")
      .upsert(
        {
          room_id: roomId,
          allows_minors: allowsMinors,
          requires_staff_approval: true,
          adult_contact_mode: adultContactMode,
          updated_at: now,
        },
        { onConflict: "room_id" },
      )
      .select("room_id, allows_minors, requires_staff_approval, adult_contact_mode, updated_at")
      .single();
    if (error) return response({ error: error.message }, 500);

    await logAuditEvent({
      actor_id: authorized.userId,
      action: "room.minor_safety_updated",
      target_type: "room",
      target_id: roomId,
      metadata: {
        allows_minors: allowsMinors,
        requires_staff_approval: true,
        adult_contact_mode: adultContactMode,
      },
    });

    return response({
      ok: true,
      settings: {
        roomId: data.room_id,
        allowsMinors: data.allows_minors,
        requiresStaffApproval: data.requires_staff_approval,
        adultContactMode: data.adult_contact_mode,
        updatedAt: data.updated_at,
      },
    });
  } catch (error) {
    console.error("Room minor safety update failed:", error);
    return response({ error: "Room minor safety is not configured." }, 500);
  }
}
