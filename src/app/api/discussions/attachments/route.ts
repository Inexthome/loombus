import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAccountEnforcementResult } from "@/lib/account-enforcement";
import { getResolvedGeneralSubscriptionForUser } from "@/lib/general-subscriptions";
import { logAuditEvent } from "@/lib/audit-log";
import {
  getAttachmentKindForMimeType,
  getVideoContextLimitsForPlan,
  MAX_DISCUSSION_ATTACHMENTS,
  NON_VIDEO_ATTACHMENT_MAX_SIZE_BYTES,
  NON_VIDEO_ATTACHMENT_MIME_TYPES,
  VIDEO_CONTEXT_ALLOWED_MIME_TYPES,
} from "@/lib/video-context-limits";

const PUBLIC_BUCKET = "discussion-attachments";
const PROTECTED_BUCKET = "discussion-attachments-protected";
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
  audience_type: string | null;
  deleted_at: string | null;
};

type AttachmentRow = {
  id: string;
  discussion_id: string;
  user_id: string;
  storage_bucket: string;
  storage_path: string;
  public_url: string | null;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  attachment_kind: "image" | "pdf" | "video";
  video_duration_seconds?: number | null;
  sort_order: number;
  created_at: string;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "private, no-store" } });
}

function cleanFileName(value: unknown) {
  return String(value ?? "").trim().replace(/[\/\\]/g, "-").slice(0, 255);
}
function cleanStoragePath(value: unknown) { return String(value ?? "").trim(); }
function cleanPublicUrl(value: unknown) { return String(value ?? "").trim().slice(0, 2048); }
function cleanUuid(value: unknown) { return String(value ?? "").trim(); }
function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getSupabaseAuthClient(token: string) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

function getSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function getAuthenticatedUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return { user: null, error: "Unauthorized." };
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return { user: null, error: "Unauthorized." };
  const authSupabase = getSupabaseAuthClient(token);
  const { data: { user }, error } = await authSupabase.auth.getUser(token);
  return error || !user ? { user: null, error: "Invalid session." } : { user, error: null };
}

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthenticatedUser(request);
    if (authError || !user) return jsonError(authError ?? "Unauthorized.", 401);

    const supabase = getSupabaseServiceClient();
    if (!supabase) return jsonError("Attachment service is not configured.", 503);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return jsonError("Invalid attachment payload.", 400);
    const source = body as Record<string, unknown>;

    const discussionId = cleanUuid(source.discussionId);
    const storagePath = cleanStoragePath(source.storagePath);
    const requestedBucket = String(source.storageBucket ?? PUBLIC_BUCKET).trim();
    const publicUrl = cleanPublicUrl(source.publicUrl);
    const fileName = cleanFileName(source.fileName);
    const mimeType = String(source.mimeType ?? "").trim().toLowerCase();
    const fileSizeBytes = Number(source.fileSizeBytes);
    const videoDurationSeconds = Number(source.videoDurationSeconds);
    const requestedSortOrder = Number(source.sortOrder ?? 0);
    const sortOrder = Number.isInteger(requestedSortOrder) ? requestedSortOrder : 0;
    const attachmentKind = getAttachmentKindForMimeType(mimeType);

    if (!isValidUuid(discussionId)) return jsonError("Invalid discussion id.", 400);
    if (!storagePath || !storagePath.startsWith(`${user.id}/${discussionId}/`)) return jsonError("Invalid attachment storage path.", 400);
    if (!fileName) return jsonError("Missing attachment file name.", 400);
    if (!ALLOWED_MIME_TYPES.has(mimeType) || !attachmentKind) return jsonError("Attachment type is not allowed.", 400);
    if (!Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) return jsonError("Attachment size must be greater than 0 bytes.", 400);
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 2) return jsonError("Attachment sort order must be 0, 1, or 2.", 400);

    const [{ data: profile }, { data: discussion }, { data: existingAttachments }] = await Promise.all([
      supabase.from("profiles").select("is_admin, account_status, enforcement_reason, suspended_until").eq("id", user.id).maybeSingle(),
      supabase.from("discussions").select("id, user_id, audience_type, deleted_at").eq("id", discussionId).maybeSingle(),
      supabase.from("discussion_attachments").select("id, attachment_kind").eq("discussion_id", discussionId),
    ]);

    const profileAccess = (profile ?? null) as ProfileAccess | null;
    const enforcement = getAccountEnforcementResult(profileAccess);
    if (!enforcement.allowed) {
      return NextResponse.json({ error: enforcement.errorMessage, code: enforcement.code }, { status: 403 });
    }

    const existingDiscussion = discussion as DiscussionAccess | null;
    if (!existingDiscussion || existingDiscussion.deleted_at) return jsonError("Discussion not found.", 404);
    const isOwner = existingDiscussion.user_id === user.id;
    const isAdmin = Boolean(profileAccess?.is_admin);
    if (!isOwner && !isAdmin) return jsonError("You do not have permission to attach files to this discussion.", 403);

    const isProtected = String(existingDiscussion.audience_type ?? "public") !== "public";
    const expectedBucket = isProtected ? PROTECTED_BUCKET : PUBLIC_BUCKET;
    if (requestedBucket !== expectedBucket) {
      return jsonError("Discussion visibility changed while the attachment was uploading. Please retry the attachment.", 409);
    }
    if (isProtected && publicUrl) return jsonError("Restricted Discussion attachments cannot use a public URL.", 400);
    if (!isProtected && !publicUrl) return jsonError("Missing attachment public URL.", 400);

    const attachmentRows = (existingAttachments ?? []) as Array<{ id: string; attachment_kind: string | null }>;
    if (attachmentRows.length >= MAX_ATTACHMENTS_PER_DISCUSSION) return jsonError("A discussion can have at most 3 attachments.", 400);

    let normalizedVideoDurationSeconds: number | null = null;
    let videoContextLimits: ReturnType<typeof getVideoContextLimitsForPlan> | null = null;

    if (attachmentKind === "video") {
      if (attachmentRows.filter((row) => row.attachment_kind === "video").length >= 1) {
        return jsonError("A discussion can have only one Video Context.", 400);
      }
      const resolvedSubscription = await getResolvedGeneralSubscriptionForUser(user.id);
      videoContextLimits = getVideoContextLimitsForPlan(resolvedSubscription.plan, isAdmin);
      if (!Number.isFinite(videoDurationSeconds) || videoDurationSeconds <= 0) {
        return jsonError("Unable to read video duration. Please choose a different video.", 400);
      }
      normalizedVideoDurationSeconds = Math.ceil(videoDurationSeconds);
      if (normalizedVideoDurationSeconds > videoContextLimits.maxDurationSeconds) {
        return jsonError(`${videoContextLimits.label} videos can be up to ${videoContextLimits.maxDurationSeconds} seconds.`, 400);
      }
      if (fileSizeBytes > videoContextLimits.maxFileSizeBytes) {
        return jsonError(`${videoContextLimits.label} videos must be ${Math.round(videoContextLimits.maxFileSizeBytes / (1024 * 1024))} MB or less.`, 400);
      }
      const now = new Date();
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const { count, error } = await supabase.from("discussion_video_upload_events").select("*", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", monthStart.toISOString());
      if (error) return jsonError("Video Context limit service is not configured.", 503);
      if ((count ?? 0) >= videoContextLimits.monthlyUploadLimit) {
        return jsonError(`You have reached your ${videoContextLimits.label} Video Context limit of ${videoContextLimits.monthlyUploadLimit} videos this month.`, 403);
      }
    } else if (fileSizeBytes > MAX_ATTACHMENT_SIZE_BYTES) {
      return jsonError("Image and PDF attachments must be 10 MB or less.", 400);
    }

    const { data: attachment, error: insertError } = await supabase
      .from("discussion_attachments")
      .insert({
        discussion_id: discussionId,
        user_id: user.id,
        storage_bucket: expectedBucket,
        storage_path: storagePath,
        public_url: isProtected ? null : publicUrl,
        file_name: fileName,
        mime_type: mimeType,
        file_size_bytes: Math.round(fileSizeBytes),
        attachment_kind: attachmentKind,
        video_duration_seconds: normalizedVideoDurationSeconds,
        sort_order: sortOrder,
      })
      .select("id, discussion_id, user_id, storage_bucket, storage_path, public_url, file_name, mime_type, file_size_bytes, attachment_kind, video_duration_seconds, sort_order, created_at")
      .single();
    if (insertError) return jsonError(insertError.message || "Unable to save attachment.", 400);

    if (attachmentKind === "video" && normalizedVideoDurationSeconds && videoContextLimits) {
      const { error: usageInsertError } = await supabase.from("discussion_video_upload_events").insert({
        user_id: user.id,
        discussion_id: discussionId,
        attachment_id: attachment.id,
        tier: videoContextLimits.tier,
        video_duration_seconds: normalizedVideoDurationSeconds,
        max_duration_seconds: videoContextLimits.maxDurationSeconds,
        file_size_bytes: Math.round(fileSizeBytes),
      });
      if (usageInsertError) {
        await supabase.from("discussion_attachments").delete().eq("id", attachment.id);
        await supabase.storage.from(expectedBucket).remove([storagePath]);
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
        protected: isProtected,
      },
    });

    return NextResponse.json({ attachment: attachment as AttachmentRow });
  } catch (error) {
    console.error(error);
    return jsonError("Unexpected server error.", 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthenticatedUser(request);
    if (authError || !user) return jsonError(authError ?? "Unauthorized.", 401);
    const supabase = getSupabaseServiceClient();
    if (!supabase) return jsonError("Attachment service is not configured.", 503);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return jsonError("Invalid attachment delete payload.", 400);
    const attachmentId = cleanUuid((body as Record<string, unknown>).attachmentId);
    if (!isValidUuid(attachmentId)) return jsonError("Invalid attachment id.", 400);

    const [{ data: profile }, { data: attachment }] = await Promise.all([
      supabase.from("profiles").select("is_admin, account_status, enforcement_reason, suspended_until").eq("id", user.id).maybeSingle(),
      supabase.from("discussion_attachments").select("id, discussion_id, user_id, storage_bucket, storage_path, public_url, file_name, mime_type, file_size_bytes, attachment_kind, video_duration_seconds, sort_order, created_at").eq("id", attachmentId).maybeSingle(),
    ]);

    const profileAccess = (profile ?? null) as ProfileAccess | null;
    const enforcement = getAccountEnforcementResult(profileAccess);
    if (!enforcement.allowed) return NextResponse.json({ error: enforcement.errorMessage, code: enforcement.code }, { status: 403 });

    const existingAttachment = attachment as AttachmentRow | null;
    if (!existingAttachment) return jsonError("Attachment not found.", 404);
    const { data: discussion } = await supabase.from("discussions").select("id, user_id, audience_type, deleted_at").eq("id", existingAttachment.discussion_id).maybeSingle();
    const existingDiscussion = discussion as DiscussionAccess | null;
    const isAttachmentOwner = existingAttachment.user_id === user.id;
    const isDiscussionOwner = existingDiscussion?.user_id === user.id;
    const isAdmin = Boolean(profileAccess?.is_admin);
    if (!isAttachmentOwner && !isDiscussionOwner && !isAdmin) return jsonError("You do not have permission to delete this attachment.", 403);

    const { error: deleteMetadataError } = await supabase.from("discussion_attachments").delete().eq("id", attachmentId);
    if (deleteMetadataError) return jsonError(deleteMetadataError.message || "Unable to delete attachment.", 400);

    const { error: storageDeleteError } = await supabase.storage.from(existingAttachment.storage_bucket).remove([existingAttachment.storage_path]);
    if (storageDeleteError) console.error("Attachment storage delete failed:", storageDeleteError.message);

    await logAuditEvent({
      actor_id: user.id,
      action: "discussion.attachment_deleted",
      target_type: "discussion",
      target_id: existingAttachment.discussion_id,
      metadata: {
        attachment_id: attachmentId,
        file_name: existingAttachment.file_name,
        storage_bucket: existingAttachment.storage_bucket,
        storage_deleted: !storageDeleteError,
      },
    });

    return NextResponse.json({ deleted: true, attachmentId, storageDeleted: !storageDeleteError });
  } catch (error) {
    console.error(error);
    return jsonError("Unexpected server error.", 500);
  }
}
