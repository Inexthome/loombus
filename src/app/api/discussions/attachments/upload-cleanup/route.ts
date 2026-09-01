import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const PROTECTED_BUCKET = "discussion-attachments-protected";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const authorization = request.headers.get("authorization") ?? "";
  if (!url || !anon || !serviceKey) return error("Attachment service is not configured.", 503);
  if (!authorization.startsWith("Bearer ")) return error("Unauthorized.", 401);

  const auth = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data: authData, error: authError } = await auth.auth.getUser();
  const user = authData.user;
  if (authError || !user) return error("Invalid session.", 401);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return error("Invalid cleanup request.", 400);
  const source = body as Record<string, unknown>;
  const discussionId = String(source.discussionId ?? "").trim();
  const storagePath = String(source.storagePath ?? "").trim();
  if (!UUID_PATTERN.test(discussionId)) return error("Invalid discussion id.", 400);
  if (!storagePath.startsWith(`${user.id}/${discussionId}/`)) return error("Invalid attachment storage path.", 400);

  const service = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: discussion } = await service
    .from("discussions")
    .select("id, user_id")
    .eq("id", discussionId)
    .maybeSingle();
  if (!discussion || discussion.user_id !== user.id) return error("Discussion not found.", 404);

  const { error: removeError } = await service.storage.from(PROTECTED_BUCKET).remove([storagePath]);
  if (removeError) return error("Unable to clean attachment upload.", 503);
  return NextResponse.json({ deleted: true }, { headers: { "Cache-Control": "private, no-store" } });
}
