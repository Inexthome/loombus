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

type LabsProfileRow = {
  is_admin: boolean | null;
};

type LabsEntitlementRow = {
  tier: string | null;
  ai_assisted_enabled: boolean | null;
};

async function getLabsAccess(supabase: any, userId: string) {
  const [{ data: profile }, { data: entitlement }] = await Promise.all([
    supabase.from("profiles").select("is_admin").eq("id", userId).maybeSingle(),
    supabase
      .from("user_ai_entitlements")
      .select("tier, ai_assisted_enabled")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const profileRow = profile as LabsProfileRow | null;
  const entitlementRow = entitlement as LabsEntitlementRow | null;

  return (
    Boolean(profileRow?.is_admin) ||
    Boolean(
      entitlementRow?.ai_assisted_enabled &&
        (entitlementRow.tier === "premium_plus" || entitlementRow.tier === "admin")
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

  const canUseLabs = await getLabsAccess(supabase, user.id);

  if (!canUseLabs) {
    return jsonError("Labs voting requires Premium Plus or Admin access.", 403);
  }

  const body = await request.json().catch(() => null);
  const requestId = body?.requestId;

  if (!isValidUuid(requestId)) {
    return jsonError("Invalid Labs request id.", 400);
  }

  const { data: requestRow, error: requestError } = await supabase
    .from("labs_feature_requests")
    .select("id")
    .eq("id", requestId)
    .maybeSingle();

  if (requestError || !requestRow) {
    return jsonError("Labs request not found.", 404);
  }

  const { data: existingVote, error: existingVoteError } = await supabase
    .from("labs_feature_request_votes")
    .select("id")
    .eq("request_id", requestId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingVoteError) {
    return jsonError("Unable to check Labs vote.", 400);
  }

  let voted = false;

  if (existingVote?.id) {
    const { error } = await supabase
      .from("labs_feature_request_votes")
      .delete()
      .eq("id", existingVote.id)
      .eq("user_id", user.id);

    if (error) {
      return jsonError(error.message || "Unable to remove Labs vote.", 400);
    }
  } else {
    const { error } = await supabase
      .from("labs_feature_request_votes")
      .insert({
        request_id: requestId,
        user_id: user.id,
      });

    if (error) {
      return jsonError(error.message || "Unable to save Labs vote.", 400);
    }

    voted = true;
  }

  const { count, error: countError } = await supabase
    .from("labs_feature_request_votes")
    .select("id", { count: "exact", head: true })
    .eq("request_id", requestId);

  if (countError) {
    return jsonError("Labs vote saved, but vote count could not be refreshed.", 400);
  }

  return NextResponse.json({
    requestId,
    voted,
    voteCount: count ?? 0,
  });
}
