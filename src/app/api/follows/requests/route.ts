import { NextRequest, NextResponse } from "next/server";
import { createNotification } from "@/lib/notifications";
import {
  createMemberPrivacyServiceClient,
  hasBlockRelationship,
  requireMemberUser,
} from "@/lib/member-privacy-server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "private, no-store" } }
  );
}

async function clearFollowRequestNotification(
  service: ReturnType<typeof createMemberPrivacyServiceClient>,
  userId: string,
  requesterId: string
) {
  if (!service) return;

  await service
    .from("notifications")
    .delete()
    .eq("user_id", userId)
    .eq("actor_id", requesterId)
    .eq("type", "follow_request")
    .eq("target_type", "profile")
    .eq("target_id", requesterId);
}

export async function GET(request: NextRequest) {
  const service = createMemberPrivacyServiceClient();
  if (!service) return jsonError("Follow request service is not configured.", 503);

  const { user } = await requireMemberUser(request);
  if (!user) return jsonError("Unauthorized.", 401);

  const { data: requests, error } = await service
    .from("follow_requests")
    .select("id, requester_id, created_at")
    .eq("target_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return jsonError(error.message, 500);

  const requesterIds = [...new Set((requests ?? []).map((row) => row.requester_id))];
  const { data: profiles } = requesterIds.length
    ? await service
        .from("profiles")
        .select("id, full_name, username, avatar_url, bio")
        .in("id", requesterIds)
    : { data: [] };

  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const items = (requests ?? []).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    requester: profileMap.get(row.requester_id) ?? {
      id: row.requester_id,
      full_name: null,
      username: null,
      avatar_url: null,
      bio: null,
    },
  }));

  return NextResponse.json(
    { requests: items },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function POST(request: NextRequest) {
  const service = createMemberPrivacyServiceClient();
  if (!service) return jsonError("Follow request service is not configured.", 503);

  const { user } = await requireMemberUser(request);
  if (!user) return jsonError("Unauthorized.", 401);

  const body = await request.json().catch(() => ({}));
  const requestId = String(body.requestId ?? "").trim();
  const action = String(body.action ?? "").trim().toLowerCase();

  if (!UUID_PATTERN.test(requestId)) return jsonError("Invalid follow request.", 400);
  if (!["accept", "decline"].includes(action)) {
    return jsonError("Choose accept or decline.", 400);
  }

  const { data: followRequest, error } = await service
    .from("follow_requests")
    .select("id, requester_id, target_id, status")
    .eq("id", requestId)
    .eq("target_id", user.id)
    .maybeSingle();

  if (error) return jsonError(error.message, 500);
  if (!followRequest || followRequest.status !== "pending") {
    return jsonError("This follow request is no longer pending.", 404);
  }

  if (action === "decline") {
    const { error: declineError } = await service
      .from("follow_requests")
      .update({ status: "declined", responded_at: new Date().toISOString() })
      .eq("id", requestId)
      .eq("target_id", user.id)
      .eq("status", "pending");

    if (declineError) return jsonError(declineError.message, 500);
    await clearFollowRequestNotification(service, user.id, followRequest.requester_id);
    return NextResponse.json({ accepted: false, declined: true });
  }

  if (await hasBlockRelationship(service, user.id, followRequest.requester_id)) {
    return jsonError("This member cannot be approved while a block is active.", 403);
  }

  const { error: followError } = await service.from("follows").upsert(
    {
      follower_id: followRequest.requester_id,
      following_id: user.id,
    },
    { onConflict: "follower_id,following_id" }
  );

  if (followError) return jsonError(followError.message, 500);

  const { error: updateError } = await service
    .from("follow_requests")
    .update({ status: "accepted", responded_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("target_id", user.id)
    .eq("status", "pending");

  if (updateError) return jsonError(updateError.message, 500);

  await clearFollowRequestNotification(service, user.id, followRequest.requester_id);

  await createNotification({
    user_id: followRequest.requester_id,
    actor_id: user.id,
    type: "follow_request_accepted",
    target_type: "profile",
    target_id: user.id,
    message: "Your follow request was approved.",
  }).catch(() => null);

  return NextResponse.json({ accepted: true, following: true });
}
