import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAccountEnforcementResult } from "@/lib/account-enforcement";

const PROTECTED_BUCKET = "discussion-attachments-protected";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ProfileAccess = {
  is_admin: boolean | null;
  account_status: string | null;
  enforcement_reason: string | null;
  suspended_until: string | null;
};

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

async function getAuthenticatedUser(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authorization = request.headers.get("authorization") ?? "";
  if (!url || !key || !authorization.startsWith("Bearer ")) return null;

  const client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data, error } = await client.auth.getUser();
  return error ? null : data.user ?? null;
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return jsonError("Unauthorized.", 401);

  const service = getServiceClient();
  if (!service) return jsonError("Attachment service is not configured.", 503);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonError("Invalid upload request.", 400);
  }

  const source = body as Record<string, unknown>;
  const discussionId = String(source.discussionId ?? "").trim();
  const storagePath = String(source.storagePath ?? "").trim();
  if (!UUID_PATTERN.test(discussionId)) return jsonError("Invalid discussion id.", 400);
  if (!storagePath || !storagePath.startsWith(`${user.id}/${discussionId}/`)) {
    return jsonError("Invalid attachment storage path.", 400);
  }

  const [{ data: profile }, { data: discussion, error: discussionError }] = await Promise.all([
    service
      .from("profiles")
      .select("is_admin, account_status, enforcement_reason, suspended_until")
      .eq("id", user.id)
      .maybeSingle(),
    service
      .from("discussions")
      .select("id, user_id, audience_type, deleted_at")
      .eq("id", discussionId)
      .maybeSingle(),
  ]);

  if (discussionError) return jsonError("Unable to verify Discussion.", 503);
  if (!discussion || discussion.deleted_at) return jsonError("Discussion not found.", 404);

  const profileAccess = (profile ?? null) as ProfileAccess | null;
  const enforcement = getAccountEnforcementResult(profileAccess);
  if (!enforcement.allowed) {
    return NextResponse.json(
      { error: enforcement.errorMessage, code: enforcement.code },
      { status: 403, headers: { "Cache-Control": "private, no-store" } }
    );
  }

  const isOwner = discussion.user_id === user.id;
  const isAdmin = profileAccess?.is_admin === true;
  if (!isOwner && !isAdmin) return jsonError("You cannot upload media to this Discussion.", 403);

  if (String(discussion.audience_type ?? "public") === "public") {
    return jsonError("Public Discussion media uses the public attachment upload path.", 409);
  }

  const { data, error } = await service.storage
    .from(PROTECTED_BUCKET)
    .createSignedUploadUrl(storagePath, { upsert: false });
  if (error || !data?.token) return jsonError("Unable to authorize attachment upload.", 503);

  return NextResponse.json(
    {
      bucket: PROTECTED_BUCKET,
      path: data.path ?? storagePath,
      token: data.token,
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
