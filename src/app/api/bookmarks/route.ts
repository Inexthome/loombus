import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";

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

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json(code ? { error: message, code } : { error: message }, { status });
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

  const accountAccess = await verifyRequestAccountAccess(supabase);

  if (!accountAccess.ok) {
    return jsonError(
      accountAccess.error,
      accountAccess.status,
      accountAccess.code
    );
  }

  const body = await request.json().catch(() => null);
  const discussionId = body?.discussionId;

  if (!isValidUuid(discussionId)) {
    return jsonError("Invalid discussion id.", 400);
  }

  const { data: bookmark, error } = await supabase
    .from("bookmarks")
    .insert({
      user_id: accountAccess.user.id,
      discussion_id: discussionId,
    })
    .select("id")
    .single();

  if (error) {
    return jsonError(error.message || "Already saved or unable to save.", 400);
  }

  return NextResponse.json({ bookmark });
}

export async function DELETE(request: NextRequest) {
  let supabase;

  try {
    supabase = getSupabaseForRequest(request);
  } catch {
    return jsonError("Server configuration error.", 500);
  }

  const accountAccess = await verifyRequestAccountAccess(supabase);

  if (!accountAccess.ok) {
    return jsonError(
      accountAccess.error,
      accountAccess.status,
      accountAccess.code
    );
  }

  const body = await request.json().catch(() => null);
  const bookmarkId = body?.bookmarkId;
  const discussionId = body?.discussionId;

  let query = supabase
    .from("bookmarks")
    .delete()
    .eq("user_id", accountAccess.user.id);

  if (isValidUuid(bookmarkId)) {
    query = query.eq("id", bookmarkId);
  } else if (isValidUuid(discussionId)) {
    query = query.eq("discussion_id", discussionId);
  } else {
    return jsonError("Missing bookmark id or discussion id.", 400);
  }

  const { error } = await query;

  if (error) {
    return jsonError(error.message || "Unable to remove saved discussion.", 400);
  }

  return NextResponse.json({ ok: true });
}
