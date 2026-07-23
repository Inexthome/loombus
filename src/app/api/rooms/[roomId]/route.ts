import { NextResponse, type NextRequest } from "next/server";
import { logAuditEvent } from "@/lib/audit-log";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import {
  asBoolean,
  asString,
  createRequestSupabase,
  createRoomServiceSupabase,
  getRoomAccess,
  loadProfiles,
  normalizeRole,
  profileFor,
  type RoomRow,
} from "@/lib/room-operations";

const POST_LIMIT = 100;
const EVENT_LIMIT = 100;
const ANNOUNCEMENT_LIMIT = 50;
const MEMBER_LIMIT = 250;
const APPLICATION_LIMIT = 100;
const VALID_ROLES = new Set(["administrator", "moderator", "member"]);

type RouteContext = {
  params: Promise<{ roomId: string }>;
};

type AuthorizedContext =
  | {
      ok: true;
      userId: string;
      serviceSupabase: ReturnType<typeof createRoomServiceSupabase>;
    }
  | {
      ok: false;
      response: NextResponse;
    };

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json(code ? { error: message, code } : { error: message }, {
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

async function authorize(request: NextRequest): Promise<AuthorizedContext> {
  try {
    const requestSupabase = createRequestSupabase(request);
    const accountAccess = await verifyRequestAccountAccess(requestSupabase);

    if (!accountAccess.ok) {
      return {
        ok: false,
        response: jsonError(
          accountAccess.error,
          accountAccess.status,
          accountAccess.code
        ),
      };
    }

    return {
      ok: true,
      userId: accountAccess.user.id,
      serviceSupabase: createRoomServiceSupabase(),
    };
  } catch {
    return {
      ok: false,
      response: jsonError("Rooms service is not configured.", 500),
    };
  }
}

function formatMember(row: RoomRow, isOwner: boolean) {
  const userId = asString(row.user_id);
  return {
    id: asString(row.id) || `${asString(row.room_id)}:${userId}`,
    userId,
    role: normalizeRole(row.role, isOwner),
    status: asString(row.status) || "active",
    joinedAt:
      asString(row.joined_at) ||
      asString(row.created_at) ||
      asString(row.updated_at) ||
      null,
  };
}

export async function GET(request: NextRequest, context: RouteContext) {
  const authorized = await authorize(request);
  if (!authorized.ok) return authorized.response;

  const { roomId } = await context.params;
  if (!validUuid(roomId)) return jsonError("Invalid room id.", 400);

  const { userId, serviceSupabase } = authorized;
  let access;

  try {
    access = await getRoomAccess(serviceSupabase, roomId, userId);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Unable to verify room access.",
      503,
      "rooms_storage_unavailable"
    );
  }

  if (!access) return jsonError("Room not found.", 404);

  if (!access.allowed) {
    const applicationResult = await serviceSupabase
      .from("room_applications")
      .select("*")
      .eq("room_id", roomId)
      .eq("applicant_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (applicationResult.error) {
      return jsonError(
        applicationResult.error.message || "Unable to load room access request.",
        503,
        "rooms_storage_unavailable"
      );
    }

    const application = applicationResult.data as RoomRow | null;

    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        access: {
          allowed: false,
          role: null,
          canManage: false,
          canModerate: false,
        },
        room: null,
        application: application
          ? {
              id: asString(application.id),
              state: asString(application.state) || "pending",
              note: asString(application.note) || null,
              createdAt: asString(application.created_at) || null,
              updatedAt: asString(application.updated_at) || null,
            }
          : null,
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  const [postsResult, eventsResult, announcementsResult, membersResult] =
    await Promise.all([
      serviceSupabase
        .from("room_posts")
        .select("*")
        .eq("room_id", roomId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(POST_LIMIT),
      serviceSupabase
        .from("room_events")
        .select("*")
        .eq("room_id", roomId)
        .order("starts_at", { ascending: true })
        .limit(EVENT_LIMIT),
      serviceSupabase
        .from("room_announcements")
        .select("*")
        .eq("room_id", roomId)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(ANNOUNCEMENT_LIMIT),
      serviceSupabase
        .from("room_members")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true })
        .limit(MEMBER_LIMIT),
    ]);

  for (const result of [
    postsResult,
    eventsResult,
    announcementsResult,
    membersResult,
  ]) {
    if (result.error) {
      return jsonError(
        result.error.message || "Unable to load room workspace.",
        503,
        "rooms_storage_unavailable"
      );
    }
  }

  let applications: RoomRow[] = [];
  if (access.canManage) {
    const applicationsResult = await serviceSupabase
      .from("room_applications")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false })
      .limit(APPLICATION_LIMIT);

    if (applicationsResult.error) {
      return jsonError(
        applicationsResult.error.message || "Unable to load room requests.",
        503,
        "rooms_storage_unavailable"
      );
    }

    applications = (applicationsResult.data ?? []) as RoomRow[];
  }

  const posts = (postsResult.data ?? []) as RoomRow[];
  const events = (eventsResult.data ?? []) as RoomRow[];
  const announcements = (announcementsResult.data ?? []) as RoomRow[];
  const memberRows = (membersResult.data ?? []) as RoomRow[];
  const profiles = await loadProfiles(serviceSupabase, [
    ...memberRows.map((row) => asString(row.user_id)),
    ...posts.map((row) => asString(row.author_id)),
    ...events.map((row) => asString(row.created_by)),
    ...announcements.map((row) => asString(row.created_by)),
    ...applications.map((row) => asString(row.applicant_id)),
    access.room.ownerId,
    access.room.createdBy,
  ]);

  const members = memberRows
    .map((row) => {
      const memberUserId = asString(row.user_id);
      const isRoomOwner =
        memberUserId === access.room.ownerId ||
        memberUserId === access.room.createdBy;
      return {
        ...formatMember(row, isRoomOwner),
        profile: profileFor(profiles, memberUserId),
      };
    })
    .filter((member) => member.userId);

  if (
    access.isOwner &&
    !members.some((member) => member.userId === userId)
  ) {
    members.unshift({
      id: `owner:${userId}`,
      userId,
      role: "owner",
      status: "active",
      joinedAt: access.room.createdAt,
      profile: profileFor(profiles, userId),
    });
  }

  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      currentUserId: userId,
      access: {
        allowed: true,
        role: access.role,
        canManage: access.canManage,
        canModerate: access.canModerate,
      },
      room: {
        ...access.room,
        memberCount: members.filter(
          (member) =>
            !["blocked", "removed", "inactive"].includes(
              member.status.toLowerCase()
            )
        ).length,
      },
      posts: posts.map((row) => {
        const authorId = asString(row.author_id) || asString(row.user_id);
        return {
          id: asString(row.id),
          roomId: asString(row.room_id),
          authorId,
          title: asString(row.title) || null,
          body: asString(row.body) || asString(row.content),
          createdAt: asString(row.created_at) || null,
          updatedAt: asString(row.updated_at) || null,
          author: profileFor(profiles, authorId),
        };
      }),
      events: events.map((row) => {
        const createdBy = asString(row.created_by);
        return {
          id: asString(row.id),
          title: asString(row.title) || "Room event",
          description: asString(row.description) || null,
          location: asString(row.location) || null,
          startsAt: asString(row.starts_at),
          endsAt: asString(row.ends_at) || null,
          createdBy,
          createdAt: asString(row.created_at) || null,
          creator: profileFor(profiles, createdBy),
        };
      }),
      announcements: announcements.map((row) => {
        const createdBy = asString(row.created_by);
        return {
          id: asString(row.id),
          title: asString(row.title) || "Announcement",
          body: asString(row.body),
          priority: asString(row.priority) || "normal",
          isPinned: asBoolean(row.is_pinned),
          createdBy,
          createdAt: asString(row.created_at) || null,
          creator: profileFor(profiles, createdBy),
        };
      }),
      members,
      applications: applications.map((row) => {
        const applicantId = asString(row.applicant_id);
        return {
          id: asString(row.id),
          applicantId,
          state: asString(row.state) || "pending",
          note: asString(row.note) || null,
          createdAt: asString(row.created_at) || null,
          updatedAt: asString(row.updated_at) || null,
          applicant: profileFor(profiles, applicantId),
        };
      }),
      limits: {
        posts: POST_LIMIT,
        events: EVENT_LIMIT,
        announcements: ANNOUNCEMENT_LIMIT,
        members: MEMBER_LIMIT,
        applications: access.canManage ? APPLICATION_LIMIT : 0,
      },
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function POST(request: NextRequest, context: RouteContext) {
  const authorized = await authorize(request);
  if (!authorized.ok) return authorized.response;

  const { roomId } = await context.params;
  if (!validUuid(roomId)) return jsonError("Invalid room id.", 400);

  const body = await request.json().catch(() => null);
  const action = typeof body?.action === "string" ? body.action : "";
  const { userId, serviceSupabase } = authorized;
  let access;

  try {
    access = await getRoomAccess(serviceSupabase, roomId, userId);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Unable to verify room access.",
      503,
      "rooms_storage_unavailable"
    );
  }

  if (!access) return jsonError("Room not found.", 404);

  if (action === "request_access") {
    if (access.allowed) return jsonError("You already have room access.", 409);

    const note = typeof body?.note === "string" ? body.note.trim() : "";
    if (note.length > 1000) {
      return jsonError("Access request note is too long.", 400);
    }

    const existingResult = await serviceSupabase
      .from("room_applications")
      .select("id")
      .eq("room_id", roomId)
      .eq("applicant_id", userId)
      .maybeSingle();

    if (existingResult.error) {
      return jsonError(
        existingResult.error.message || "Unable to verify access request.",
        503
      );
    }

    const requestValues = {
      state: "pending",
      note: note || null,
      updated_at: new Date().toISOString(),
    };

    const requestResult = existingResult.data
      ? await serviceSupabase
          .from("room_applications")
          .update(requestValues)
          .eq("id", asString((existingResult.data as RoomRow).id))
      : await serviceSupabase.from("room_applications").insert({
          room_id: roomId,
          applicant_id: userId,
          ...requestValues,
        });

    if (requestResult.error) {
      return jsonError(
        requestResult.error.message || "Unable to send access request.",
        400
      );
    }

    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  if (!access.allowed || !access.role) {
    return jsonError("Room membership is required.", 403);
  }

  if (action === "create_post") {
    return jsonError(
      "Refresh this Room before creating a discussion.",
      409,
      "room_threaded_discussions_required"
    );
  }

  if (action === "create_event") {
    if (!access.canManage) {
      return jsonError("Room management access required.", 403);
    }

    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const description =
      typeof body?.description === "string" ? body.description.trim() : "";
    const location =
      typeof body?.location === "string" ? body.location.trim() : "";
    const startsAt = typeof body?.startsAt === "string" ? body.startsAt : "";
    const endsAt = typeof body?.endsAt === "string" ? body.endsAt : "";
    const startDate = new Date(startsAt);
    const endDate = endsAt ? new Date(endsAt) : null;

    if (title.length < 1 || title.length > 180) {
      return jsonError("Event title must be between 1 and 180 characters.", 400);
    }
    if (description.length > 3000 || location.length > 300) {
      return jsonError("Event details are too long.", 400);
    }
    if (!Number.isFinite(startDate.getTime())) {
      return jsonError("Choose a valid event start time.", 400);
    }
    if (endDate && (!Number.isFinite(endDate.getTime()) || endDate < startDate)) {
      return jsonError("Event end time must be after the start time.", 400);
    }

    const insertResult = await serviceSupabase
      .from("room_events")
      .insert({
        room_id: roomId,
        title,
        description: description || null,
        location: location || null,
        starts_at: startDate.toISOString(),
        ends_at: endDate?.toISOString() ?? null,
        created_by: userId,
      })
      .select("id")
      .single();

    if (insertResult.error) {
      return jsonError(
        insertResult.error.message || "Unable to create the room event.",
        400
      );
    }

    const eventId = asString((insertResult.data as RoomRow).id);
    await logAuditEvent({
      actor_id: userId,
      action: "room.event_created",
      target_type: "room_event",
      target_id: eventId,
      metadata: { room_id: roomId },
    });

    return NextResponse.json(
      { ok: true, id: eventId },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  if (action === "create_announcement") {
    if (!access.canManage) {
      return jsonError("Room management access required.", 403);
    }

    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const announcementBody =
      typeof body?.body === "string" ? body.body.trim() : "";
    const priority =
      typeof body?.priority === "string" &&
      ["normal", "important", "urgent"].includes(body.priority)
        ? body.priority
        : "normal";
    const isPinned = Boolean(body?.isPinned);

    if (title.length < 1 || title.length > 160) {
      return jsonError(
        "Announcement title must be between 1 and 160 characters.",
        400
      );
    }
    if (announcementBody.length < 1 || announcementBody.length > 5000) {
      return jsonError(
        "Announcement body must be between 1 and 5,000 characters.",
        400
      );
    }

    const insertResult = await serviceSupabase
      .from("room_announcements")
      .insert({
        room_id: roomId,
        title,
        body: announcementBody,
        priority,
        is_pinned: isPinned,
        created_by: userId,
      })
      .select("id")
      .single();

    if (insertResult.error) {
      return jsonError(
        insertResult.error.message || "Unable to publish the announcement.",
        400
      );
    }

    const announcementId = asString((insertResult.data as RoomRow).id);
    await logAuditEvent({
      actor_id: userId,
      action: "room.announcement_created",
      target_type: "room_announcement",
      target_id: announcementId,
      metadata: { room_id: roomId, priority, pinned: isPinned },
    });

    return NextResponse.json(
      { ok: true, id: announcementId },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  if (action === "review_application") {
    if (!access.canManage) {
      return jsonError("Room management access required.", 403);
    }

    const applicationId = body?.applicationId;
    const state = typeof body?.state === "string" ? body.state : "";
    if (!validUuid(applicationId) || !["approved", "declined"].includes(state)) {
      return jsonError("Invalid access-request review.", 400);
    }

    const applicationResult = await serviceSupabase
      .from("room_applications")
      .select("*")
      .eq("id", applicationId)
      .eq("room_id", roomId)
      .maybeSingle();

    if (applicationResult.error || !applicationResult.data) {
      return jsonError("Access request not found.", 404);
    }

    const application = applicationResult.data as RoomRow;
    const applicantId = asString(application.applicant_id);

    if (state === "approved") {
      const membershipResult = await serviceSupabase
        .from("room_members")
        .upsert(
          {
            room_id: roomId,
            user_id: applicantId,
            role: "member",
            status: "active",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "room_id,user_id" }
        );

      if (membershipResult.error) {
        return jsonError(
          membershipResult.error.message || "Unable to approve room membership.",
          400
        );
      }
    }

    const updateResult = await serviceSupabase
      .from("room_applications")
      .update({
        state,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", applicationId)
      .eq("room_id", roomId);

    if (updateResult.error) {
      return jsonError(
        updateResult.error.message || "Unable to review room access request.",
        400
      );
    }

    await logAuditEvent({
      actor_id: userId,
      action: "room.application_reviewed",
      target_type: "room_application",
      target_id: applicationId,
      metadata: { room_id: roomId, applicant_id: applicantId, state },
    });

    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  if (action === "update_member_role") {
    const memberId = body?.memberId;
    const nextRole = typeof body?.role === "string" ? body.role : "";
    if (!validUuid(memberId) || !VALID_ROLES.has(nextRole)) {
      return jsonError("Invalid member role update.", 400);
    }

    if (access.role !== "owner" && access.role !== "administrator") {
      return jsonError("Room management access required.", 403);
    }
    if (access.role === "administrator" && nextRole === "administrator") {
      return jsonError("Only the room owner can appoint administrators.", 403);
    }

    const memberResult = await serviceSupabase
      .from("room_members")
      .select("*")
      .eq("id", memberId)
      .eq("room_id", roomId)
      .maybeSingle();

    if (memberResult.error || !memberResult.data) {
      return jsonError("Room member not found.", 404);
    }

    const member = memberResult.data as RoomRow;
    const memberUserId = asString(member.user_id);
    if (
      memberUserId === access.room.ownerId ||
      memberUserId === access.room.createdBy
    ) {
      return jsonError("The room owner role cannot be changed here.", 400);
    }

    const currentRole = normalizeRole(member.role);
    if (access.role === "administrator" && currentRole === "administrator") {
      return jsonError("Only the room owner can manage administrators.", 403);
    }

    const storedRole = nextRole === "administrator" ? "admin" : nextRole;
    const updateResult = await serviceSupabase
      .from("room_members")
      .update({ role: storedRole, updated_at: new Date().toISOString() })
      .eq("id", memberId)
      .eq("room_id", roomId);

    if (updateResult.error) {
      return jsonError(
        updateResult.error.message || "Unable to update the member role.",
        400
      );
    }

    await logAuditEvent({
      actor_id: userId,
      action: "room.member_role_updated",
      target_type: "room_member",
      target_id: memberId,
      metadata: {
        room_id: roomId,
        member_user_id: memberUserId,
        previous_role: currentRole,
        next_role: nextRole,
      },
    });

    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  if (action === "remove_member") {
    if (!access.canManage) {
      return jsonError("Room management access required.", 403);
    }

    const memberId = body?.memberId;
    if (!validUuid(memberId)) return jsonError("Invalid room member.", 400);

    const memberResult = await serviceSupabase
      .from("room_members")
      .select("*")
      .eq("id", memberId)
      .eq("room_id", roomId)
      .maybeSingle();

    if (memberResult.error || !memberResult.data) {
      return jsonError("Room member not found.", 404);
    }

    const member = memberResult.data as RoomRow;
    const memberUserId = asString(member.user_id);
    const memberRole = normalizeRole(member.role);
    if (
      memberUserId === access.room.ownerId ||
      memberUserId === access.room.createdBy
    ) {
      return jsonError("The room owner cannot be removed.", 400);
    }
    if (access.role === "administrator" && memberRole === "administrator") {
      return jsonError("Only the room owner can remove administrators.", 403);
    }

    const updateResult = await serviceSupabase
      .from("room_members")
      .update({
        status: "removed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", memberId)
      .eq("room_id", roomId);

    if (updateResult.error) {
      return jsonError(
        updateResult.error.message || "Unable to remove the room member.",
        400
      );
    }

    await logAuditEvent({
      actor_id: userId,
      action: "room.member_removed",
      target_type: "room_member",
      target_id: memberId,
      metadata: { room_id: roomId, member_user_id: memberUserId },
    });

    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  if (action === "moderate_post") {
    if (!access.canModerate) {
      return jsonError("Room moderation access required.", 403);
    }

    const postId = body?.postId;
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
    if (!validUuid(postId)) return jsonError("Invalid room post.", 400);
    if (reason.length > 500) {
      return jsonError("Moderation reason is too long.", 400);
    }

    const updateResult = await serviceSupabase
      .from("room_posts")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
        deletion_reason: reason || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", postId)
      .eq("room_id", roomId)
      .is("deleted_at", null);

    if (updateResult.error) {
      return jsonError(
        updateResult.error.message || "Unable to moderate the room post.",
        400
      );
    }

    await logAuditEvent({
      actor_id: userId,
      action: "room.post_moderated",
      target_type: "room_post",
      target_id: postId,
      metadata: { room_id: roomId, has_reason: Boolean(reason) },
    });

    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  return jsonError("Unsupported room action.", 400);
}
