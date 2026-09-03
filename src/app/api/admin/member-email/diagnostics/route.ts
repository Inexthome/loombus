import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const CAMPAIGN_KEY = "loombus-misses-you-2026-09";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function requireAdmin(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return { error: jsonError("Server configuration error.", 500) } as const;

  const authorization = request.headers.get("authorization") ?? "";
  const requestClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: authorization ? { Authorization: authorization } : {} },
  });
  const { data: userData, error: userError } = await requestClient.auth.getUser();
  if (userError || !userData.user) return { error: jsonError("Unauthorized.", 401) } as const;

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile, error: profileError } = await service
    .from("profiles")
    .select("is_admin")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (profileError) return { error: jsonError("Unable to verify Admin access.", 500) } as const;
  if (!profile?.is_admin) return { error: jsonError("Admin access required.", 403) } as const;
  return { service } as const;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;

  const { data: campaign, error: campaignError } = await auth.service
    .from("member_email_campaigns")
    .select("id, sender_email, status")
    .eq("campaign_key", CAMPAIGN_KEY)
    .maybeSingle();
  if (campaignError) return jsonError("Unable to load campaign diagnostics.", 500);
  if (!campaign) {
    return NextResponse.json({
      retryableCount: 0,
      exhaustedCount: 0,
      failureReasons: [],
      configuredSenders: {
        broadcast: process.env.BROADCAST_FROM_EMAIL ?? null,
        product: process.env.PRODUCT_FROM_EMAIL ?? null,
        digest: process.env.DIGEST_FROM_EMAIL ?? null,
      },
    });
  }

  const { data: failedRows, error: failedError } = await auth.service
    .from("member_email_campaign_recipients")
    .select("error_message, attempt_count")
    .eq("campaign_id", campaign.id)
    .eq("status", "failed");
  if (failedError) return jsonError("Unable to load delivery failures.", 500);

  const reasons = new Map<string, number>();
  let retryableCount = 0;
  let exhaustedCount = 0;
  for (const row of failedRows ?? []) {
    const attempts = Number(row.attempt_count ?? 0);
    if (attempts < 3) retryableCount += 1;
    else exhaustedCount += 1;
    const reason = typeof row.error_message === "string" && row.error_message.trim()
      ? row.error_message.trim()
      : "Unknown provider error";
    reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
  }

  return NextResponse.json({
    retryableCount,
    exhaustedCount,
    failureReasons: [...reasons.entries()]
      .map(([message, count]) => ({ message, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    configuredSenders: {
      campaign: campaign.sender_email,
      broadcast: process.env.BROADCAST_FROM_EMAIL ?? null,
      product: process.env.PRODUCT_FROM_EMAIL ?? null,
      digest: process.env.DIGEST_FROM_EMAIL ?? null,
    },
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  if (body?.action !== "reset_failed") return jsonError("Unsupported action.", 400);

  const { data: campaign, error: campaignError } = await auth.service
    .from("member_email_campaigns")
    .select("id")
    .eq("campaign_key", CAMPAIGN_KEY)
    .maybeSingle();
  if (campaignError || !campaign) return jsonError("Campaign not found.", 404);

  const now = new Date().toISOString();
  const { error: resetError } = await auth.service
    .from("member_email_campaign_recipients")
    .update({ status: "pending", attempt_count: 0, error_message: null, updated_at: now })
    .eq("campaign_id", campaign.id)
    .eq("status", "failed");
  if (resetError) return jsonError("Unable to reset failed recipients.", 500);

  await auth.service
    .from("member_email_campaigns")
    .update({ status: "sending", failed_count: 0, completed_at: null, updated_at: now })
    .eq("id", campaign.id);

  return NextResponse.json({ reset: true });
}
