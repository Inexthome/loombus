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

export async function POST(request: NextRequest) {
  let supabase;
  try { supabase = getSupabaseForRequest(request); } catch { return jsonError("Server configuration error.", 500); }
  const accountAccess = await verifyRequestAccountAccess(supabase);
  if (!accountAccess.ok) return jsonError(accountAccess.error, accountAccess.status, accountAccess.code);

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return jsonError("Enter a folder name.", 400);
  if (name.length > 60) return jsonError("Folder name is too long.", 400);

  let unlimitedOrganization = false;
  try { unlimitedOrganization = await hasUnlimitedOrganization(accountAccess.user.id); }
  catch { return jsonError("Unable to verify folder access.", 503); }

  let service;
  try { service = getBookmarkMutationSupabase(unlimitedOrganization); }
  catch { return jsonError("Server configuration error.", 500); }

  if (!unlimitedOrganization) {
    const { count, error: countError } = await service.from("bookmark_collections").select("id", { count: "exact", head: true }).eq("user_id", accountAccess.user.id);
    if (countError) return jsonError("Unable to verify folder usage.", 400);
    const limit = ORGANIZATION_LIMITS.free.folders;
    if ((count ?? 0) >= limit) return jsonError(`Free Saved folders are limited to ${limit}. Upgrade to Premium for unlimited folders.`, 403, "organization_limit_reached", { limit });
  }

  const { data, error } = await service.from("bookmark_collections").insert({ user_id: accountAccess.user.id, name }).select("id, user_id, name, description, created_at, updated_at").single();
  if (error) {
    const message = error.message || "Unable to create folder.";
    if (message.includes("Free Saved folders are limited")) return jsonError(message, 403, "organization_limit_reached", { limit: ORGANIZATION_LIMITS.free.folders });
    return jsonError(message, 400);
  }
  return NextResponse.json({ collection: data });
}

export async function DELETE(request: NextRequest) {
  let supabase;
  try { supabase = getSupabaseForRequest(request); } catch { return jsonError("Server configuration error.", 500); }
  const accountAccess = await verifyRequestAccountAccess(supabase);
  if (!accountAccess.ok) return jsonError(accountAccess.error, accountAccess.status, accountAccess.code);

  const body = await request.json().catch(() => null);
  const collectionId = body?.collectionId;
  if (!isValidUuid(collectionId)) return jsonError("Invalid collection id.", 400);

  let service;
  try { service = getBookmarkMutationSupabase(); } catch { return jsonError("Server configuration error.", 500); }
  const { error } = await service.from("bookmark_collections").delete().eq("id", collectionId).eq("user_id", accountAccess.user.id);
  if (error) return jsonError(error.message || "Unable to delete folder.", 400);
  return NextResponse.json({ ok: true });
}
