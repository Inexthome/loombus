import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}

function getSupabaseForRequest(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) throw new Error("Missing Supabase configuration.");
  const authorization = request.headers.get("authorization") ?? "";
  return createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: authorization ? { Authorization: authorization } : {} },
  });
}

function getAdminSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing Admin Supabase configuration.");
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET(request: NextRequest) {
  let supabase;
  let adminSupabase;
  try {
    supabase = getSupabaseForRequest(request);
    adminSupabase = getAdminSupabase();
  } catch {
    return jsonError("Server configuration error.", 500);
  }

  const access = await verifyRequestAccountAccess(supabase);
  if (!access.ok) return jsonError(access.error, access.status);
  if (!access.profile.is_admin) return jsonError("Admin access required.", 403);

  const { data, error } = await adminSupabase
    .from("admin_attention_items")
    .select(
      "id,source_type,source_id,source_status,title,summary,action_url,priority,generation,opened_at,source_updated_at",
    )
    .is("resolved_at", null)
    .order("opened_at", { ascending: true })
    .limit(500);

  if (error) return jsonError(error.message || "Unable to load Admin attention items.", 500);

  const rank = { urgent: 0, high: 1, normal: 2 } as const;
  const items = [...(data ?? [])].sort((a, b) => {
    const aRank = rank[(a.priority as keyof typeof rank) ?? "normal"] ?? 2;
    const bRank = rank[(b.priority as keyof typeof rank) ?? "normal"] ?? 2;
    if (aRank !== bRank) return aRank - bRank;
    return new Date(a.opened_at).getTime() - new Date(b.opened_at).getTime();
  });

  return NextResponse.json(
    { items, generatedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
