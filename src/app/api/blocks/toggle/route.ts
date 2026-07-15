import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";

const ACTION_COOLDOWN_SECONDS = 5;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  return NextResponse.json(code ? { error: message, code } : { error: message }, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function jsonResult(blocked: boolean, unchanged = false) {
  return NextResponse.json(
    { blocked, unchanged },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function POST(request: NextRequest) {
  let supabase;

  try {
    supabase = getSupabaseForRequest(request);
  } catch {
    return jsonError("Block service is not configured.", 500);
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
  const targetUserId = String(body?.targetUserId ?? "").trim();
  const desiredState =
    typeof body?.desiredState === "boolean" ? body.desiredState : null;

  if (!targetUserId) {
    return jsonError("Missing target user id.", 400);
  }

  if (!UUID_PATTERN.test(targetUserId)) {
    return jsonError("Invalid target user id.", 400);
  }

  if (accountAccess.user.id === targetUserId) {
    return jsonError("You cannot block yourself.", 400);
  }

  const { data: existingBlock, error: existingBlockError } = await supabase
    .from("user_blocks")
    .select("id")
    .eq("blocker_id", accountAccess.user.id)
    .eq("blocked_id", targetUserId)
    .maybeSingle();

  if (existingBlockError) {
    return jsonError(
      "Unable to verify the current block status.",
      503,
      "block_status_unavailable"
    );
  }

  const isCurrentlyBlocked = Boolean(existingBlock);

  if (desiredState !== null && desiredState === isCurrentlyBlocked) {
    return jsonResult(isCurrentlyBlocked, true);
  }

  const cooldownSince = new Date(
    Date.now() - ACTION_COOLDOWN_SECONDS * 1000
  ).toISOString();

  const { data: recentAction, error: cooldownError } = await supabase
    .from("action_rate_events")
    .select("id")
    .eq("user_id", accountAccess.user.id)
    .eq("action_key", "block_toggle")
    .gte("created_at", cooldownSince)
    .limit(1)
    .maybeSingle();

  if (cooldownError) {
    return jsonError(
      "Unable to verify the block-action cooldown.",
      503,
      "block_rate_limit_unavailable"
    );
  }

  if (recentAction) {
    return jsonError("Please wait before changing block status again.", 429);
  }

  const { error: rateEventError } = await supabase
    .from("action_rate_events")
    .insert({
      user_id: accountAccess.user.id,
      action_key: "block_toggle",
      target_id: targetUserId,
    });

  if (rateEventError) {
    return jsonError(
      "Unable to record the block action.",
      503,
      "block_rate_limit_unavailable"
    );
  }

  if (isCurrentlyBlocked) {
    const { error: deleteError } = await supabase
      .from("user_blocks")
      .delete()
      .eq("blocker_id", accountAccess.user.id)
      .eq("blocked_id", targetUserId);

    if (deleteError) {
      return jsonError("Unable to unblock this member.", 500);
    }

    return jsonResult(false);
  }

  const { error: blockError } = await supabase.from("user_blocks").insert({
    blocker_id: accountAccess.user.id,
    blocked_id: targetUserId,
  });

  if (blockError) {
    return jsonError("Unable to block this member.", 500);
  }

  const [outgoingFollowDelete, incomingFollowDelete] = await Promise.all([
    supabase
      .from("follows")
      .delete()
      .eq("follower_id", accountAccess.user.id)
      .eq("following_id", targetUserId),
    supabase
      .from("follows")
      .delete()
      .eq("follower_id", targetUserId)
      .eq("following_id", accountAccess.user.id),
  ]);

  if (outgoingFollowDelete.error || incomingFollowDelete.error) {
    console.error("Block follow cleanup failed", {
      outgoing: outgoingFollowDelete.error?.message,
      incoming: incomingFollowDelete.error?.message,
    });
  }

  return jsonResult(true);
}
