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

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function getAttachmentKind(mimeType: string) {
  if (mimeType.startsWith("image/")) {
    return "image";
  }

  if (mimeType === "application/pdf") {
    return "pdf";
  }

  return null;
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
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader) {
    return jsonError("Unauthorized.", 401);
  }

  const token = authHeader.replace("Bearer ", "").trim();

  const authSupabase = getSupabaseAuthClient(token);

  const {
    data: { user },
  } = await authSupabase.auth.getUser(token);

  if (!user) {
    return jsonError("Unauthorized.", 401);
  }

  const supabase = getSupabaseServiceClient();

  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return jsonError("Invalid attachment payload.", 400);
  }

  const source = body as Record<string, unknown>;

  const conversationId = clean(source.conversationId);
  const messageId = clean(source.messageId);
  const storagePath = clean(source.storagePath);
  const publicUrl = clean(source.publicUrl);
  const fileName = clean(source.fileName);
  const mimeType = clean(source.mimeType).toLowerCase();
  const fileSizeBytes = Number(source.fileSizeBytes);
  const sortOrder = Number(source.sortOrder ?? 0);

  if (!isValidUuid(conversationId)) {
    return jsonError("Invalid conversation id.", 400);
  }

  if (!isValidUuid(messageId)) {
    return jsonError("Invalid message id.", 400);
  }

  if (!storagePath.startsWith(`${user.id}/`)) {
    return jsonError("Invalid attachment path.", 400);
  }

  const attachmentKind = getAttachmentKind(mimeType);

  if (!attachmentKind || !ALLOWED_MIME_TYPES.has(mimeType)) {
    return jsonError("Attachment type is not allowed.", 400);
  }

  if (
    !Number.isFinite(fileSizeBytes) ||
    fileSizeBytes <= 0 ||
    fileSizeBytes > MAX_ATTACHMENT_SIZE_BYTES
  ) {
    return jsonError("Attachment size must be 10 MB or less.", 400);
  }

  const [{ data: profile }, { data: membership }, { count }] =
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
        .from("private_message_attachments")
        .select("*", { count: "exact", head: true })
        .eq("message_id", messageId),
    ]);

  const enforcement = getAccountEnforcementResult(
    (profile ?? null) as ProfileAccess | null
  );

  if (!enforcement.allowed) {
    return jsonError(
      enforcement.errorMessage ?? "Account restricted.",
      403
    );
  }

  if (!membership) {
    return jsonError("Conversation not found.", 404);
  }

  if ((count ?? 0) >= MAX_ATTACHMENTS_PER_MESSAGE) {
    return jsonError("A message can have at most 3 attachments.", 400);
  }

  const { data: attachment, error } = await supabase
    .from("private_message_attachments")
    .insert({
      message_id: messageId,
      conversation_id: conversationId,
      user_id: user.id,
      storage_bucket: ATTACHMENT_BUCKET,
      storage_path: storagePath,
      public_url: publicUrl,
      file_name: fileName,
      mime_type: mimeType,
      file_size_bytes: fileSizeBytes,
      attachment_kind: attachmentKind,
      sort_order: sortOrder,
    })
    .select("*")
    .single();

  if (error) {
    return jsonError(error.message, 400);
  }

  return NextResponse.json({ attachment });
}
