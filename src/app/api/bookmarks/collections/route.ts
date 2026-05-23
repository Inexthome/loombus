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

export async function POST(request: NextRequest) {
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
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!name) {
    return jsonError("Enter a folder name.", 400);
  }

  if (name.length > 60) {
    return jsonError("Folder name is too long.", 400);
  }

  const { data, error } = await supabase
    .from("bookmark_collections")
    .insert({
      user_id: user.id,
      name,
    })
    .select("id, user_id, name, description, created_at, updated_at")
    .single();

  if (error) {
    return jsonError(error.message || "Unable to create folder.", 400);
  }

  return NextResponse.json({ collection: data });
}

export async function DELETE(request: NextRequest) {
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
  const collectionId = body?.collectionId;

  if (!isValidUuid(collectionId)) {
    return jsonError("Invalid collection id.", 400);
  }

  const { error } = await supabase
    .from("bookmark_collections")
    .delete()
    .eq("id", collectionId)
    .eq("user_id", user.id);

  if (error) {
    return jsonError(error.message || "Unable to delete folder.", 400);
  }

  return NextResponse.json({ ok: true });
}
