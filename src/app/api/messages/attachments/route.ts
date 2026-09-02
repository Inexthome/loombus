import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAccountEnforcementResult } from "@/lib/account-enforcement";

const ATTACHMENT_BUCKET = "message-attachments";
const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_ATTACHMENTS_PER_MESSAGE = 3;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

type ProfileAccess = {
  is_admin: boolean | null;
  account_status: string | null;
  enforcement_reason: string | null;
  suspended_until: string | null;
};

type StoredObjectInfo = {
  sizeBytes: number;
  mimeType: string | null;
};

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "private, no-store" } }
  );
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeMimeType(value: unknown) {
  const normalized = clean(value).split(";", 1)[0]?.toLowerCase() ?? "";
  return normalized || null;
}

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function getAttachmentKind(mimeType: string) {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf") return "pdf";
  return null;
}

function getSupabaseAuthClient(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    }
  );
}

function getSupabaseServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function removeStoredObject(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  storagePath: string
) {
  await supabase.storage.from(ATTACHMENT_BUCKET).remove([storagePath]);
}

async function getStoredObjectInfo(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  storagePath: string
): Promise<StoredObjectInfo | null> {
  const slash = storagePath.lastIndexOf("/");
  if (slash < 1) return null;
  const folder = storagePath.slice(0, slash);
  const name = storagePath.slice(slash + 1);
  const result = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .list(folder, { limit: 10, search: name });
  if (result.error) return null;

  const item = result.data?.find((candidate) => candidate.name === name);
  if (!item) return null;
  const record = item as unknown as Record<string, unknown>;
  const metadata =
    record.metadata && typeof record.metadata === "object" && !Array.isArray(record.metadata)
      ? (record.metadata as Record<string, unknown>)
      : {};
  const size = Number(
    metadata.size ??
      metadata.contentLength ??
      metadata.content_length ??
      record.size ??
      0
  );
  const mimeType =
    normalizeMimeType(metadata.mimetype) ??
    normalizeMimeType(metadata.mime_type) ??
    normalizeMimeType(metadata.contentType) ??
    normalizeMimeType(metadata.content_type) ??
    normalizeMimeType(record.mimetype) ??
    normalizeMimeType(record.mime_type);

  return {
    sizeBytes: Number.isSafeInteger(size) && size > 0 ? size : 0,
    mimeType,
  };
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return jsonError("Unauthorized.", 401);

  const token = authHeader.replace("Bearer ", "").trim();
  const authSupabase = getSupabaseAuthClient(token);
  const {
    data: { user },
  } = await authSupabase.auth.getUser(token);
  if (!user) return jsonError("Unauthorized.", 401);

  const supabase = getSupabaseServiceClient();
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("Invalid attachment payload.", 400);
  }

  const source = body as Record<string, unknown>;
  const conversationId = clean(source.conversationId);
  const messageId = clean(source.messageId);
  const storagePath = clean(source.storagePath);
  const fileName = clean(source.fileName).replace(/[\\/]/g, "-").slice(0, 255);
  const mimeType = clean(source.mimeType).toLowerCase();
  const fileSizeBytes = Number(source.fileSizeBytes);
  const sortOrder = Number(source.sortOrder ?? 0);

  if (!isValidUuid(conversationId)) return jsonError("Invalid conversation id.", 400);
  if (!isValidUuid(messageId)) return jsonError("Invalid message id.", 400);
  if (!storagePath.startsWith(`${user.id}/${conversationId}/${messageId}/`)) {
    return jsonError("Invalid attachment path.", 400);
  }
  if (!fileName) return jsonError("Missing attachment file name.", 400);

  const attachmentKind = getAttachmentKind(mimeType);
  if (!attachmentKind || !ALLOWED_MIME_TYPES.has(mimeType)) {
    await removeStoredObject(supabase, storagePath);
    return jsonError("Attachment type is not allowed.", 400);
  }
  if (
    !Number.isFinite(fileSizeBytes) ||
    fileSizeBytes <= 0 ||
    fileSizeBytes > MAX_ATTACHMENT_SIZE_BYTES
  ) {
    await removeStoredObject(supabase, storagePath);
    return jsonError("Attachment size must be 10 MB or less.", 400);
  }
  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder >= MAX_ATTACHMENTS_PER_MESSAGE) {
    await removeStoredObject(supabase, storagePath);
    return jsonError("Invalid attachment order.", 400);
  }

  const [{ data: profile }, { data: membership }, { data: message }, { count }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("is_admin, account_status, enforcement_reason, suspended_until")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("private_conversation_members")
        .select("conversation_id")
        .eq("conversation_id", conversationId)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("private_messages")
        .select("id, conversation_id, sender_id")
        .eq("id", messageId)
        .eq("conversation_id", conversationId)
        .maybeSingle(),
      supabase
        .from("private_message_attachments")
        .select("*", { count: "exact", head: true })
        .eq("message_id", messageId),
    ]);

  const enforcement = getAccountEnforcementResult(
    (profile ?? null) as ProfileAccess | null
  );
  if (!enforcement.allowed) {
    await removeStoredObject(supabase, storagePath);
    return jsonError(enforcement.errorMessage ?? "Account restricted.", 403);
  }
  if (!membership) {
    await removeStoredObject(supabase, storagePath);
    return jsonError("Conversation not found.", 404);
  }
  if (!message || message.sender_id !== user.id) {
    await removeStoredObject(supabase, storagePath);
    return jsonError("Message not found.", 404);
  }
  if ((count ?? 0) >= MAX_ATTACHMENTS_PER_MESSAGE) {
    await removeStoredObject(supabase, storagePath);
    return jsonError("A message can have at most 3 attachments.", 400);
  }

  const storedObject = await getStoredObjectInfo(supabase, storagePath);
  if (!storedObject || !storedObject.mimeType || storedObject.sizeBytes <= 0) {
    await removeStoredObject(supabase, storagePath);
    return jsonError("The uploaded attachment metadata could not be verified.", 400);
  }
  if (
    storedObject.mimeType !== mimeType ||
    !ALLOWED_MIME_TYPES.has(storedObject.mimeType) ||
    storedObject.sizeBytes !== Math.round(fileSizeBytes) ||
    storedObject.sizeBytes > MAX_ATTACHMENT_SIZE_BYTES
  ) {
    await removeStoredObject(supabase, storagePath);
    return jsonError("The stored attachment does not match the prepared file.", 400);
  }

  const { data: attachment, error } = await supabase
    .from("private_message_attachments")
    .insert({
      message_id: messageId,
      conversation_id: conversationId,
      user_id: user.id,
      storage_bucket: ATTACHMENT_BUCKET,
      storage_path: storagePath,
      public_url: null,
      file_name: fileName,
      mime_type: storedObject.mimeType,
      file_size_bytes: storedObject.sizeBytes,
      attachment_kind: attachmentKind,
      sort_order: sortOrder,
    })
    .select("*")
    .single();

  if (error) {
    await removeStoredObject(supabase, storagePath);
    return jsonError(error.message, 400);
  }

  return NextResponse.json(
    { attachment },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
