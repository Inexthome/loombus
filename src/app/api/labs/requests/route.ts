import { NextResponse, type NextRequest } from "next/server";
import { getAccountEnforcementResult } from "@/lib/account-enforcement";
import { createClient } from "@supabase/supabase-js";

const LABS_SUBMISSION_COOLDOWN_MS = 30_000;

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

type LabsProfileRow = {
  is_admin: boolean | null;
};

type LabsEntitlementRow = {
  tier: string | null;
  ai_assisted_enabled: boolean | null;
};

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

  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const description =
    typeof body?.description === "string" ? body.description.trim() : "";

  if (title.length < 3) {
    return jsonError("Feature request title must be at least 3 characters.", 400);
  }

  if (title.length > 160) {
    return jsonError("Feature request title is too long.", 400);
  }

  if (description.length < 10) {
    return jsonError("Feature request description must be at least 10 characters.", 400);
  }

  if (description.length > 4000) {
    return jsonError("Feature request description is too long.", 400);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, account_status, enforcement_reason, suspended_until")
    .eq("id", user.id)
    .maybeSingle<LabsProfileRow>();

  // Labs submissions are available to all signed-in Loombus members.

  const cooldownCutoff = new Date(
    Date.now() - LABS_SUBMISSION_COOLDOWN_MS
  ).toISOString();

  const { data: recentRequest, error: recentError } = await supabase
    .from("labs_feature_requests")
    .select("id")
    .eq("user_id", user.id)
    .gt("created_at", cooldownCutoff)
    .limit(1);

  if (recentError) {
    return jsonError("Unable to verify Labs submission cooldown.", 500);
  }

  if ((recentRequest ?? []).length > 0) {
    return jsonError("Please wait a few seconds before submitting another Labs request.", 429);
  }

  const { data, error } = await supabase
    .from("labs_feature_requests")
    .insert({
      user_id: user.id,
      title,
      description,
    })
    .select("*")
    .single();

  if (error) {
    return jsonError(error.message || "Unable to submit feature request.", 400);
  }

  return NextResponse.json({ request: data });
}
