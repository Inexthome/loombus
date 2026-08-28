import { NextRequest, NextResponse } from "next/server";
import { createNotification } from "@/lib/notifications";
import { getAccountEnforcementResult } from "@/lib/account-enforcement";
import {
  createMemberPrivacyServiceClient,
  getMemberPrivacy,
  hasBlockRelationship,
  requireMemberUser,
} from "@/lib/member-privacy-server";

type ProfileAccess = {
  account_status: string | null;
  enforcement_reason: string | null;
  suspended_until: string | null;
};

const ACTION_COOLDOWN_SECONDS = 5;
const DECLINED_REQUEST_COOLDOWN_HOURS = 24;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonError(message: string, status: number, extras: Record<string, unknown> = {}) {
  return NextResponse.json({ error: message, ...extras }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const service = createMemberPrivacyServiceClient();
    if (!service) return jsonError("Follow service is not configured.", 503);

    const { user } = await requireMemberUser(request);
    if (!user) return jsonError("Unauthorized.", 401);

    const { data: profile } = await service
      .from("profiles")
      .select("account_status, enforcement_reason, suspended_until")
      .eq("id", user.id)
      .maybeSingle();

    const enforcement = getAccountEnforcementResult(
      (profile ?? null) as ProfileAccess | null
    );
    if (!enforcement.allowed) {
      return jsonError(
        enforcement.errorMessage ?? "This account cannot change follow relationships.",
        403,
        { code: enforcement.code }
      );
    }

    const body = await request.json().catch(() => ({}));
    const targetUserId = String(body.targetUserId ?? "").trim();
    if (!UUID_PATTERN.test(targetUserId)) return jsonError("Invalid target user id.", 400);
    if (user.id === targetUserId) return jsonError("You cannot follow yourself.", 400);

    const { data: targetProfile } = await service
      .from("profiles")
      .select("id, account_status")
      .eq("id", targetUserId)
      .maybeSingle();
    if (!targetProfile) return jsonError("Member not found.", 404);

    const cooldownSince = new Date(
      Date.now() - ACTION_COOLDOWN_SECONDS * 1000
    ).toISOString();
    const { data: recentAction } = await service
      .from("action_rate_events")
      .select("id")
      .eq("user_id", user.id)
      .eq("action_key", "follow_toggle")
      .gte("created_at", cooldownSince)
      .limit(1)
      .maybeSingle();

    if (recentAction) {
      return jsonError("Please wait before changing follow status again.", 429);
    }

    await service.from("action_rate_events").insert({
      user_id: user.id,
      action_key: "follow_toggle",
      target_id: targetUserId,
    });

    if (await hasBlockRelationship(service, user.id, targetUserId)) {
      return jsonError("This follow relationship is unavailable.", 403);
    }

    const [{ data: existingFollow }, { data: pendingRequest }] = await Promise.all([
      service
        .from("follows")
        .select("id")
        .eq("follower_id", user.id)
        .eq("following_id", targetUserId)
        .maybeSingle(),
      service
        .from("follow_requests")
        .select("id")
        .eq("requester_id", user.id)
        .eq("target_id", targetUserId)
        .eq("status", "pending")
        .maybeSingle(),
    ]);

    if (existingFollow) {
      const { error: deleteError } = await service
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", targetUserId);
      if (deleteError) return jsonError(deleteError.message, 500);

      if (pendingRequest) {
        await service
          .from("follow_requests")
          .update({ status: "cancelled", responded_at: new Date().toISOString() })
          .eq("id", pendingRequest.id);
      }

      return NextResponse.json({ following: false, requested: false });
    }

    const targetPrivacy = await getMemberPrivacy(service, targetUserId);
    if (targetPrivacy.private_account) {
      if (pendingRequest) {
        const { error: cancelError } = await service
          .from("follow_requests")
          .update({ status: "cancelled", responded_at: new Date().toISOString() })
          .eq("id", pendingRequest.id)
          .eq("status", "pending");
        if (cancelError) return jsonError(cancelError.message, 500);
        return NextResponse.json({ following: false, requested: false });
      }

      const declinedSince = new Date(
        Date.now() - DECLINED_REQUEST_COOLDOWN_HOURS * 60 * 60 * 1000
      ).toISOString();
      const { data: recentDeclinedRequest, error: declinedRequestError } = await service
        .from("follow_requests")
        .select("responded_at")
        .eq("requester_id", user.id)
        .eq("target_id", targetUserId)
        .eq("status", "declined")
        .gte("responded_at", declinedSince)
        .order("responded_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (declinedRequestError) {
        return jsonError(declinedRequestError.message, 500);
      }

      if (recentDeclinedRequest?.responded_at) {
        const retryAt = new Date(recentDeclinedRequest.responded_at).getTime() +
          DECLINED_REQUEST_COOLDOWN_HOURS * 60 * 60 * 1000;
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil((retryAt - Date.now()) / 1000)
        );
        return jsonError(
          "This member declined your recent follow request. Please wait before requesting again.",
          429,
          { code: "follow_request_declined_cooldown", retryAfterSeconds }
        );
      }

      const { data: requestRow, error: requestError } = await service
        .from("follow_requests")
        .insert({ requester_id: user.id, target_id: targetUserId, status: "pending" })
        .select("id")
        .single();
      if (requestError) return jsonError(requestError.message, 500);

      const { data: preferences } = await service
        .from("notification_preferences")
        .select("follows_enabled")
        .eq("user_id", targetUserId)
        .maybeSingle();

      if (preferences?.follows_enabled ?? true) {
        await createNotification({
          user_id: targetUserId,
          actor_id: user.id,
          type: "follow_request",
          target_type: "profile",
          target_id: user.id,
          message: "Someone requested to follow you.",
        }).catch(() => null);
      }

      return NextResponse.json({
        following: false,
        requested: true,
        followRequestId: requestRow.id,
      });
    }

    const { error: followError } = await service.from("follows").insert({
      follower_id: user.id,
      following_id: targetUserId,
    });
    if (followError) return jsonError(followError.message, 500);

    const { data: preferences } = await service
      .from("notification_preferences")
      .select("follows_enabled")
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (preferences?.follows_enabled ?? true) {
      await createNotification({
        user_id: targetUserId,
        actor_id: user.id,
        type: "follow",
        target_type: "profile",
        target_id: user.id,
        message: "Someone followed you.",
      }).catch(() => null);
    }

    return NextResponse.json({ following: true, requested: false });
  } catch (error) {
    console.error("Follow toggle failed:", error);
    return jsonError("Unexpected server error.", 500);
  }
}
