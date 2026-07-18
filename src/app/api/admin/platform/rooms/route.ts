import { NextRequest, NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/audit-log";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import {
  asString,
  createRequestSupabase,
  createRoomServiceSupabase,
} from "@/lib/room-operations";

type Row = Record<string, unknown>;

class RoomsAdminError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "rooms_admin_error"
  ) {
    super(message);
  }
}

function response(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function errorResponse(error: unknown) {
  if (error instanceof RoomsAdminError) {
    return response(
      { error: error.message, code: error.code },
      error.status
    );
  }

  console.error("Rooms administrator request failed:", error);

  return response(
    {
      error: "Rooms administration could not complete this request.",
      code: "rooms_admin_failed",
    },
    500
  );
}

function validUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function text(value: unknown, maximum = 2000) {
  return typeof value === "string"
    ? value.trim().slice(0, maximum)
    : "";
}

function iso(value: unknown) {
  const raw = asString(value);
  if (!raw) return null;

  const date = new Date(raw);
  return Number.isFinite(date.getTime())
    ? date.toISOString()
    : null;
}

function displayName(profile: Row | undefined) {
  return (
    text(profile?.full_name, 200) ||
    text(profile?.username, 100) ||
    "Loombus member"
  );
}

async function requireAdministrator(request: NextRequest) {
  const access = await verifyRequestAccountAccess(
    createRequestSupabase(request)
  );

  if (!access.ok) {
    throw new RoomsAdminError(
      access.error,
      access.status,
      access.code ?? "account_access_denied"
    );
  }

  if (access.profile.is_admin !== true) {
    throw new RoomsAdminError(
      "Administrator access is required.",
      403,
      "administrator_required"
    );
  }

  return {
    administratorId: access.user.id,
    service: createRoomServiceSupabase(),
  };
}

function increment(
  counts: Map<string, number>,
  key: unknown
) {
  const normalized = asString(key);
  if (!normalized) return;
  counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
}

export async function GET(request: NextRequest) {
  try {
    const { service } = await requireAdministrator(request);

    const roomsResult = await service
      .from("rooms")
      .select(
        [
          "id",
          "name",
          "description",
          "room_type",
          "status",
          "owner_id",
          "created_by",
          "subscription_plan",
          "subscription_status",
          "member_limit",
          "invite_only",
          "created_at",
          "updated_at",
          "archived_at",
          "deletion_scheduled_for",
          "stripe_customer_id",
          "stripe_subscription_id",
          "stripe_current_period_end",
        ].join(",")
      )
      .order("updated_at", { ascending: false })
      .limit(250);

    if (roomsResult.error) {
      throw new RoomsAdminError(
        roomsResult.error.message ||
          "Unable to load Rooms.",
        503,
        "rooms_unavailable"
      );
    }

    const roomRows = (roomsResult.data ?? []) as unknown as Row[];
    const roomIds = roomRows
      .map((row) => asString(row.id))
      .filter(Boolean);

    const emptyResult = {
      data: [] as Row[],
      error: null,
    };

    const [
      membersResult,
      applicationsResult,
      reportsResult,
    ] = roomIds.length
      ? await Promise.all([
          service
            .from("room_members")
            .select(
              "room_id,user_id,status,suspended_until"
            )
            .in("room_id", roomIds)
            .limit(10000),
          service
            .from("room_applications")
            .select("room_id,state")
            .in("room_id", roomIds)
            .eq("state", "pending")
            .limit(10000),
          service
            .from("room_moderation_reports")
            .select("*")
            .in("room_id", roomIds)
            .eq("state", "pending")
            .order("created_at", { ascending: false })
            .limit(500),
        ])
      : [emptyResult, emptyResult, emptyResult];

    const detailError =
      membersResult.error ||
      applicationsResult.error ||
      reportsResult.error;

    if (detailError) {
      throw new RoomsAdminError(
        detailError.message ||
          "Unable to load Room operations.",
        503,
        "room_operations_unavailable"
      );
    }

    const memberCounts = new Map<string, number>();
    const activeMemberships = new Set<string>();
    const pendingApplications = new Map<string, number>();
    const openReports = new Map<string, number>();

    for (const row of (membersResult.data ?? []) as unknown as Row[]) {
      const status =
        asString(row.status).toLowerCase() || "active";
      const suspendedUntil = iso(row.suspended_until);
      const suspended =
        suspendedUntil !== null &&
        new Date(suspendedUntil).getTime() > Date.now();

      if (
        !["blocked", "removed", "inactive"].includes(
          status
        ) &&
        !suspended
      ) {
        const roomId = asString(row.room_id);
        const userId = asString(row.user_id);
        increment(memberCounts, roomId);
        if (roomId && userId) {
          activeMemberships.add(`${roomId}:${userId}`);
        }
      }
    }

    for (const row of
      (applicationsResult.data ?? []) as unknown as Row[]) {
      increment(pendingApplications, row.room_id);
    }

    for (const row of
      (reportsResult.data ?? []) as unknown as Row[]) {
      increment(openReports, row.room_id);
    }

    const ownerIds = roomRows
      .map(
        (row) =>
          asString(row.owner_id) ||
          asString(row.created_by)
      )
      .filter(Boolean);

    const reporterIds = (
      (reportsResult.data ?? []) as unknown as Row[]
    )
      .map((row) => asString(row.reporter_id))
      .filter(Boolean);

    const profileIds = [
      ...new Set([...ownerIds, ...reporterIds]),
    ];

    const profilesResult = profileIds.length
      ? await service
          .from("profiles")
          .select(
            "id,username,full_name,account_status"
          )
          .in("id", profileIds)
      : emptyResult;

    if (profilesResult.error) {
      throw new RoomsAdminError(
        profilesResult.error.message ||
          "Unable to load Room account details.",
        503,
        "room_profiles_unavailable"
      );
    }

    const profiles = new Map<string, Row>(
      ((profilesResult.data ?? []) as unknown as Row[]).map(
        (profile) => [
          asString(profile.id),
          profile,
        ]
      )
    );

    const rooms = roomRows.map((row) => {
      const roomId = asString(row.id);
      const ownerId =
        asString(row.owner_id) ||
        asString(row.created_by);
      const owner = profiles.get(ownerId);

      return {
        id: roomId,
        name:
          text(row.name, 240) ||
          "Untitled Room",
        description: text(row.description, 1000),
        roomType:
          text(row.room_type, 80) || "community",
        status: text(row.status, 60) || "active",
        ownerId,
        owner: {
          id: ownerId,
          displayName: displayName(owner),
          username:
            text(owner?.username, 100) || null,
          accountStatus:
            text(owner?.account_status, 60) ||
            null,
        },
        subscriptionPlan:
          text(row.subscription_plan, 60) ||
          "free",
        subscriptionStatus:
          text(row.subscription_status, 60) ||
          "active",
        memberLimit:
          row.member_limit === null ||
          row.member_limit === undefined
            ? null
            : Number(row.member_limit),
        memberCount:
          (memberCounts.get(roomId) ?? 0) +
          (ownerId &&
          !activeMemberships.has(
            `${roomId}:${ownerId}`
          )
            ? 1
            : 0),
        pendingApplications:
          pendingApplications.get(roomId) ?? 0,
        openReports:
          openReports.get(roomId) ?? 0,
        hasStripeCustomer: Boolean(
          asString(row.stripe_customer_id)
        ),
        hasStripeSubscription: Boolean(
          asString(row.stripe_subscription_id)
        ),
        currentPeriodEnd: iso(
          row.stripe_current_period_end
        ),
        archivedAt: iso(row.archived_at),
        deletionScheduledFor: iso(
          row.deletion_scheduled_for
        ),
        createdAt: iso(row.created_at),
        updatedAt: iso(row.updated_at),
      };
    });

    const roomById = new Map(
      rooms.map((room) => [room.id, room])
    );

    const reports = (
      (reportsResult.data ?? []) as unknown as Row[]
    ).map((row) => {
      const roomId = asString(row.room_id);
      const reporterId = asString(row.reporter_id);
      const reporter = profiles.get(reporterId);

      return {
        id: asString(row.id),
        roomId,
        roomName:
          roomById.get(roomId)?.name ||
          "Private Room",
        reporter: {
          id: reporterId,
          displayName: displayName(reporter),
          username:
            text(reporter?.username, 100) || null,
        },
        targetType: text(row.target_type, 80),
        targetId: asString(row.target_id),
        targetLabel:
          text(row.target_label, 240) ||
          "Reported Room item",
        targetSnapshot: text(
          row.target_snapshot,
          2000
        ),
        reason: text(row.reason, 120),
        details: text(row.details, 2000),
        state: text(row.state, 40) || "pending",
        createdAt: iso(row.created_at),
      };
    });

    const billingAttentionStatuses = new Set([
      "past_due",
      "unpaid",
      "canceled",
      "cancelled",
      "incomplete",
      "incomplete_expired",
      "paused",
    ]);

    return response({
      isAdmin: true,
      generatedAt: new Date().toISOString(),
      metrics: {
        totalRooms: rooms.length,
        activeRooms: rooms.filter(
          (room) => room.status === "active"
        ).length,
        archivedRooms: rooms.filter(
          (room) => room.status === "archived"
        ).length,
        pendingDeletion: rooms.filter(
          (room) =>
            room.status === "pending_deletion"
        ).length,
        openReports: reports.length,
        pendingApplications: [
          ...pendingApplications.values(),
        ].reduce((total, value) => total + value, 0),
        billingAttention: rooms.filter((room) =>
          billingAttentionStatuses.has(
            room.subscriptionStatus.toLowerCase()
          )
        ).length,
      },
      rooms,
      reports,
      boundaries: {
        privateContentLoaded: false,
        roomSuspensionAvailable: false,
        ownershipTransferAvailable: false,
        billingMutationAvailable: false,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { administratorId, service } =
      await requireAdministrator(request);

    const body = await request
      .json()
      .catch(() => null);

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      throw new RoomsAdminError(
        "Invalid Rooms administrator request.",
        400,
        "invalid_payload"
      );
    }

    const input = body as Record<string, unknown>;
    const action = text(input.action, 80);

    if (action !== "review_report") {
      throw new RoomsAdminError(
        "Unsupported Rooms administrator action.",
        400,
        "unsupported_action"
      );
    }

    const reportId = text(input.reportId, 60);
    const decision = text(input.decision, 40);
    const note = text(input.note, 2000);

    if (!validUuid(reportId)) {
      throw new RoomsAdminError(
        "Invalid Room report id.",
        400,
        "invalid_report_id"
      );
    }

    if (!["resolve", "dismiss"].includes(decision)) {
      throw new RoomsAdminError(
        "Choose Resolve or Dismiss.",
        400,
        "invalid_report_decision"
      );
    }

    const reportResult = await service
      .from("room_moderation_reports")
      .select(
        "id,room_id,target_type,target_id,reason,state"
      )
      .eq("id", reportId)
      .maybeSingle();

    if (reportResult.error) {
      throw new RoomsAdminError(
        reportResult.error.message ||
          "Unable to verify the Room report.",
        503,
        "room_report_unavailable"
      );
    }

    if (!reportResult.data) {
      throw new RoomsAdminError(
        "Room report not found.",
        404,
        "room_report_not_found"
      );
    }

    if (reportResult.data.state !== "pending") {
      throw new RoomsAdminError(
        "This Room report has already been reviewed.",
        409,
        "room_report_already_reviewed"
      );
    }

    const nextState =
      decision === "resolve"
        ? "resolved"
        : "dismissed";
    const now = new Date().toISOString();

    const updateResult = await service
      .from("room_moderation_reports")
      .update({
        state: nextState,
        resolution_note: note,
        resolved_by: administratorId,
        resolved_at: now,
        updated_at: now,
      })
      .eq("id", reportId)
      .eq("state", "pending")
      .select("id")
      .maybeSingle();

    if (updateResult.error) {
      throw new RoomsAdminError(
        updateResult.error.message ||
          "Unable to review the Room report.",
        503,
        "room_report_review_failed"
      );
    }

    if (!updateResult.data) {
      throw new RoomsAdminError(
        "This Room report changed before the decision was saved. Refresh and review its current state.",
        409,
        "room_report_changed"
      );
    }

    await logAuditEvent({
      actor_id: administratorId,
      action:
        decision === "resolve"
          ? "admin.room_report_resolved"
          : "admin.room_report_dismissed",
      target_type: "room_moderation_report",
      target_id: reportId,
      metadata: {
        room_id: reportResult.data.room_id,
        target_type:
          reportResult.data.target_type,
        target_id: reportResult.data.target_id,
        reason: reportResult.data.reason,
        decision,
        note: note || null,
      },
    });

    return response({
      reviewed: true,
      state: nextState,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
