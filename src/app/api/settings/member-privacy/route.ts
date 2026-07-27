import { NextRequest, NextResponse } from "next/server";
import {
  createMemberPrivacyServiceClient,
  getMemberAgeBand,
  getMemberPrivacy,
  requireMemberUser,
} from "@/lib/member-privacy-server";

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function GET(request: NextRequest) {
  const service = createMemberPrivacyServiceClient();
  if (!service) return jsonError("Member privacy service is not configured.", 503);

  const { user } = await requireMemberUser(request);
  if (!user) return jsonError("Unauthorized.", 401);

  const [settings, pendingResult, ageBand] = await Promise.all([
    getMemberPrivacy(service, user.id),
    service
      .from("follow_requests")
      .select("id", { count: "exact", head: true })
      .eq("target_id", user.id)
      .eq("status", "pending"),
    getMemberAgeBand(service, user.id),
  ]);

  return NextResponse.json(
    {
      settings,
      pendingFollowRequests: pendingResult.count ?? 0,
      ageSafety: {
        ageBand,
        teenSafetyMode: ageBand === "teen",
        privateAccountLocked: ageBand === "teen",
        adultDiscoveryLimited: ageBand === "teen",
      },
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function PATCH(request: NextRequest) {
  const service = createMemberPrivacyServiceClient();
  if (!service) return jsonError("Member privacy service is not configured.", 503);

  const { user } = await requireMemberUser(request);
  if (!user) return jsonError("Unauthorized.", 401);

  const body = await request.json().catch(() => ({}));
  const [current, ageBand] = await Promise.all([
    getMemberPrivacy(service, user.id),
    getMemberAgeBand(service, user.id),
  ]);
  const teen = ageBand === "teen";

  const next = {
    user_id: user.id,
    private_account: teen
      ? true
      : typeof body.privateAccount === "boolean"
        ? body.privateAccount
        : current.private_account,
    discoverable:
      typeof body.discoverable === "boolean"
        ? body.discoverable
        : current.discoverable,
    show_view_identity:
      typeof body.showViewIdentity === "boolean"
        ? body.showViewIdentity
        : current.show_view_identity,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await service
    .from("member_privacy_settings")
    .upsert(next, { onConflict: "user_id" })
    .select("user_id, private_account, discoverable, show_view_identity, updated_at")
    .single();

  if (error) return jsonError(error.message, 500);

  let futureDiscussionVisibilityChanged = false;
  if (next.private_account) {
    const { data: audiencePreference } = await service
      .from("discussion_audience_preferences")
      .select("default_audience_type, default_audience_base")
      .eq("user_id", user.id)
      .maybeSingle();

    const currentAudience = audiencePreference?.default_audience_type ?? "public";
    const publicCustom =
      currentAudience === "custom" &&
      (audiencePreference?.default_audience_base ?? "public") === "public";

    if (currentAudience === "public" || currentAudience === "exclude_selected" || publicCustom) {
      const { error: audienceError } = await service
        .from("discussion_audience_preferences")
        .upsert(
          {
            user_id: user.id,
            default_audience_type: "followers",
            default_audience_base: null,
            include_user_ids: [],
            exclude_user_ids: [],
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );

      if (!audienceError) futureDiscussionVisibilityChanged = true;
    }
  }

  return NextResponse.json(
    {
      settings: data,
      futureDiscussionVisibilityChanged,
      ageSafety: {
        ageBand,
        teenSafetyMode: teen,
        privateAccountLocked: teen,
        adultDiscoveryLimited: teen,
      },
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
