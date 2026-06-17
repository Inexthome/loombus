import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAccountEnforcementResult } from "@/lib/account-enforcement";
import { logAuditEvent } from "@/lib/audit-log";
import {
  getAttachmentKindForMimeType,
  getVideoContextLimitsForEntitlement,
  MAX_DISCUSSION_ATTACHMENTS,
  NON_VIDEO_ATTACHMENT_MAX_SIZE_BYTES,
  NON_VIDEO_ATTACHMENT_MIME_TYPES,
  VIDEO_CONTEXT_ALLOWED_MIME_TYPES,
} from "@/lib/video-context-limits";

const ATTACHMENT_BUCKET = "discussion-attachments";
const MAX_ATTACHMENT_SIZE_BYTES = NON_VIDEO_ATTACHMENT_MAX_SIZE_BYTES;
const MAX_ATTACHMENTS_PER_DISCUSSION = MAX_DISCUSSION_ATTACHMENTS;

const ALLOWED_MIME_TYPES = new Set<string>([
  ...NON_VIDEO_ATTACHMENT_MIME_TYPES,
  ...VIDEO_CONTEXT_ALLOWED_MIME_TYPES,
]);

type ProfileAccess = {
  is_admin: boolean | null;
  account_status: string | null;
  enforcement_reason: string | null;
  suspended_until: string | null;
};

type DiscussionAccess = {
  id: string;
  user_id: string;
  deleted_at: string | null;
};

type AiEntitlement = {
  tier: string | null;
  ai_assisted_enabled: boolean | null;
  monthly_summary_limit: number | null;
};

type AttachmentRow = {
  id: string;
  discussion_id: string;
  user_id: string;
  storage_bucket: string;
  storage_path: string;
  public_url: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  attachment_kind: "image" | "pdf" | "video";
  video_duration_seconds?: number | null;
  sort_order: number;
  created_at: string;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function getAttachmentKind(mimeType: string) {
  return getAttachmentKindForMimeType(mimeType);
}

function cleanFileName(value: unknown) {
  const fileName = String(value ?? "").trim().replace(/[\/\\]/g, "-");

  return fileName.slice(0, 255);
}

function cleanStoragePath(value: unknown) {
  return String(value ?? "").trim();
}

function cleanPublicUrl(value: unknown) {
  return String(value ?? "").trim().slice(0, 2048);
}

function cleanUuid(value: unknown) {
  return String(value ?? "").trim();
}

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function getSupabaseAuthClient(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  );
}

function getSupabaseServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function getAuthenticatedUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader) {
    return { user: null, token: null, error: "Unauthorized." };
  }

  const token = authHeader.replace("Bearer ", "").trim();

  if (!token) {
    return { user: null, token: null, error: "Unauthorized." };
  }

  const authSupabase = getSupabaseAuthClient(token);
  const {
    data: { user },
    error,
  } = await authSupabase.auth.getUser(token);

  if (error || !user) {
    return { user: null, token, error: "Invalid session." };
  }

  return { user, token, error: null };
}

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthenticatedUser(request);

    if (authError || !user) {
      return jsonError(authError ?? "Unauthorized.", 401);
    }

    const supabase = getSupabaseServiceClient();

    if (!supabase) {
      return jsonError("Attachment service is not configured.", 503);
    }

    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonError("Invalid attachment payload.", 400);
    }

    const source = body as Record<string, unknown>;

    const discussionId = cleanUuid(source.discussionId);
    const storagePath = cleanStoragePath(source.storagePath);
    const publicUrl = cleanPublicUrl(source.publicUrl);
    const fileName = cleanFileName(source.fileName);
    const mimeType = String(source.mimeType ?? "").trim().toLowerCase();
    const fileSizeBytes = Number(source.fileSizeBytes);
    const videoDurationSeconds = Number(source.videoDurationSeconds);
    const requestedSortOrder = Number(source.sortOrder ?? 0);
    const sortOrder = Number.isInteger(requestedSortOrder)
      ? requestedSortOrder
      : 0;
    const attachmentKind = getAttachmentKind(mimeType);

    if (!isValidUuid(discussionId)) {
      return jsonError("Invalid discussion id.", 400);
    }

    if (!storagePath || !storagePath.startsWith(`${user.id}/`)) {
      return jsonError("Invalid attachment storage path.", 400);
    }

    if (!publicUrl) {
      return jsonError("Missing attachment public URL.", 400);
    }

    if (!fileName) {
      return jsonError("Missing attachment file name.", 400);
    }

    if (!ALLOWED_MIME_TYPES.has(mimeType) || !attachmentKind) {
      return jsonError("Attachment type is not allowed.", 400);
    }

    if (!Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) {
      return jsonError("Attachment size must be greater than 0 bytes.", 400);
    }

    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 2) {
      return jsonError("Attachment sort order must be 0, 1, or 2.", 400);
    }

    const [
      { data: profile },
      { data: discussion },
      { data: existingAttachments },
      { data: entitlement },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("is_admin, account_status, enforcement_reason, suspended_until")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("discussions")
        .select("id, user_id, deleted_at")
        .eq("id", discussionId)
        .maybeSingle(),
      supabase
        .from("discussion_attachments")
        .select("id, attachment_kind")
        .eq("discussion_id", discussionId),
      supabase
        .from("user_ai_entitlements")
        .select("tier, ai_assisted_enabled, monthly_summary_limit")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    const profileAccess = (profile ?? null) as ProfileAccess | null;
    const enforcement = getAccountEnforcementResult(profileAccess);

    if (!enforcement.allowed) {
      return NextResponse.json(
        {
          error: enforcement.errorMessage,
          code: enforcement.code,
        },
        { status: 403 }
      );
    }

    const existingDiscussion = discussion as DiscussionAccess | null;

    if (!existingDiscussion || existingDiscussion.deleted_at) {
      return jsonError("Discussion not found.", 404);
    }

    const isOwner = existingDiscussion.user_id === user.id;
    const isAdmin = Boolean(profileAccess?.is_admin);

    if (!isOwner && !isAdmin) {
      return jsonError("You do not have permission to attach files to this discussion.", 403);
    }

    const attachmentRows = (existingAttachments ?? []) as Array<{
      id: string;
      attachment_kind: string | null;
    }>;

    if (attachmentRows.length >= MAX_ATTACHMENTS_PER_DISCUSSION) {
      return jsonError("A discussion can have at most 3 attachments.", 400);
    }

    let normalizedVideoDurationSeconds: number | null = null;
    const videoContextLimits = getVideoContextLimitsForEntitlement(
      (entitlement ?? null) as AiEntitlement | null,
      isAdmin
    );

    if (attachmentKind === "video") {
      const existingVideoCount = attachmentRows.filter(
        (attachment) => attachment.attachment_kind === "video"
      ).length;

      if (existingVideoCount >= 1) {
        return jsonError("A discussion can have only one Video Context.", 400);
      }

      if (
        !Number.isFinite(videoDurationSeconds) ||
        videoDurationSeconds <= 0
      ) {
        return jsonError("Unable to read video duration. Please choose a different video.", 400);
      }

      normalizedVideoDurationSeconds = Math.ceil(videoDurationSeconds);

      if (
        normalizedVideoDurationSeconds >
        videoContextLimits.maxDurationSeconds
      ) {
        return jsonError(
          `${videoContextLimits.label} videos can be up to ${videoContextLimits.maxDurationSeconds} seconds.`,
          400
        );
      }

      if (fileSizeBytes > videoContextLimits.maxFileSizeBytes) {
        return jsonError(
          `${videoContextLimits.label} videos must be ${Math.round(videoContextLimits.maxFileSizeBytes / (1024 * 1024))} MB or less.`,
          400
        );
      }

      const now = new Date();
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

      const { count: monthlyVideoCount, error: usageCountError } = await supabase
        .from("discussion_video_upload_events")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", monthStart.toISOString());

      if (usageCountError) {
        return jsonError("Video Context limit service is not configured.", 503);
      }

      if ((monthlyVideoCount ?? 0) >= videoContextLimits.monthlyUploadLimit) {
        return jsonError(
          `You have reached your ${videoContextLimits.label} Video Context limit of ${videoContextLimits.monthlyUploadLimit} videos this month.`,
          403
        );
      }
    } else if (fileSizeBytes > MAX_ATTACHMENT_SIZE_BYTES) {
      return jsonError("Image and PDF attachments must be 10 MB or less.", 400);
    }

    const { data: attachment, error: insertError } = await supabase
      .from("discussion_attachments")
      .insert({
        discussion_id: discussionId,
        user_id: user.id,
        storage_bucket: ATTACHMENT_BUCKET,
        storage_path: storagePath,
        public_url: publicUrl,
        file_name: fileName,
        mime_type: mimeType,
        file_size_bytes: Math.round(fileSizeBytes),
        attachment_kind: attachmentKind,
        video_duration_seconds: normalizedVideoDurationSeconds,
        video_context_tier: attachmentKind === "video" ? videoContextLimits.tier : null,
        sort_order: sortOrder,
        ...(attachmentKind === "video" && normalizedVideoDurationSeconds
          ? { video_duration_seconds: normalizedVideoDurationSeconds }
          : {}),
      })
      .select("id, discussion_id, user_id, storage_bucket, storage_path, public_url, file_name, mime_type, file_size_bytes, attachment_kind, video_duration_seconds, sort_order, created_at")
      .single();

    if (insertError) {
      return jsonError(insertError.message || "Unable to save attachment.", 400);
    }

    if (attachmentKind === "video" && normalizedVideoDurationSeconds) {
      const { error: usageInsertError } = await supabase
        .from("discussion_video_upload_events")
        .insert({
          user_id: user.id,
          discussion_id: discussionId,
          attachment_id: attachment.id,
          tier: videoContextLimits.tier,
          video_duration_seconds: normalizedVideoDurationSeconds,
          max_duration_seconds: videoContextLimits.maxDurationSeconds,
          file_size_bytes: Math.round(fileSizeBytes),
        });

      if (usageInsertError) {
        await supabase
          .from("discussion_attachments")
          .delete()
          .eq("id", attachment.id);

        await supabase.storage
          .from(ATTACHMENT_BUCKET)
          .remove([storagePath]);

        return jsonError("Unable to record Video Context usage.", 503);
      }
    }

    await logAuditEvent({
      actor_id: user.id,
      action: "discussion.attachment_added",
      target_type: "discussion",
      target_id: discussionId,
      metadata: {
        attachment_id: attachment.id,
        file_name: fileName,
        mime_type: mimeType,
        file_size_bytes: Math.round(fileSizeBytes),
        attachment_kind: attachmentKind,
        sort_order: sortOrder,
      },
    });

    return NextResponse.json({
      attachment: attachment as AttachmentRow,
    });
  } catch (error) {
    console.error(error);
    return jsonError("Unexpected server error.", 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthenticatedUser(request);

    if (authError || !user) {
      return jsonError(authError ?? "Unauthorized.", 401);
    }

    const supabase = getSupabaseServiceClient();

    if (!supabase) {
      return jsonError("Attachment service is not configured.", 503);
    }

    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonError("Invalid attachment delete payload.", 400);
    }

    const attachmentId = cleanUuid((body as Record<string, unknown>).attachmentId);

    if (!isValidUuid(attachmentId)) {
      return jsonError("Invalid attachment id.", 400);
    }

    const [{ data: profile }, { data: attachment }] = await Promise.all([
      supabase
        .from("profiles")
        .select("is_admin, account_status, enforcement_reason, suspended_until")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("discussion_attachments")
        .select("id, discussion_id, user_id, storage_bucket, storage_path, public_url, file_name, mime_type, file_size_bytes, attachment_kind, video_duration_seconds, sort_order, created_at")
        .eq("id", attachmentId)
        .maybeSingle(),
    ]);

    const profileAccess = (profile ?? null) as ProfileAccess | null;
    const enforcement = getAccountEnforcementResult(profileAccess);

    if (!enforcement.allowed) {
      return NextResponse.json(
        {
          error: enforcement.errorMessage,
          code: enforcement.code,
        },
        { status: 403 }
      );
    }

    const existingAttachment = attachment as AttachmentRow | null;

    if (!existingAttachment) {
      return jsonError("Attachment not found.", 404);
    }

    const { data: discussion } = await supabase
      .from("discussions")
      .select("id, user_id, deleted_at")
      .eq("id", existingAttachment.discussion_id)
      .maybeSingle();

    const existingDiscussion = discussion as DiscussionAccess | null;
    const isAttachmentOwner = existingAttachment.user_id === user.id;
    const isDiscussionOwner = existingDiscussion?.user_id === user.id;
    const isAdmin = Boolean(profileAccess?.is_admin);

    if (!isAttachmentOwner && !isDiscussionOwner && !isAdmin) {
      return jsonError("You do not have permission to delete this attachment.", 403);
    }

    const { error: deleteMetadataError } = await supabase
      .from("discussion_attachments")
      .delete()
      .eq("id", attachmentId);

    if (deleteMetadataError) {
      return jsonError(deleteMetadataError.message || "Unable to delete attachment.", 400);
    }

    const { error: storageDeleteError } = await supabase.storage
      .from(ATTACHMENT_BUCKET)
      .remove([existingAttachment.storage_path]);

    if (storageDeleteError) {
      console.error("Attachment storage delete failed:", storageDeleteError.message);
    }

    await logAuditEvent({
      actor_id: user.id,
      action: "discussion.attachment_deleted",
      target_type: "discussion",
      target_id: existingAttachment.discussion_id,
      metadata: {
        attachment_id: attachmentId,
        file_name: existingAttachment.file_name,
        storage_deleted: !storageDeleteError,
      },
    });

    return NextResponse.json({
      deleted: true,
      attachmentId,
      storageDeleted: !storageDeleteError,
    });
  } catch (error) {
    console.error(error);
    return jsonError("Unexpected server error.", 500);
  }
}
