import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ROLLBACK_WINDOW_MS = 15 * 60 * 1000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonError(error: string, status: number) {
  return NextResponse.json(
    { error },
    {
      status,
      headers: { "Cache-Control": "private, no-store" },
    }
  );
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonError("Unauthorized.", 401);
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return jsonError("Discussion rollback service is not configured.", 503);
    }

    const token = authHeader.slice("Bearer ".length).trim();
    const requestClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await requestClient.auth.getUser(token);

    if (userError || !user) {
      return jsonError("Invalid session.", 401);
    }

    const body = (await request.json().catch(() => null)) as
      | { discussionId?: unknown }
      | null;
    const discussionId = String(body?.discussionId ?? "").trim();

    if (!UUID_PATTERN.test(discussionId)) {
      return jsonError("Choose a valid discussion to reverse.", 400);
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: discussion, error: discussionError } = await serviceClient
      .from("discussions")
      .select("id, user_id, created_at")
      .eq("id", discussionId)
      .maybeSingle();

    if (discussionError) {
      return jsonError("Unable to verify the incomplete discussion.", 500);
    }

    if (!discussion || discussion.user_id !== user.id) {
      return jsonError("Discussion not found.", 404);
    }

    const createdAt = new Date(discussion.created_at).getTime();
    if (
      !Number.isFinite(createdAt) ||
      Date.now() - createdAt > ROLLBACK_WINDOW_MS
    ) {
      return jsonError("This discussion can no longer be reversed automatically.", 409);
    }

    const { data: attachments } = await serviceClient
      .from("discussion_attachments")
      .select("storage_bucket, storage_path")
      .eq("discussion_id", discussionId);

    const storagePathsByBucket = new Map<string, string[]>();
    for (const attachment of attachments ?? []) {
      const bucket = String(
        attachment.storage_bucket ?? "discussion-attachments"
      );
      const storagePath = String(attachment.storage_path ?? "").trim();
      if (!storagePath) continue;
      storagePathsByBucket.set(bucket, [
        ...(storagePathsByBucket.get(bucket) ?? []),
        storagePath,
      ]);
    }

    for (const [bucket, storagePaths] of storagePathsByBucket.entries()) {
      await serviceClient.storage.from(bucket).remove(storagePaths);
    }

    await Promise.allSettled([
      serviceClient
        .from("notifications")
        .delete()
        .eq("target_type", "discussion")
        .eq("target_id", discussionId),
      serviceClient
        .from("discussion_video_upload_events")
        .delete()
        .eq("discussion_id", discussionId),
      serviceClient
        .from("discussion_tags")
        .delete()
        .eq("discussion_id", discussionId),
      serviceClient
        .from("discussion_attachments")
        .delete()
        .eq("discussion_id", discussionId),
    ]);

    const { error: deleteError } = await serviceClient
      .from("discussions")
      .delete()
      .eq("id", discussionId)
      .eq("user_id", user.id);

    if (deleteError) {
      return jsonError("Unable to reverse the incomplete discussion.", 500);
    }

    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return jsonError("Unexpected rollback error.", 500);
  }
}
