import { NextRequest, NextResponse } from "next/server";
import {
  canViewMemberProfile,
  createMemberPrivacyServiceClient,
  getMemberPrivacy,
  hasBlockRelationship,
  isActiveAccountStatus,
  isFollower,
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
  if (!service) return jsonError("Profile privacy service is not configured.", 503);

  const { user } = await requireMemberUser(request);
  if (!user) return jsonError("Log in to view member profiles.", 401);

  const username = decodeURIComponent(
    String(request.nextUrl.searchParams.get("username") ?? "")
  )
    .replace(/^@+/, "")
    .trim()
    .toLowerCase();

  if (!/^[a-z0-9_]{3,30}$/.test(username)) {
    return jsonError("Invalid member profile.", 400);
  }

  const { data: profile, error } = await service
    .from("profiles")
    .select(
      "id, full_name, username, avatar_url, bio, perspective_marker, is_admin, account_status"
    )
    .eq("username", username)
    .maybeSingle();

  if (error) return jsonError(error.message, 500);
  if (!profile || !isActiveAccountStatus(profile.account_status)) {
    return jsonError("Profile not found.", 404);
  }
  if (await hasBlockRelationship(service, profile.id, user.id)) {
    return jsonError("Profile not found.", 404);
  }

  const [privacy, allowed, following, requestResult] = await Promise.all([
    getMemberPrivacy(service, profile.id),
    canViewMemberProfile(service, profile.id, user),
    isFollower(service, user.id, profile.id),
    service
      .from("follow_requests")
      .select("id")
      .eq("requester_id", user.id)
      .eq("target_id", profile.id)
      .eq("status", "pending")
      .maybeSingle(),
  ]);

  return NextResponse.json(
    {
      profile: {
        id: profile.id,
        fullName: profile.full_name,
        username: profile.username,
        avatarUrl: profile.avatar_url,
        bio: allowed ? profile.bio : null,
        perspectiveMarker: allowed ? profile.perspective_marker : null,
        isAdmin: Boolean(profile.is_admin),
      },
      privacy: {
        privateAccount: privacy.private_account,
        discoverable: privacy.discoverable,
      },
      access: allowed ? "full" : "limited",
      isOwner: profile.id === user.id,
      following,
      requested: Boolean(requestResult.data),
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
