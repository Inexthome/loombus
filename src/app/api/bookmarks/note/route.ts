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
  if (!supabaseUrl || !supabaseAnonKey) throw new Error("Missing Supabase environment configuration.");
  const authorization = request.headers.get("authorization") ?? "";
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: authorization ? { Authorization: authorization } : {} },
  });
}

function jsonError(message: string, status: number, code?: string, extras: Record<string, unknown> = {}) {
  return NextResponse.json(code ? { error: message, code, ...extras } : { error: message, ...extras }, { status });
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
  const note = typeof body?.note === "string" ? body.note.trim() : "";
  if (!isValidUuid(bookmarkId)) return jsonError("Invalid bookmark id.", 400);
  if (note.length > 1000) return jsonError("Private note is too long.", 400);

  const { data: ownedBookmark, error: ownershipError } = await supabase
    .from("bookmarks")
    .select("id, private_note")
    .eq("id", bookmarkId)
    .eq("user_id", accountAccess.user.id)
    .maybeSingle();
  if (ownershipError) return jsonError("Unable to verify the saved discussion.", 400);
  if (!ownedBookmark) return jsonError("Saved discussion not found.", 404);

  let service;
  try { service = getBookmarkMutationSupabase(); } catch { return jsonError("Server configuration error.", 500); }

  const isCreatingNote = Boolean(note) && !Boolean(ownedBookmark.private_note?.trim());
  if (isCreatingNote) {
    let unlimitedOrganization = false;
    try { unlimitedOrganization = await hasUnlimitedOrganization(accountAccess.user.id); }
    catch { return jsonError("Unable to verify private-note access.", 503); }

    if (!unlimitedOrganization) {
      const { count, error: countError } = await service
        .from("bookmarks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", accountAccess.user.id)
        .not("private_note", "is", null);
      if (countError) return jsonError("Unable to verify private-note usage.", 400);
      const limit = ORGANIZATION_LIMITS.free.privateNotes;
      if ((count ?? 0) >= limit) return jsonError(`Free private notes are limited to ${limit} saved discussions. Upgrade to Premium for unlimited private notes.`, 403, "organization_limit_reached", { limit });
    }
  }

  const { data, error } = await service
    .from("bookmarks")
    .update({ private_note: note || null })
    .eq("id", bookmarkId)
    .eq("user_id", accountAccess.user.id)
    .select("id, private_note, private_note_updated_at")
    .single();
  if (error) return jsonError(error.message || "Unable to save private note.", 400);
  return NextResponse.json({ bookmark: data });
}
