import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  IDENTITY_VERIFICATION_REMINDER_MESSAGE,
  IDENTITY_VERIFICATION_REMINDER_TYPE,
  IDENTITY_VERIFICATION_TARGET_TYPE,
  normalizeIdentityVerificationStatus,
  shouldSendIdentityVerificationReminder,
} from "@/lib/identity-verification";
import { createNotification } from "@/lib/notifications";

const REMINDER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

type ProfileRow = {
  account_status: string | null;
  identity_verification_status: string | null;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function getSupabaseForToken(token: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

function accountShouldSkipReminder(accountStatus: string | null | undefined) {
  return (
    accountStatus === "suspended" ||
    accountStatus === "banned" ||
    accountStatus === "deactivated" ||
    accountStatus === "deletion_requested"
  );
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader) {
    return jsonError("Unauthorized.", 401);
  }

  const token = authHeader.replace("Bearer ", "").trim();
  const supabase = getSupabaseForToken(token);

  if (!supabase) {
    return jsonError("Server configuration error.", 500);
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return jsonError("Invalid session.", 401);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("account_status, identity_verification_status")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  if (profileError) {
    return jsonError("Unable to check verification status.", 500);
  }

  if (!profile || accountShouldSkipReminder(profile.account_status)) {
    return NextResponse.json({
      ok: true,
      created: false,
      skippedReason: "account_not_eligible",
    });
  }

  const status = normalizeIdentityVerificationStatus(
    profile.identity_verification_status
  );

  if (!shouldSendIdentityVerificationReminder(status)) {
    return NextResponse.json({
      ok: true,
      created: false,
      skippedReason: "verification_status_not_due",
      status,
    });
  }

  const since = new Date(Date.now() - REMINDER_WINDOW_MS).toISOString();

  const { data: recentReminder, error: reminderError } = await supabase
    .from("notifications")
    .select("id, created_at")
    .eq("user_id", user.id)
    .eq("type", IDENTITY_VERIFICATION_REMINDER_TYPE)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (reminderError) {
    return jsonError("Unable to check recent reminders.", 500);
  }

  if (recentReminder) {
    return NextResponse.json({
      ok: true,
      created: false,
      skippedReason: "recently_reminded",
      status,
    });
  }

  const { error: notificationError } = await createNotification({
    user_id: user.id,
    actor_id: null,
    type: IDENTITY_VERIFICATION_REMINDER_TYPE,
    target_type: IDENTITY_VERIFICATION_TARGET_TYPE,
    target_id: null,
    message: IDENTITY_VERIFICATION_REMINDER_MESSAGE,
  });

  if (notificationError) {
    return jsonError("Unable to create verification reminder.", 500);
  }

  return NextResponse.json({
    ok: true,
    created: true,
    status,
  });
}
