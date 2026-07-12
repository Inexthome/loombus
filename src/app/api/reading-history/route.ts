import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

function getRequestSupabase(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authorization = request.headers.get("authorization") ?? "";

  if (!supabaseUrl || !anonKey || !authorization) {
    return null;
  }

  return createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: authorization,
      },
    },
  });
}

function getServiceSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function DELETE(request: NextRequest) {
  const requestSupabase = getRequestSupabase(request);
  const serviceSupabase = getServiceSupabase();

  if (!requestSupabase || !serviceSupabase) {
    return jsonError("Reading history service is not configured.", 503);
  }

  const {
    data: { user },
    error: userError,
  } = await requestSupabase.auth.getUser();

  if (userError || !user) {
    return jsonError("Unauthorized.", 401);
  }

  const body = await request.json().catch(() => ({}));
  const clearAll = body?.clearAll === true;
  const discussionId = String(body?.discussionId ?? "").trim();

  let deleteQuery = serviceSupabase
    .from("discussion_views")
    .delete()
    .eq("viewer_id", user.id);

  if (!clearAll) {
    if (!UUID_PATTERN.test(discussionId)) {
      return jsonError("Invalid discussion id.", 400);
    }

    deleteQuery = deleteQuery.eq("discussion_id", discussionId);
  }

  const { error } = await deleteQuery;

  if (error) {
    return jsonError(error.message || "Unable to update reading history.", 500);
  }

  return NextResponse.json(
    { ok: true, clearedAll: clearAll, discussionId: clearAll ? null : discussionId },
    { headers: { "Cache-Control": "no-store" } }
  );
}
