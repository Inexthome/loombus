import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const PROTECTED_BUCKET = "discussion-attachments-protected";
const SIGNED_URL_TTL_SECONDS = 120;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "private, no-store" } }
  );
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function getViewerId(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authorization = request.headers.get("authorization") ?? "";
  if (!url || !key || !authorization.startsWith("Bearer ")) return null;

  const client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data, error } = await client.auth.getUser();
  return error ? null : data.user?.id ?? null;
}

export async function GET(request: NextRequest) {
  const attachmentId = String(request.nextUrl.searchParams.get("attachmentId") ?? "").trim();
  if (!UUID_PATTERN.test(attachmentId)) return jsonError("Invalid attachment id.", 400);

  const service = getServiceClient();
  if (!service) return jsonError("Attachment service is not configured.", 503);

  const { data: attachment, error: attachmentError } = await service
    .from("discussion_attachments")
    .select("id, discussion_id, storage_bucket, storage_path, public_url")
    .eq("id", attachmentId)
    .maybeSingle();
  if (attachmentError) return jsonError("Unable to load attachment.", 503);
  if (!attachment) return jsonError("Attachment not found.", 404);

  const { data: discussion, error: discussionError } = await service
    .from("discussions")
    .select("id, deleted_at")
    .eq("id", attachment.discussion_id)
    .maybeSingle();
  if (discussionError) return jsonError("Unable to verify Discussion.", 503);
  if (!discussion || discussion.deleted_at) return jsonError("Attachment not found.", 404);

  const isProtected = attachment.storage_bucket === PROTECTED_BUCKET || !attachment.public_url;
  if (!isProtected && attachment.public_url) {
    return NextResponse.json(
      { url: attachment.public_url, expiresIn: null, protected: false },
      { headers: { "Cache-Control": "public, max-age=300" } }
    );
  }

  if (!attachment.storage_path) return jsonError("Attachment not found.", 404);

  const viewerId = await getViewerId(request);
  const { data: allowed, error: accessError } = await service.rpc("can_view_discussion_audience", {
    p_discussion_id: attachment.discussion_id,
    p_viewer_user_id: viewerId,
  });
  if (accessError) return jsonError("Unable to verify Discussion access.", 503);
  if (allowed !== true) return jsonError("Attachment not found.", 404);

  const { data: signed, error: signedError } = await service.storage
    .from(attachment.storage_bucket || PROTECTED_BUCKET)
    .createSignedUrl(attachment.storage_path, SIGNED_URL_TTL_SECONDS);
  if (signedError || !signed?.signedUrl) {
    return jsonError("Unable to deliver attachment.", 503);
  }

  return NextResponse.json(
    {
      url: signed.signedUrl,
      expiresIn: SIGNED_URL_TTL_SECONDS,
      protected: true,
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
