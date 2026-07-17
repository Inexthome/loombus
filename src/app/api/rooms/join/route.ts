import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { logAuditEvent } from "@/lib/audit-log";
import { getRoomPlanEntitlements } from "@/lib/room-plan-entitlements";
import {
  asNumber,
  asString,
  createRequestSupabase,
  createRoomServiceSupabase,
  getRoomAccess,
  type RoomRow,
} from "@/lib/room-operations";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";

type JsonObject = Record<string, unknown>;

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json(code ? { error: message, code } : { error: message }, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function normalizeDomains(value: unknown) {
  return Array.isArray(value)
    ? value.map(asString).map((item) => item.toLowerCase()).filter(Boolean)
    : [];
}

export async function POST(request: NextRequest) {
  let requestSupabase;
  let serviceSupabase;
  try {
    requestSupabase = createRequestSupabase(request);
    serviceSupabase = createRoomServiceSupabase();
  } catch {
    return jsonError("Rooms service is not configured.", 500);
  }

  const accountAccess = await verifyRequestAccountAccess(requestSupabase);
  if (!accountAccess.ok) {
    return jsonError(
      accountAccess.error,
      accountAccess.status,
      accountAccess.code
    );
  }

  const body = await request.json().catch(() => null);
  const token = asString(body?.token);
  if (token.length < 20 || token.length > 300) {
    return jsonError("This Room invitation is invalid.", 400, "room_invite_invalid");
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const inviteResult = await serviceSupabase
    .from("room_invites")
    .select("*")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (inviteResult.error) {
    return jsonError("The Room invitation could not be verified.", 503);
  }
  if (!inviteResult.data) {
    return jsonError("This Room invitation is invalid or no longer available.", 404);
  }

  const invite = inviteResult.data as RoomRow;
  const roomId = asString(invite.room_id);
  const inviteId = asString(invite.id);
  const now = Date.now();
  const revokedAt = asString(invite.revoked_at);
  const expiresAt = asString(invite.expires_at);
  const maxUses = invite.max_uses === null ? null : asNumber(invite.max_uses);
  const useCount = asNumber(invite.use_count);

  if (revokedAt) return jsonError("This Room invitation was revoked.", 410);
  if (expiresAt && new Date(expiresAt).getTime() <= now) {
    return jsonError("This Room invitation has expired.", 410);
  }
  if (maxUses !== null && useCount >= maxUses) {
    return jsonError("This Room invitation has reached its usage limit.", 410);
  }

  const userId = accountAccess.user.id;
  const existingAccess = await getRoomAccess(
    serviceSupabase,
    roomId,
    userId
  ).catch(() => null);
  if (!existingAccess) return jsonError("Room not found.", 404);
  if (existingAccess.allowed) {
    return NextResponse.json(
      { ok: true, roomId, alreadyMember: true },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  const entitlements = getRoomPlanEntitlements(
    existingAccess.room.subscriptionPlan,
    existingAccess.room.subscriptionStatus
  );
  if (!entitlements.modules.includes("invites")) {
    return jsonError("Secure invitations are not active for this Room plan.", 403);
  }

  const settingsResult = await serviceSupabase
    .from("room_module_settings")
    .select("settings")
    .eq("room_id", roomId)
    .maybeSingle();
  if (settingsResult.error) {
    return jsonError("Room invitation settings could not be verified.", 503);
  }
  const settings = asObject((settingsResult.data as RoomRow | null)?.settings);
  const allowedDomains = normalizeDomains(settings.allowedEmailDomains);
  const email = accountAccess.user.email?.toLowerCase() ?? "";
  const emailDomain = email.includes("@") ? email.split("@").pop() ?? "" : "";
  if (allowedDomains.length > 0 && !allowedDomains.includes(emailDomain)) {
    return jsonError(
      "This invitation is restricted to an approved email domain.",
      403,
      "room_invite_domain_restricted"
    );
  }

  const requireApproval = settings.inviteRequiresApproval === true;
  if (requireApproval) {
    const application = await serviceSupabase.from("room_applications").upsert(
      {
        room_id: roomId,
        applicant_id: userId,
        state: "pending",
        note: `Joined through invitation: ${asString(invite.label) || "Room invitation"}`,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "room_id,applicant_id" }
    );
    if (application.error) {
      return jsonError("The Room join request could not be created.", 503);
    }

    await serviceSupabase
      .from("room_invites")
      .update({ use_count: useCount + 1 })
      .eq("id", inviteId)
      .eq("use_count", useCount);

    await logAuditEvent({
      actor_id: userId,
      action: "room.invite.requested",
      target_type: "room_invite",
      target_id: inviteId,
      metadata: { room_id: roomId },
    });

    return NextResponse.json(
      { ok: true, roomId, pendingApproval: true },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  if (entitlements.memberLimit !== null) {
    const countResult = await serviceSupabase
      .from("room_members")
      .select("id", { count: "exact", head: true })
      .eq("room_id", roomId)
      .not("status", "in", "(blocked,removed,inactive)");
    if (countResult.error) {
      return jsonError("Room membership capacity could not be verified.", 503);
    }
    if ((countResult.count ?? 0) >= entitlements.memberLimit) {
      return jsonError("This Room has reached its member limit.", 409);
    }
  }

  const role = asString(invite.role) === "moderator" ? "moderator" : "member";
  const membership = await serviceSupabase.from("room_members").upsert(
    {
      room_id: roomId,
      user_id: userId,
      role,
      status: "active",
      joined_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "room_id,user_id" }
  );
  if (membership.error) {
    return jsonError("The Room membership could not be created.", 503);
  }

  await serviceSupabase
    .from("room_invites")
    .update({ use_count: useCount + 1 })
    .eq("id", inviteId)
    .eq("use_count", useCount);

  await logAuditEvent({
    actor_id: userId,
    action: "room.invite.redeemed",
    target_type: "room_invite",
    target_id: inviteId,
    metadata: { room_id: roomId, role },
  });

  return NextResponse.json(
    { ok: true, roomId },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
