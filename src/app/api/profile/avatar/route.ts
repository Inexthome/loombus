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
  const avatarUrl =
    typeof body?.avatarUrl === "string" ? body.avatarUrl.trim() : "";

  if (!avatarUrl) {
    return jsonError("Missing avatar URL.", 400);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const expectedPrefix = `${supabaseUrl}/storage/v1/object/public/avatars/${user.id}/`;

  if (!avatarUrl.startsWith(expectedPrefix)) {
    return jsonError("Invalid avatar URL.", 400);
  }

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", user.id);

  if (error) {
    return jsonError(error.message || "Avatar uploaded, but profile update failed.", 400);
  }

  return NextResponse.json({ avatarUrl });
}
