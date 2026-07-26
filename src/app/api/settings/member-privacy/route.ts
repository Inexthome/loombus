import { NextRequest, NextResponse } from "next/server";
import {
  createMemberPrivacyServiceClient,
  getMemberPrivacy,
  requireMemberUser,
} from "@/lib/member-privacy-server";

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function GET(request: NextRequest) {
  const service = createMemberPrivacyServiceClient();
  if (!service) return jsonError("Member privacy service is not configured.", 503);

  const { user } = await requireMemberUser(request);
  if (!user) return jsonError("Unauthorized.", 401);

  const [settings, pendingResult] = await Promise.all([
    getMemberPrivacy(service, user.id),
    service
      .from("follow_requests")
      .select("id", { count: "exact", head: true })
      .eq("target_id", user.id)
      .eq("status", "pending"),
  ]);

  return NextResponse.json(
    { settings, pendingFollowRequests: pendingResult.count ?? 0 },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function PATCH(request: NextRequest) {
  const service = createMemberPrivacyServiceClient();
  if (!service) return jsonError("Member privacy service is not configured.", 503);

  const { user } = await requireMemberUser(request);
  if (!user) return jsonError("Unauthorized.", 401);

  const body = await request.json().catch(() => ({}));
  const current = await getMemberPrivacy(service, user.id);
  const next = {
    user_id: user.id,
    private_account:
      typeof body.privateAccount === "boolean"
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
      .select("default_audience_type")
      .eq("user_id", user.id)
      .maybeSingle();

    const currentAudience = audiencePreference?.default_audience_type ?? "public";
    if (currentAudience === "public") {
      const { error: audienceError } = await service
        .from("discussion_audience_preferences")
        .upsert(
          {
            user_id: user.id,
            default_audience_type: "followers",
            default_audience_base: null,
            include_user_ids: [],
            exclude_user_ids: [],
          },
          { onConflict: "user_id" }
        );

      if (!audienceError) futureDiscussionVisibilityChanged = true;
    }
  }

  return NextResponse.json(
    {
      settings: data,
      futureDiscussionVisibilityChanged,
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
