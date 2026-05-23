import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseForRequest(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment configuration.");
  }

  const authorization = request.headers.get("authorization") ?? "";

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: authorization ? { Authorization: authorization } : {},
    },
  });
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function isValidUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

export async function PATCH(request: NextRequest) {
  let supabase;

  try {
    supabase = getSupabaseForRequest(request);
  } catch {
    return jsonError("Server configuration error.", 500);
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return jsonError("Unauthorized.", 401);
  }

  const body = await request.json().catch(() => null);
  const bookmarkId = body?.bookmarkId;
  const collectionId = body?.collectionId;

  if (!isValidUuid(bookmarkId)) {
    return jsonError("Invalid bookmark id.", 400);
  }

  if (collectionId !== null && !isValidUuid(collectionId)) {
    return jsonError("Invalid collection id.", 400);
  }

  const { error } = await supabase
    .from("bookmarks")
    .update({ collection_id: collectionId })
    .eq("id", bookmarkId)
    .eq("user_id", user.id);

  if (error) {
    return jsonError(error.message || "Unable to move saved discussion.", 400);
  }

  return NextResponse.json({ ok: true, collectionId });
}
