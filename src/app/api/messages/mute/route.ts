import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAccountEnforcementResult } from "@/lib/account-enforcement";

type ProfileAccess = {
  account_status: string | null;
  enforcement_reason: string | null;
  suspended_until: string | null;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json(code ? { error: message, code } : { error: message }, { status });
}

function getSupabaseForRequest(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: authorization ? { Authorization: authorization } : {} },
    }
  );
}

function getSupabaseServiceRole() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
}

function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseForRequest(request);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return jsonError("Unauthorized.", 401);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_status, enforcement_reason, suspended_until")
    .eq("id", user.id)
    .maybeSingle();

  const enforcement = getAccountEnforcementResult((profile ?? null) as ProfileAccess | null);

  if (!enforcement.allowed) {
    return jsonError(
      enforcement.errorMessage ?? "Account restricted.",
      403,
      enforcement.code
    );
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonError("Invalid mute payload.", 400);
  }

  const conversationId = String((body as Record<string, unknown>).conversationId ?? "").trim();
  const muted = Boolean((body as Record<string, unknown>).muted);

  if (!isValidUuid(conversationId)) {
    return jsonError("Invalid conversation id.", 400);
  }

  const { data: membership, error: membershipError } = await supabase
    .from("private_conversation_members")
    .select("conversation_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError) {
    return jsonError(membershipError.message, 500);
  }

  if (!membership) {
    return jsonError("Conversation not found.", 404);
  }

  const serviceSupabase = getSupabaseServiceRole();
  const mutedAt = muted ? new Date().toISOString() : null;

  const { error: updateError } = await serviceSupabase
    .from("private_conversation_members")
    .update({
      muted_at: mutedAt,
    })
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id);

  if (updateError) {
    return jsonError(updateError.message, 500);
  }

  return NextResponse.json({
    success: true,
    muted,
    mutedAt,
  });
}
