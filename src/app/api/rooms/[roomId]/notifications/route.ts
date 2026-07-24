import { NextResponse, type NextRequest } from "next/server";
import { logAuditEvent } from "@/lib/audit-log";
import {
  createRequestSupabase,
  createRoomServiceSupabase,
  getRoomAccess,
} from "@/lib/room-operations";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";

type RouteContext = { params: Promise<{ roomId: string }> };
type ServiceClient = ReturnType<typeof createRoomServiceSupabase>;

type Authorized =
  | { ok: true; userId: string; service: ServiceClient }
  | { ok: false; response: NextResponse };

type PreferenceRow = {
  muted?: boolean | null;
  new_discussions_enabled?: boolean | null;
  announcements_enabled?: boolean | null;
  events_enabled?: boolean | null;
  email_digest_enabled?: boolean | null;
  email_digest_frequency?: string | null;
  email_digest_last_sent_at?: string | null;
};

const DEFAULTS = {
  inAppEnabled: true,
  newDiscussionsEnabled: false,
  announcementsEnabled: true,
  eventsEnabled: true,
  emailDigestEnabled: false,
  emailDigestFrequency: "weekly" as "daily" | "weekly",
};

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function jsonError(message: string, status: number, code?: string) {
  return json(code ? { error: message, code } : { error: message }, status);
}

function validUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
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
        response: jsonError(account.error, account.status, account.code),
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
      response: jsonError("Room notification service is not configured.", 500),
    };
  }
}

function normalize(row: PreferenceRow | null) {
  return {
    inAppEnabled: !(row?.muted ?? false),
    newDiscussionsEnabled:
      row?.new_discussions_enabled ?? DEFAULTS.newDiscussionsEnabled,
    announcementsEnabled:
      row?.announcements_enabled ?? DEFAULTS.announcementsEnabled,
    eventsEnabled: row?.events_enabled ?? DEFAULTS.eventsEnabled,
    emailDigestEnabled:
      row?.email_digest_enabled ?? DEFAULTS.emailDigestEnabled,
    emailDigestFrequency:
      row?.email_digest_frequency === "daily" ? "daily" : "weekly",
    emailDigestLastSentAt: row?.email_digest_last_sent_at ?? null,
  };
}

function readBoolean(
  source: Record<string, unknown>,
  key: string,
  fallback: boolean
) {
  return typeof source[key] === "boolean" ? Boolean(source[key]) : fallback;
}

async function requireRoomAccess(
  service: ServiceClient,
  roomId: string,
  userId: string
) {
  const access = await getRoomAccess(service, roomId, userId).catch(() => null);
  if (!access) {
    return { access: null, response: jsonError("Room not found.", 404) };
  }
  if (!access.allowed && !access.isOwner) {
    return {
      access: null,
      response: jsonError(
        "Active Room membership is required.",
        403,
        "room_membership_required"
      ),
    };
  }
  return { access, response: null };
}

const SELECT_COLUMNS =
  "muted, new_discussions_enabled, announcements_enabled, events_enabled, email_digest_enabled, email_digest_frequency, email_digest_last_sent_at";

export async function GET(request: NextRequest, context: RouteContext) {
  const authorized = await authorize(request);
  if (!authorized.ok) return authorized.response;

  const { roomId } = await context.params;
  if (!validUuid(roomId)) return jsonError("Invalid Room id.", 400);

  const verified = await requireRoomAccess(
    authorized.service,
    roomId,
    authorized.userId
  );
  if (!verified.access) return verified.response;

  const result = await authorized.service
    .from("room_notification_preferences")
    .select(SELECT_COLUMNS)
    .eq("room_id", roomId)
    .eq("user_id", authorized.userId)
    .maybeSingle();

  if (result.error) {
    return jsonError(
      result.error.message ||
        "Room notification preferences could not be loaded.",
      503,
      "room_notification_preferences_unavailable"
    );
  }

  return json({
    room: {
      id: verified.access.room.id,
      name: verified.access.room.name,
      roomType: verified.access.room.roomType,
    },
    preferences: normalize((result.data ?? null) as PreferenceRow | null),
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const authorized = await authorize(request);
  if (!authorized.ok) return authorized.response;

  const { roomId } = await context.params;
  if (!validUuid(roomId)) return jsonError("Invalid Room id.", 400);

  const verified = await requireRoomAccess(
    authorized.service,
    roomId,
    authorized.userId
  );
  if (!verified.access) return verified.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonError("Invalid Room notification preference payload.", 400);
  }

  const source = body as Record<string, unknown>;
  const normalized = {
    inAppEnabled: readBoolean(
      source,
      "inAppEnabled",
      DEFAULTS.inAppEnabled
    ),
    newDiscussionsEnabled: readBoolean(
      source,
      "newDiscussionsEnabled",
      DEFAULTS.newDiscussionsEnabled
    ),
    announcementsEnabled: readBoolean(
      source,
      "announcementsEnabled",
      DEFAULTS.announcementsEnabled
    ),
    eventsEnabled: readBoolean(
      source,
      "eventsEnabled",
      DEFAULTS.eventsEnabled
    ),
    emailDigestEnabled: readBoolean(
      source,
      "emailDigestEnabled",
      DEFAULTS.emailDigestEnabled
    ),
    emailDigestFrequency:
      source.emailDigestFrequency === "daily" ? "daily" : "weekly",
  };

  const upsert = await authorized.service
    .from("room_notification_preferences")
    .upsert(
      {
        room_id: roomId,
        user_id: authorized.userId,
        muted: !normalized.inAppEnabled,
        new_discussions_enabled: normalized.newDiscussionsEnabled,
        announcements_enabled: normalized.announcementsEnabled,
        events_enabled: normalized.eventsEnabled,
        email_digest_enabled: normalized.emailDigestEnabled,
        email_digest_frequency: normalized.emailDigestFrequency,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "room_id,user_id" }
    )
    .select(SELECT_COLUMNS)
    .single();

  if (upsert.error) {
    return jsonError(
      upsert.error.message ||
        "Room notification preferences could not be saved.",
      503,
      "room_notification_preferences_unavailable"
    );
  }

  await logAuditEvent({
    actor_id: authorized.userId,
    action: "room.notification_preferences_updated",
    target_type: "room",
    target_id: roomId,
    metadata: {
      muted: !normalized.inAppEnabled,
      new_discussions_enabled: normalized.newDiscussionsEnabled,
      announcements_enabled: normalized.announcementsEnabled,
      events_enabled: normalized.eventsEnabled,
      email_digest_enabled: normalized.emailDigestEnabled,
      email_digest_frequency: normalized.emailDigestFrequency,
    },
  });

  return json({
    room: {
      id: verified.access.room.id,
      name: verified.access.room.name,
      roomType: verified.access.room.roomType,
    },
    preferences: normalize((upsert.data ?? null) as PreferenceRow | null),
  });
}
