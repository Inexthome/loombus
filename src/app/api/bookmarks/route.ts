import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import {
  getBookmarkMutationSupabase,
  hasUnlimitedOrganization,
} from "@/lib/bookmark-mutation-server";
import { ORGANIZATION_LIMITS } from "@/lib/organization-limits";

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

function jsonError(
  message: string,
  status: number,
  code?: string,
  extras: Record<string, unknown> = {}
) {
  return NextResponse.json(
    code ? { error: message, code, ...extras } : { error: message, ...extras },
    { status }
  );
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

  let service;
  try {
    service = getBookmarkMutationSupabase();
  } catch {
    return jsonError("Server configuration error.", 500);
  }

  const { data: existingBookmark, error: existingError } = await service
    .from("bookmarks")
    .select("id")
    .eq("user_id", accountAccess.user.id)
    .eq("discussion_id", discussionId)
    .maybeSingle();

  if (existingError) {
    return jsonError("Unable to verify saved discussion.", 400);
  }

  if (existingBookmark) {
    return NextResponse.json({ bookmark: existingBookmark, existing: true });
  }

  let unlimitedOrganization = false;
  try {
    unlimitedOrganization = await hasUnlimitedOrganization(accountAccess.user.id);
  } catch {
    return jsonError("Unable to verify Saved access.", 503);
  }

  if (!unlimitedOrganization) {
    const { count, error: countError } = await service
      .from("bookmarks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", accountAccess.user.id);

    if (countError) {
      return jsonError("Unable to verify Saved usage.", 400);
    }

    const limit = ORGANIZATION_LIMITS.free.saves;
    if ((count ?? 0) >= limit) {
      return jsonError(
        `Free Saved is limited to ${limit} discussions. Upgrade to Premium for unlimited saves.`,
        403,
        "organization_limit_reached",
        { limit }
      );
    }
  }

  const { data: bookmark, error } = await service
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

  let service;
  try {
    service = getBookmarkMutationSupabase();
  } catch {
    return jsonError("Server configuration error.", 500);
  }

  let query = service
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
