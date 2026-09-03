import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
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

export async function POST(request: NextRequest) {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return jsonError("Unsubscribe service is not configured.", 503);
  }

  const body = await request.json().catch(() => null);
  const token = body?.token;
  const requestedScope = body?.scope;
  if (!isValidUuid(token)) {
    return jsonError("Invalid unsubscribe link.", 400);
  }

  if (requestedScope === "marketing") {
    const { data: marketingPreference, error: marketingLookupError } = await supabase
      .from("marketing_email_preferences")
      .select("user_id, enabled")
      .eq("unsubscribe_token", token)
      .maybeSingle();

    if (marketingLookupError) {
      return jsonError("Unable to verify unsubscribe link.", 500);
    }
    if (!marketingPreference?.user_id) {
      return jsonError("Unsubscribe link was not found.", 404);
    }
    if (marketingPreference.enabled === false) {
      return NextResponse.json({
        ok: true,
        scope: "marketing",
        unsubscribed: true,
        alreadyUnsubscribed: true,
        message: "Loombus member emails were already turned off.",
      });
    }

    const now = new Date().toISOString();
    const { error: marketingUpdateError } = await supabase
      .from("marketing_email_preferences")
      .update({ enabled: false, unsubscribed_at: now, updated_at: now })
      .eq("unsubscribe_token", token);
    if (marketingUpdateError) {
      return jsonError("Unable to unsubscribe from Loombus member emails.", 500);
    }

    return NextResponse.json({
      ok: true,
      scope: "marketing",
      unsubscribed: true,
      alreadyUnsubscribed: false,
      message: "Loombus member emails are now turned off.",
    });
  }

  const { data: accountPreference, error: accountLookupError } = await supabase
    .from("notification_preferences")
    .select("user_id, email_digest_enabled")
    .eq("email_digest_unsubscribe_token", token)
    .maybeSingle();
  if (accountLookupError) {
    return jsonError("Unable to verify unsubscribe link.", 500);
  }

  if (accountPreference?.user_id) {
    if (accountPreference.email_digest_enabled === false) {
      return NextResponse.json({
        ok: true,
        scope: "account",
        unsubscribed: true,
        alreadyUnsubscribed: true,
        message: "Account email digests were already turned off.",
      });
    }

    const { error: updateError } = await (
      supabase.from("notification_preferences") as any
    )
      .update({
        email_digest_enabled: false,
        updated_at: new Date().toISOString(),
      })
      .eq("email_digest_unsubscribe_token", token);
    if (updateError) {
      return jsonError("Unable to unsubscribe from email digests.", 500);
    }

    return NextResponse.json({
      ok: true,
      scope: "account",
      unsubscribed: true,
      alreadyUnsubscribed: false,
      message: "Account email digests are now turned off.",
    });
  }

  const { data: roomPreference, error: roomLookupError } = await supabase
    .from("room_notification_preferences")
    .select("room_id, user_id, email_digest_enabled")
    .eq("email_digest_unsubscribe_token", token)
    .maybeSingle();
  if (roomLookupError) {
    return jsonError("Unable to verify unsubscribe link.", 500);
  }
  if (!roomPreference?.user_id || !roomPreference.room_id) {
    return jsonError("Unsubscribe link was not found.", 404);
  }

  if (roomPreference.email_digest_enabled === false) {
    return NextResponse.json({
      ok: true,
      scope: "room",
      roomId: roomPreference.room_id,
      unsubscribed: true,
      alreadyUnsubscribed: true,
      message: "This Room email digest was already turned off.",
    });
  }

  const { error: roomUpdateError } = await (
    supabase.from("room_notification_preferences") as any
  )
    .update({
      email_digest_enabled: false,
      updated_at: new Date().toISOString(),
    })
    .eq("email_digest_unsubscribe_token", token);
  if (roomUpdateError) {
    return jsonError("Unable to unsubscribe from this Room digest.", 500);
  }

  return NextResponse.json({
    ok: true,
    scope: "room",
    roomId: roomPreference.room_id,
    unsubscribed: true,
    alreadyUnsubscribed: false,
    message: "This Room email digest is now turned off.",
  });
}
