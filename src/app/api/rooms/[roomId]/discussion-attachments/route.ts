import { NextResponse, type NextRequest } from "next/server";
import { logAuditEvent } from "@/lib/audit-log";
import {
  asString,
  createRequestSupabase,
  createRoomServiceSupabase,
  getRoomAccess,
  type RoomAccess,
  type RoomRow,
} from "@/lib/room-operations";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import {
  getAttachmentKindForMimeType,
  getVideoContextLimitsForEntitlement,
  MAX_DISCUSSION_ATTACHMENTS,
  NON_VIDEO_ATTACHMENT_MAX_SIZE_BYTES,
} from "@/lib/video-context-limits";

const BUCKET = "room-post-attachments";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

type RouteContext = { params: Promise<{ roomId: string }> };
type ServiceClient = ReturnType<typeof createRoomServiceSupabase>;
type TargetType = "post" | "reply";

type Target = {
  targetType: TargetType;
  targetId: string;
  postId: string;
  replyId: string | null;
  authorId: string;
  post: RoomRow;
};

type Entitlement = {
  tier: string | null;
  ai_assisted_enabled: boolean | null;
  monthly_summary_limit: number | null;
};

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function error(message: string, status: number, code?: string) {
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

function cleanFileName(value: unknown) {
  return (
    String(value ?? "")
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 120) || "upload"
  );
}

async function authorize(request: NextRequest) {
  try {
    const account = await verifyRequestAccountAccess(createRequestSupabase(request));
    if (!account.ok) {
      return { ok: false as const, response: error(account.error, account.status, account.code) };
    }
    return {
      ok: true as const,
      userId: account.user.id,
      service: createRoomServiceSupabase(),
    };
  } catch {
    return {
      ok: false as const,
      response: error("Rooms service is not configured.", 500),
    };
  }
}

async function canViewPost(
  service: ServiceClient,
  access: RoomAccess,
  post: RoomRow,
  userId: string
) {
  if (asString(post.visibility_scope) !== "author_and_staff") return access.allowed;
  if (asString(post.author_id) === userId || access.canModerate) return true;
  const participant = await service
    .from("room_post_participants")
    .select("post_id")
    .eq("room_id", access.room.id)
    .eq("post_id", asString(post.id))
    .eq("user_id", userId)
    .maybeSingle();
  if (participant.error) throw new Error(participant.error.message);
  return Boolean(participant.data);
}

async function loadTarget(
  service: ServiceClient,
  access: RoomAccess,
  roomId: string,
  targetType: TargetType,
  targetId: string,
  userId: string
): Promise<Target | null> {
  if (targetType === "post") {
    const result = await service
      .from("room_posts")
      .select("id, room_id, author_id, status, visibility_scope, deleted_at")
      .eq("room_id", roomId)
      .eq("id", targetId)
      .is("deleted_at", null)
      .maybeSingle();
    if (result.error) throw new Error(result.error.message);
    const post = (result.data ?? null) as RoomRow | null;
    if (!post || !(await canViewPost(service, access, post, userId))) return null;
    return {
      targetType,
      targetId,
      postId: targetId,
      replyId: null,
      authorId: asString(post.author_id),
      post,
    };
  }

  const replyResult = await service
    .from("room_post_replies")
    .select("id, room_id, post_id, author_id, deleted_at")
    .eq("room_id", roomId)
    .eq("id", targetId)
    .is("deleted_at", null)
    .maybeSingle();
  if (replyResult.error) throw new Error(replyResult.error.message);
  const reply = (replyResult.data ?? null) as RoomRow | null;
  if (!reply) return null;

  const postId = asString(reply.post_id);
  const postResult = await service
    .from("room_posts")
    .select("id, room_id, author_id, status, visibility_scope, deleted_at")
    .eq("room_id", roomId)
    .eq("id", postId)
    .is("deleted_at", null)
    .maybeSingle();
  if (postResult.error) throw new Error(postResult.error.message);
  const post = (postResult.data ?? null) as RoomRow | null;
  if (!post || !(await canViewPost(service, access, post, userId))) return null;

  return {
    targetType,
    targetId,
    postId,
    replyId: targetId,
    authorId: asString(reply.author_id),
    post,
  };
}

function targetFilter(query: any, target: Target) {
  return target.targetType === "post"
    ? query.eq("post_id", target.targetId).is("reply_id", null)
    : query.eq("reply_id", target.targetId);
}

async function existingAttachments(service: ServiceClient, target: Target) {
  const query = service
    .from("room_post_attachments")
    .select("id, kind")
    .eq("room_id", target.post.room_id as string);
  const result = await targetFilter(query, target);
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? []) as RoomRow[];
}

function validateFile(input: {
  fileName: string;
  mimeType: string;
  fileSize: number;
  requestedKind: string;
  videoDurationSeconds: number;
}) {
  const inferredKind = getAttachmentKindForMimeType(input.mimeType);
  const normalizedKind = inferredKind === "pdf" ? "file" : inferredKind;
  if (!normalizedKind || normalizedKind !== input.requestedKind) {
    throw new Error("Choose an allowed image, PDF, MP4, MOV, or WebM file.");
  }
  if (!Number.isFinite(input.fileSize) || input.fileSize <= 0) {
    throw new Error("Attachment size must be greater than 0 bytes.");
  }
  if (normalizedKind !== "video" && input.fileSize > NON_VIDEO_ATTACHMENT_MAX_SIZE_BYTES) {
    throw new Error("Images and PDFs must be 10 MB or less.");
  }
  if (
    normalizedKind === "video" &&
    (!Number.isFinite(input.videoDurationSeconds) || input.videoDurationSeconds <= 0)
  ) {
    throw new Error("Unable to read the selected video duration.");
  }
  return normalizedKind as "image" | "video" | "file";
}

async function videoLimits(service: ServiceClient, userId: string) {
  const [profileResult, entitlementResult] = await Promise.all([
    service.from("profiles").select("is_admin").eq("id", userId).maybeSingle(),
    service
      .from("user_ai_entitlements")
      .select("tier, ai_assisted_enabled, monthly_summary_limit")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  if (profileResult.error) throw new Error(profileResult.error.message);
  if (entitlementResult.error) throw new Error(entitlementResult.error.message);
  const isAdmin = Boolean((profileResult.data as RoomRow | null)?.is_admin);
  return getVideoContextLimitsForEntitlement(
    (entitlementResult.data ?? null) as Entitlement | null,
    isAdmin
  );
}

async function validateVideoQuota(
  service: ServiceClient,
  userId: string,
  fileSize: number,
  duration: number
) {
  const limits = await videoLimits(service, userId);
  const normalizedDuration = Math.ceil(duration);
  if (normalizedDuration > limits.maxDurationSeconds) {
    throw new Error(
      `${limits.label} videos can be up to ${limits.maxDurationSeconds} seconds.`
    );
  }
  if (fileSize > limits.maxFileSizeBytes) {
    throw new Error(
      `${limits.label} videos must be ${Math.round(
        limits.maxFileSizeBytes / (1024 * 1024)
      )} MB or less.`
    );
  }

  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  ).toISOString();
  const [publicUsage, roomUsage] = await Promise.all([
    service
      .from("discussion_video_upload_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", monthStart),
    service
      .from("room_video_upload_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", monthStart),
  ]);
  if (publicUsage.error || roomUsage.error) {
    throw new Error("Video Context limit service is not configured.");
  }
  const usage = (publicUsage.count ?? 0) + (roomUsage.count ?? 0);
  if (usage >= limits.monthlyUploadLimit) {
    throw new Error(
      `You have reached your ${limits.label} Video Context limit of ${limits.monthlyUploadLimit} videos this month.`
    );
  }
  return { limits, normalizedDuration };
}

export async function GET(request: NextRequest, context: RouteContext) {
  const authorized = await authorize(request);
  if (!authorized.ok) return authorized.response;
  const { roomId } = await context.params;
  if (!validUuid(roomId)) return error("Invalid Room id.", 400);
  const targetType = request.nextUrl.searchParams.get("targetType");
  const targetId = request.nextUrl.searchParams.get("targetId");
  if ((targetType !== "post" && targetType !== "reply") || !validUuid(targetId)) {
    return error("Choose a valid Room discussion or reply.", 400);
  }

  try {
    const access = await getRoomAccess(authorized.service, roomId, authorized.userId);
    if (!access?.allowed || !access.role) return error("Active Room membership is required.", 403);
    const target = await loadTarget(
      authorized.service,
      access,
      roomId,
      targetType,
      targetId,
      authorized.userId
    );
    if (!target) return error("Room discussion item not found.", 404);

    const baseQuery = authorized.service
      .from("room_post_attachments")
      .select(
        "id, storage_path, file_name, mime_type, file_size, kind, video_duration_seconds, created_at"
      )
      .eq("room_id", roomId)
      .order("created_at", { ascending: true });
    const result = await targetFilter(baseQuery, target);
    if (result.error) throw new Error(result.error.message);
    const rows = (result.data ?? []) as RoomRow[];
    const attachments = await Promise.all(
      rows.map(async (row) => {
        const storagePath = asString(row.storage_path);
        const signed = await authorized.service.storage
          .from(BUCKET)
          .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
        return {
          id: asString(row.id),
          fileName: asString(row.file_name),
          mimeType: asString(row.mime_type) || null,
          fileSize: Number(row.file_size) || null,
          kind: ["image", "video"].includes(asString(row.kind))
            ? asString(row.kind)
            : "file",
          videoDurationSeconds: Number(row.video_duration_seconds) || null,
          createdAt: asString(row.created_at) || null,
          signedUrl: signed.data?.signedUrl ?? "",
        };
      })
    );
    return json({ attachments: attachments.filter((item) => item.signedUrl) });
  } catch (cause) {
    return error(
      cause instanceof Error ? cause.message : "Room attachments could not be loaded.",
      503
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const authorized = await authorize(request);
  if (!authorized.ok) return authorized.response;
  const { roomId } = await context.params;
  if (!validUuid(roomId)) return error("Invalid Room id.", 400);
  const body = await request.json().catch(() => ({}));
  const action = asString(body.action);

  try {
    const access = await getRoomAccess(authorized.service, roomId, authorized.userId);
    if (!access?.allowed || !access.role) return error("Active Room membership is required.", 403);

    if (action === "remove") {
      const attachmentId = body.attachmentId;
      if (!validUuid(attachmentId)) return error("Invalid attachment.", 400);
      const found = await authorized.service
        .from("room_post_attachments")
        .select("id, uploader_id, storage_path")
        .eq("room_id", roomId)
        .eq("id", attachmentId)
        .maybeSingle();
      if (found.error) throw new Error(found.error.message);
      const row = (found.data ?? null) as RoomRow | null;
      if (!row) return error("Attachment not found.", 404);
      if (asString(row.uploader_id) !== authorized.userId && !access.canModerate) {
        return error("You cannot remove this attachment.", 403);
      }
      const path = asString(row.storage_path);
      if (path) await authorized.service.storage.from(BUCKET).remove([path]);
      const removed = await authorized.service
        .from("room_post_attachments")
        .delete()
        .eq("room_id", roomId)
        .eq("id", attachmentId);
      if (removed.error) throw new Error(removed.error.message);
      return json({ ok: true });
    }

    const targetType = body.targetType;
    const targetId = body.targetId;
    if ((targetType !== "post" && targetType !== "reply") || !validUuid(targetId)) {
      return error("Choose a valid Room discussion or reply.", 400);
    }
    const target = await loadTarget(
      authorized.service,
      access,
      roomId,
      targetType,
      targetId,
      authorized.userId
    );
    if (!target) return error("Room discussion item not found.", 404);
    if (target.authorId !== authorized.userId) {
      return error("Attachments can be added only to your own discussion or reply.", 403);
    }
    if (asString(target.post.status) === "resolved") {
      return error("Reopen this discussion before adding attachments.", 409);
    }

    const fileName = cleanFileName(body.fileName);
    const mimeType = asString(body.mimeType).toLowerCase();
    const fileSize = Number(body.fileSize);
    const requestedKind = asString(body.kind);
    const requestedDuration = Number(body.videoDurationSeconds);
    let kind: "image" | "video" | "file";
    try {
      kind = validateFile({
        fileName,
        mimeType,
        fileSize,
        requestedKind,
        videoDurationSeconds: requestedDuration,
      });
    } catch (cause) {
      return error(cause instanceof Error ? cause.message : "Invalid attachment.", 400);
    }

    const current = await existingAttachments(authorized.service, target);
    if (current.length >= MAX_DISCUSSION_ATTACHMENTS) {
      return error("A discussion or reply can have at most 3 attachments.", 400);
    }
    if (kind === "video" && current.some((row) => asString(row.kind) === "video")) {
      return error("A discussion or reply can have only one video.", 400);
    }

    let normalizedDuration: number | null = null;
    let contextTier: string | null = null;
    if (kind === "video") {
      try {
        const quota = await validateVideoQuota(
          authorized.service,
          authorized.userId,
          fileSize,
          requestedDuration
        );
        normalizedDuration = quota.normalizedDuration;
        contextTier = quota.limits.tier;
      } catch (cause) {
        return error(cause instanceof Error ? cause.message : "Video limit failed.", 403);
      }
    }

    if (action === "prepare") {
      const storagePath = `${roomId}/${targetType}/${targetId}/${crypto.randomUUID()}-${fileName}`;
      const signed = await authorized.service.storage
        .from(BUCKET)
        .createSignedUploadUrl(storagePath);
      if (signed.error || !signed.data?.token) {
        return error(signed.error?.message || "Secure upload could not be prepared.", 503);
      }
      return json({
        ok: true,
        bucket: BUCKET,
        storagePath,
        uploadToken: signed.data.token,
        videoContextTier: contextTier,
      });
    }

    if (action === "complete") {
      const storagePath = asString(body.storagePath);
      const requiredPrefix = `${roomId}/${targetType}/${targetId}/`;
      if (!storagePath.startsWith(requiredPrefix)) {
        return error("Attachment storage path does not match this Room item.", 400);
      }
      const insert = await authorized.service
        .from("room_post_attachments")
        .insert({
          room_id: roomId,
          post_id: target.targetType === "post" ? target.targetId : null,
          reply_id: target.replyId,
          uploader_id: authorized.userId,
          storage_bucket: BUCKET,
          storage_path: storagePath,
          file_name: String(body.fileName ?? fileName).slice(0, 255),
          mime_type: mimeType || null,
          file_size: Math.round(fileSize),
          kind,
          video_duration_seconds: normalizedDuration,
          video_context_tier: contextTier,
        })
        .select("id")
        .single();
      if (insert.error) return error(insert.error.message, 400);
      const attachmentId = asString((insert.data as RoomRow).id);

      if (kind === "video" && normalizedDuration && contextTier) {
        const limits = await videoLimits(authorized.service, authorized.userId);
        const usage = await authorized.service.from("room_video_upload_events").insert({
          user_id: authorized.userId,
          room_id: roomId,
          post_id: target.postId,
          reply_id: target.replyId,
          attachment_id: attachmentId,
          tier: contextTier,
          video_duration_seconds: normalizedDuration,
          max_duration_seconds: limits.maxDurationSeconds,
          file_size_bytes: Math.round(fileSize),
        });
        if (usage.error) {
          await authorized.service.from("room_post_attachments").delete().eq("id", attachmentId);
          await authorized.service.storage.from(BUCKET).remove([storagePath]);
          return error("Video Context usage could not be recorded.", 503);
        }
      }

      await logAuditEvent({
        actor_id: authorized.userId,
        action: "room.discussion_attachment_created",
        target_type: target.targetType === "post" ? "room_post" : "room_post_reply",
        target_id: target.targetId,
        metadata: { room_id: roomId, attachment_id: attachmentId, kind },
      });
      return json({ ok: true, id: attachmentId }, 201);
    }

    return error("Unsupported attachment action.", 400);
  } catch (cause) {
    return error(
      cause instanceof Error ? cause.message : "Room attachment action failed.",
      503
    );
  }
}
