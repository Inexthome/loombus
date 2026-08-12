import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import { getBookmarkMutationSupabase } from "@/lib/bookmark-mutation-server";

function getSupabaseForRequest(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) throw new Error("Missing Supabase environment configuration.");
  const authorization = request.headers.get("authorization") ?? "";
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: authorization ? { Authorization: authorization } : {} },
  });
}

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json(code ? { error: message, code } : { error: message }, { status });
}

function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function PATCH(request: NextRequest) {
  let supabase;
  try { supabase = getSupabaseForRequest(request); } catch { return jsonError("Server configuration error.", 500); }
  const accountAccess = await verifyRequestAccountAccess(supabase);
  if (!accountAccess.ok) return jsonError(accountAccess.error, accountAccess.status, accountAccess.code);

  const body = await request.json().catch(() => null);
  const bookmarkId = body?.bookmarkId;
  const collectionId = body?.collectionId;
  if (!isValidUuid(bookmarkId)) return jsonError("Invalid bookmark id.", 400);
  if (collectionId !== null && !isValidUuid(collectionId)) return jsonError("Invalid collection id.", 400);

  const { data: ownedBookmark, error: bookmarkError } = await supabase.from("bookmarks").select("id").eq("id", bookmarkId).eq("user_id", accountAccess.user.id).maybeSingle();
  if (bookmarkError) return jsonError("Unable to verify the saved discussion.", 400);
  if (!ownedBookmark) return jsonError("Saved discussion not found.", 404);

  if (collectionId !== null) {
    const { data: ownedCollection, error: collectionError } = await supabase.from("bookmark_collections").select("id").eq("id", collectionId).eq("user_id", accountAccess.user.id).maybeSingle();
    if (collectionError) return jsonError("Unable to verify the folder.", 400);
    if (!ownedCollection) return jsonError("Saved folder not found.", 404);
  }

  let service;
  try { service = getBookmarkMutationSupabase(); } catch { return jsonError("Server configuration error.", 500); }
  const { error } = await service.from("bookmarks").update({ collection_id: collectionId }).eq("id", bookmarkId).eq("user_id", accountAccess.user.id);
  if (error) return jsonError(error.message || "Unable to move saved discussion.", 400);
  return NextResponse.json({ ok: true, collectionId });
}
