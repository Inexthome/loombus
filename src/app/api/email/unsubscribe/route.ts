import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

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

  if (!isValidUuid(token)) {
    return jsonError("Invalid unsubscribe link.", 400);
  }

  const { data: preference, error: lookupError } = await supabase
    .from("notification_preferences")
    .select("user_id, email_digest_enabled")
    .eq("email_digest_unsubscribe_token", token)
    .maybeSingle();

  if (lookupError) {
    return jsonError("Unable to verify unsubscribe link.", 500);
  }

  if (!preference?.user_id) {
    return jsonError("Unsubscribe link was not found.", 404);
  }

  if (preference.email_digest_enabled === false) {
    return NextResponse.json({
      ok: true,
      unsubscribed: true,
      alreadyUnsubscribed: true,
      message: "Email digests were already turned off.",
    });
  }

  const { error: updateError } = await supabase
    .from("notification_preferences")
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
    unsubscribed: true,
    alreadyUnsubscribed: false,
    message: "Email digests are now turned off.",
  });
}
