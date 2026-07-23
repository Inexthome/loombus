import { NextResponse, type NextRequest } from "next/server";
import { logAuditEvent } from "@/lib/audit-log";
import {
  getDiscussionModeDefinition,
  parseDiscussionModeInput,
  type DiscussionMetadata,
} from "@/lib/discussion-modes";
import { createNotifications } from "@/lib/notifications";
import {
  asNumber,
  asString,
  createRequestSupabase,
  createRoomServiceSupabase,
  getRoomAccess,
  loadProfiles,
  profileFor,
  type RoomAccess,
  type RoomRow,
} from "@/lib/room-operations";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";

const POST_LIMIT = 100;
const REPLY_LIMIT = 2000;
const POST_TITLE_MAX = 160;
const POST_BODY_MAX = 5000;
const REPLY_BODY_MAX = 3000;

type RouteContext = { params: Promise<{ roomId: string }> };
type ServiceClient = ReturnType<typeof createRoomServiceSupabase>;

type Authorized =
  | { ok: true; userId: string; service: ServiceClient }
  | { ok: false; response: NextResponse };

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

function asMetadata(value: unknown): DiscussionMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, fieldValue]) => typeof fieldValue === "string")
      .map(([key, fieldValue]) => [key, String(fieldValue).trim()])
      .filter(([, fieldValue]) => fieldValue.length > 0)
  );
}

function normalizedTimestamp(value: unknown) {
  const raw = asString(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
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
      response: jsonError("Rooms service is not configured.", 500),
    };
  }
}

async function requireAccess(
  service: ServiceClient,
  roomId: string,
  userId: string
) {
  const access = await getRoomAccess(service, roomId, userId).catch(() => null);
  if (!access) {
    return { access: null, response: jsonError("Room not found.", 404) };
  }
  if (!access.allowed || !access.role) {
    return {
      access: null,
      response: jsonError("Active Room membership is required.", 403),
    };
  }
  return { access, response: null };
}

async function memberPostsAreAllowed(service: ServiceClient, roomId: string) {
  const result = await service
    .from("room_module_settings")
    .select("settings")
    .eq("room_id", roomId)
    .maybeSingle();

  if (result.error) throw new Error(result.error.message);
  const settings = (result.data as RoomRow | null)?.settings;
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return true;
  }
  const allowMemberPosts = (settings as Record<string, unknown>)
    .allowMemberPosts;
  return allowMemberPosts !== false && allowMemberPosts !== "false";
}

function canParticipate(access: RoomAccess, memberPostsAllowed: boolean) {
  return memberPostsAllowed || access.canModerate;
}

async function loadPost(
  service: ServiceClient,
  roomId: string,
  postId: string
) {
  const result = await service
    .from("room_posts")
    .select("*")
    .eq("id", postId)
    .eq("room_id", roomId)
    .is("deleted_at", null)
    .maybeSingle();
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? null) as RoomRow | null;
}

async function markThreadRead(
  service: ServiceClient,
  roomId: string,
  postId: string,
  userId: string,
  readAt = new Date().toISOString()
) {
  const result = await service.from("room_post_reads").upsert(
    {
      room_id: roomId,
      post_id: postId,
      user_id: userId,
      last_read_at: readAt,
    },
    { onConflict: "post_id,user_id" }
  );
  if (result.error) throw new Error(result.error.message);
}

async function activeParticipantIds(
  service: ServiceClient,
  access: RoomAccess,
  candidateIds: string[]
) {
  const candidates = [...new Set(candidateIds.filter(Boolean))];
  if (candidates.length === 0) return [];

  const result = await service
    .from("room_members")
    .select("user_id, status")
    .eq("room_id", access.room.id)
    .in("user_id", candidates);
  if (result.error) throw new Error(result.error.message);

  const active = new Set(
    ((result.data ?? []) as RoomRow[])
      .filter(
        (row) =>
          !["blocked", "removed", "inactive"].includes(
            asString(row.status).toLowerCase()
          )
      )
      .map((row) => asString(row.user_id))
      .filter(Boolean)
  );

  if (candidates.includes(access.room.ownerId)) active.add(access.room.ownerId);
  if (candidates.includes(access.room.createdBy)) active.add(access.room.createdBy);
  return [...active];
}

async function notifyReplyParticipants({
  service,
  access,
  post,
  actorId,
}: {
  service: ServiceClient;
  access: RoomAccess;
  post: RoomRow;
  actorId: string;
}) {
  const postId = asString(post.id);
  const replyAuthors = await service
    .from("room_post_replies")
    .select("author_id")
    .eq("post_id", postId)
    .is("deleted_at", null)
    .limit(500);
  if (replyAuthors.error) {
    console.error("Room reply participant lookup failed:", replyAuthors.error.message);
    return;
  }

  const candidates = [
    asString(post.author_id),
    ...((replyAuthors.data ?? []) as RoomRow[]).map((row) =>
      asString(row.author_id)
    ),
  ].filter((userId) => userId && userId !== actorId);

  const recipients = await activeParticipantIds(service, access, candidates).catch(
    () => []
  );
  if (recipients.length === 0) return;

  const title = asString(post.title) || "Room discussion";
  const { error } = await createNotifications(
    recipients.map((userId) => ({
      user_id: userId,
      actor_id: actorId,
      type: "room_reply",
      target_type: "room_post",
      target_id: postId,
      message: `New reply in ${access.room.name}: ${title}`,
    }))
  );
  if (error) {
    console.error("Room reply notifications failed:", error.message);
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  const authorized = await authorize(request);
  if (!authorized.ok) return authorized.response;

  const { roomId } = await context.params;
  if (!validUuid(roomId)) return jsonError("Invalid Room id.", 400);

  const { service, userId } = authorized;
  const verified = await requireAccess(service, roomId, userId);
  if (!verified.access) return verified.response;
  const access = verified.access;

  try {
    const memberPostsAllowed = await memberPostsAreAllowed(service, roomId);
    const postsResult = await service
      .from("room_posts")
      .select(
        "id, room_id, author_id, title, body, discussion_type, discussion_metadata, status, resolved_at, resolved_by, last_activity_at, reply_count, created_at, updated_at"
      )
      .eq("room_id", roomId)
      .is("deleted_at", null)
      .order("last_activity_at", { ascending: false })
      .limit(POST_LIMIT);

    if (postsResult.error) {
      return jsonError(
        postsResult.error.message || "Room discussions could not be loaded.",
        503,
        "room_discussions_storage_unavailable"
      );
    }

    const postRows = (postsResult.data ?? []) as RoomRow[];
    const postIds = postRows.map((row) => asString(row.id)).filter(Boolean);

    const [repliesResult, readsResult] = await Promise.all([
      postIds.length
        ? service
            .from("room_post_replies")
            .select(
              "id, room_id, post_id, author_id, body, created_at, updated_at"
            )
            .in("post_id", postIds)
            .is("deleted_at", null)
            .order("created_at", { ascending: true })
            .limit(REPLY_LIMIT)
        : Promise.resolve({ data: [], error: null }),
      postIds.length
        ? service
            .from("room_post_reads")
            .select("post_id, last_read_at")
            .eq("room_id", roomId)
            .eq("user_id", userId)
            .in("post_id", postIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (repliesResult.error || readsResult.error) {
      return jsonError(
        repliesResult.error?.message ||
          readsResult.error?.message ||
          "Room discussion activity could not be loaded.",
        503,
        "room_discussions_storage_unavailable"
      );
    }

    const replyRows = (repliesResult.data ?? []) as RoomRow[];
    const profiles = await loadProfiles(service, [
      ...postRows.map((row) => asString(row.author_id)),
      ...replyRows.map((row) => asString(row.author_id)),
      ...postRows.map((row) => asString(row.resolved_by)),
    ]);
    const reads = new Map(
      ((readsResult.data ?? []) as RoomRow[]).map((row) => [
        asString(row.post_id),
        normalizedTimestamp(row.last_read_at),
      ])
    );
    const repliesByPost = new Map<string, RoomRow[]>();
    for (const reply of replyRows) {
      const postId = asString(reply.post_id);
      repliesByPost.set(postId, [...(repliesByPost.get(postId) ?? []), reply]);
    }

    return json({
      generatedAt: new Date().toISOString(),
      room: {
        id: access.room.id,
        name: access.room.name,
      },
      permissions: {
        currentUserId: userId,
        canPost: canParticipate(access, memberPostsAllowed),
        canReply: canParticipate(access, memberPostsAllowed),
        canManage: access.canManage,
        canModerate: access.canModerate,
        memberPostsAllowed,
      },
      posts: postRows.map((row) => {
        const postId = asString(row.id);
        const authorId = asString(row.author_id);
        const lastActivityAt =
          normalizedTimestamp(row.last_activity_at) ??
          normalizedTimestamp(row.updated_at) ??
          normalizedTimestamp(row.created_at);
        const lastReadAt = reads.get(postId) ?? null;
        const isUnread = Boolean(
          lastActivityAt &&
            (!lastReadAt ||
              new Date(lastActivityAt).getTime() >
                new Date(lastReadAt).getTime())
        );
        const mode = getDiscussionModeDefinition(row.discussion_type).key;

        return {
          id: postId,
          roomId,
          authorId,
          author: profileFor(profiles, authorId),
          title: asString(row.title),
          body: asString(row.body),
          discussionType: mode,
          discussionMetadata: asMetadata(row.discussion_metadata),
          status: asString(row.status) === "resolved" ? "resolved" : "open",
          resolvedAt: normalizedTimestamp(row.resolved_at),
          resolvedBy: asString(row.resolved_by) || null,
          resolver: profileFor(profiles, asString(row.resolved_by)),
          lastActivityAt,
          replyCount: asNumber(row.reply_count),
          lastReadAt,
          isUnread,
          createdAt: normalizedTimestamp(row.created_at),
          updatedAt: normalizedTimestamp(row.updated_at),
          canResolve: authorId === userId || access.canManage,
          canDelete: authorId === userId || access.canModerate,
          replies: (repliesByPost.get(postId) ?? []).map((reply) => {
            const replyAuthorId = asString(reply.author_id);
            return {
              id: asString(reply.id),
              authorId: replyAuthorId,
              author: profileFor(profiles, replyAuthorId),
              body: asString(reply.body),
              createdAt: normalizedTimestamp(reply.created_at),
              updatedAt: normalizedTimestamp(reply.updated_at),
              canDelete: replyAuthorId === userId || access.canModerate,
            };
          }),
        };
      }),
    });
  } catch (error) {
    return jsonError(
      error instanceof Error
        ? error.message
        : "Room discussions could not be loaded.",
      503,
      "room_discussions_storage_unavailable"
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const authorized = await authorize(request);
  if (!authorized.ok) return authorized.response;

  const { roomId } = await context.params;
  if (!validUuid(roomId)) return jsonError("Invalid Room id.", 400);

  const body = await request.json().catch(() => null);
  const action = typeof body?.action === "string" ? body.action : "";
  const { service, userId } = authorized;
  const verified = await requireAccess(service, roomId, userId);
  if (!verified.access) return verified.response;
  const access = verified.access;

  try {
    const memberPostsAllowed = await memberPostsAreAllowed(service, roomId);
    const participationAllowed = canParticipate(access, memberPostsAllowed);

    if (action === "create_post") {
      if (!participationAllowed) {
        return jsonError(
          "Room member discussions are disabled by Room administrators.",
          403,
          "room_discussion_posting_disabled"
        );
      }

      const title = typeof body?.title === "string" ? body.title.trim() : "";
      const postBody = typeof body?.body === "string" ? body.body.trim() : "";
      if (title.length < 4 || title.length > POST_TITLE_MAX) {
        return jsonError(
          "Discussion title must be between 4 and 160 characters.",
          400
        );
      }
      if (postBody.length < 1 || postBody.length > POST_BODY_MAX) {
        return jsonError(
          "Discussion body must be between 1 and 5,000 characters.",
          400
        );
      }

      const modeResult = parseDiscussionModeInput(
        {
          discussionType: body?.discussionType,
          discussionMetadata: body?.discussionMetadata,
        },
        { requireStructuredFields: true }
      );
      if (!modeResult.ok) {
        return jsonError(modeResult.error, 400, modeResult.code);
      }

      const insertResult = await service
        .from("room_posts")
        .insert({
          room_id: roomId,
          author_id: userId,
          title,
          body: postBody,
          discussion_type: modeResult.mode,
          discussion_metadata: modeResult.metadata,
          status: "open",
          last_activity_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (insertResult.error) {
        return jsonError(
          insertResult.error.message || "Room discussion could not be created.",
          400
        );
      }

      const postId = asString((insertResult.data as RoomRow).id);
      await Promise.all([
        markThreadRead(service, roomId, postId, userId),
        service
          .from("rooms")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", roomId),
      ]);
      await logAuditEvent({
        actor_id: userId,
        action: "room.discussion_created",
        target_type: "room_post",
        target_id: postId,
        metadata: {
          room_id: roomId,
          discussion_type: modeResult.mode,
        },
      });
      return json({ ok: true, id: postId }, 201);
    }

    if (action === "create_reply") {
      if (!participationAllowed) {
        return jsonError(
          "Room member discussions are disabled by Room administrators.",
          403,
          "room_discussion_replying_disabled"
        );
      }

      const postId = body?.postId;
      const replyBody = typeof body?.body === "string" ? body.body.trim() : "";
      if (!validUuid(postId)) return jsonError("Invalid Room discussion.", 400);
      if (replyBody.length < 1 || replyBody.length > REPLY_BODY_MAX) {
        return jsonError(
          "Reply must be between 1 and 3,000 characters.",
          400
        );
      }

      const post = await loadPost(service, roomId, postId);
      if (!post) return jsonError("Room discussion not found.", 404);
      if (asString(post.status) === "resolved") {
        return jsonError(
          "This discussion is resolved. Reopen it before replying.",
          409,
          "room_discussion_resolved"
        );
      }

      const insertResult = await service
        .from("room_post_replies")
        .insert({
          room_id: roomId,
          post_id: postId,
          author_id: userId,
          body: replyBody,
        })
        .select("id, created_at")
        .single();
      if (insertResult.error) {
        return jsonError(
          insertResult.error.message || "Reply could not be posted.",
          400
        );
      }

      await markThreadRead(service, roomId, postId, userId);
      await notifyReplyParticipants({ service, access, post, actorId: userId });
      const replyId = asString((insertResult.data as RoomRow).id);
      await logAuditEvent({
        actor_id: userId,
        action: "room.discussion_replied",
        target_type: "room_post_reply",
        target_id: replyId,
        metadata: { room_id: roomId, post_id: postId },
      });
      return json({ ok: true, id: replyId }, 201);
    }

    if (action === "mark_read") {
      const postId = body?.postId;
      if (!validUuid(postId)) return jsonError("Invalid Room discussion.", 400);
      const post = await loadPost(service, roomId, postId);
      if (!post) return jsonError("Room discussion not found.", 404);
      await markThreadRead(service, roomId, postId, userId);
      return json({ ok: true });
    }

    if (action === "resolve_post" || action === "reopen_post") {
      const postId = body?.postId;
      if (!validUuid(postId)) return jsonError("Invalid Room discussion.", 400);
      const post = await loadPost(service, roomId, postId);
      if (!post) return jsonError("Room discussion not found.", 404);
      if (asString(post.author_id) !== userId && !access.canManage) {
        return jsonError(
          "Only the discussion author or Room management can change its status.",
          403
        );
      }

      const resolving = action === "resolve_post";
      const now = new Date().toISOString();
      const updateResult = await service
        .from("room_posts")
        .update({
          status: resolving ? "resolved" : "open",
          resolved_at: resolving ? now : null,
          resolved_by: resolving ? userId : null,
          last_activity_at: now,
        })
        .eq("id", postId)
        .eq("room_id", roomId)
        .is("deleted_at", null);
      if (updateResult.error) {
        return jsonError(
          updateResult.error.message || "Discussion status could not be updated.",
          400
        );
      }

      await markThreadRead(service, roomId, postId, userId);
      await logAuditEvent({
        actor_id: userId,
        action: resolving
          ? "room.discussion_resolved"
          : "room.discussion_reopened",
        target_type: "room_post",
        target_id: postId,
        metadata: { room_id: roomId },
      });
      return json({ ok: true });
    }

    if (action === "delete_post") {
      const postId = body?.postId;
      if (!validUuid(postId)) return jsonError("Invalid Room discussion.", 400);
      const post = await loadPost(service, roomId, postId);
      if (!post) return jsonError("Room discussion not found.", 404);
      if (asString(post.author_id) !== userId && !access.canModerate) {
        return jsonError(
          "Only the discussion author or Room moderation can remove it.",
          403
        );
      }
      const reason =
        typeof body?.reason === "string" ? body.reason.trim().slice(0, 500) : "";
      const updateResult = await service
        .from("room_posts")
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: userId,
          deletion_reason: reason || null,
        })
        .eq("id", postId)
        .eq("room_id", roomId);
      if (updateResult.error) {
        return jsonError(
          updateResult.error.message || "Discussion could not be removed.",
          400
        );
      }
      await logAuditEvent({
        actor_id: userId,
        action: "room.discussion_removed",
        target_type: "room_post",
        target_id: postId,
        metadata: { room_id: roomId, reason: reason || null },
      });
      return json({ ok: true });
    }

    if (action === "delete_reply") {
      const replyId = body?.replyId;
      if (!validUuid(replyId)) return jsonError("Invalid Room reply.", 400);
      const replyResult = await service
        .from("room_post_replies")
        .select("*")
        .eq("id", replyId)
        .eq("room_id", roomId)
        .is("deleted_at", null)
        .maybeSingle();
      if (replyResult.error || !replyResult.data) {
        return jsonError("Room reply not found.", 404);
      }
      const reply = replyResult.data as RoomRow;
      if (asString(reply.author_id) !== userId && !access.canModerate) {
        return jsonError(
          "Only the reply author or Room moderation can remove it.",
          403
        );
      }
      const reason =
        typeof body?.reason === "string" ? body.reason.trim().slice(0, 500) : "";
      const updateResult = await service
        .from("room_post_replies")
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: userId,
          deletion_reason: reason || null,
        })
        .eq("id", replyId)
        .eq("room_id", roomId);
      if (updateResult.error) {
        return jsonError(
          updateResult.error.message || "Reply could not be removed.",
          400
        );
      }
      await logAuditEvent({
        actor_id: userId,
        action: "room.discussion_reply_removed",
        target_type: "room_post_reply",
        target_id: replyId,
        metadata: {
          room_id: roomId,
          post_id: asString(reply.post_id),
          reason: reason || null,
        },
      });
      return json({ ok: true });
    }

    return jsonError("Unsupported Room discussion action.", 400);
  } catch (error) {
    return jsonError(
      error instanceof Error
        ? error.message
        : "The Room discussion action could not be completed.",
      503,
      "room_discussions_storage_unavailable"
    );
  }
}
