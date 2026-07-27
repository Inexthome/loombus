import { NextRequest, NextResponse } from "next/server";
import {
  createMemberPrivacyServiceClient,
  isAdmin,
  requireMemberUser,
  safePageNumber,
  safePageSize,
} from "@/lib/member-privacy-server";
import { canDiscoverTeenProfile } from "@/lib/teen-safety-server";

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}

function safeSearchPattern(value: string) {
  return `%${value.replace(/[%_,()]/g, " ").trim().slice(0, 80)}%`;
}

export async function GET(request: NextRequest) {
  const service = createMemberPrivacyServiceClient();
  if (!service) return jsonError("People directory is not configured.", 503);

  const { user } = await requireMemberUser(request);
  if (!user) return jsonError("Log in to browse Loombus members.", 401);

  const page = safePageNumber(request.nextUrl.searchParams.get("page"));
  const pageSize = safePageSize(request.nextUrl.searchParams.get("pageSize"), 24, 48);
  const search = String(request.nextUrl.searchParams.get("q") ?? "").trim();
  const admin = await isAdmin(service, user.id);

  const [{ data: blockRows }, { data: hiddenPrivacyRows }] = await Promise.all([
    service
      .from("user_blocks")
      .select("blocker_id, blocked_id")
      .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`),
    admin
      ? Promise.resolve({ data: [] as Array<{ user_id: string }> })
      : service
          .from("member_privacy_settings")
          .select("user_id")
          .eq("discoverable", false),
  ]);

  const excludedIds = new Set<string>([user.id]);
  for (const block of blockRows ?? []) {
    excludedIds.add(block.blocker_id === user.id ? block.blocked_id : block.blocker_id);
  }
  for (const row of hiddenPrivacyRows ?? []) excludedIds.add(row.user_id);

  let query = service
    .from("profiles")
    .select("id, full_name, username, avatar_url, bio, is_admin, account_status", {
      count: "exact",
    })
    .or("account_status.is.null,account_status.eq.active")
    .order("full_name", { ascending: true, nullsFirst: false })
    .order("username", { ascending: true, nullsFirst: false });

  if (excludedIds.size > 0) {
    query = query.not("id", "in", `(${[...excludedIds].join(",")})`);
  }

  if (search.length >= 2) {
    const pattern = safeSearchPattern(search);
    query = query.or(
      `full_name.ilike.${pattern},username.ilike.${pattern},bio.ilike.${pattern}`,
    );
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize * 2 - 1;
  const { data: candidateProfiles, error, count } = await query.range(from, to);
  if (error) return jsonError(error.message, 500);

  const visibility = admin
    ? (candidateProfiles ?? []).map(() => true)
    : await Promise.all(
        (candidateProfiles ?? []).map((profile) =>
          canDiscoverTeenProfile(service, user.id, profile.id),
        ),
      );
  const profiles = (candidateProfiles ?? [])
    .filter((_, index) => visibility[index])
    .slice(0, pageSize);

  const profileIds = profiles.map((profile) => profile.id);

  if (profileIds.length === 0) {
    return NextResponse.json(
      {
        members: [],
        page,
        pageSize,
        total: 0,
        hasMore: false,
        teenSafetyFiltered: !admin && Boolean(candidateProfiles?.length),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const [
    privacyResult,
    followingResult,
    followerResult,
    requestResult,
    followerCountResult,
    followingCountResult,
  ] = await Promise.all([
    service
      .from("member_privacy_settings")
      .select("user_id, private_account")
      .in("user_id", profileIds),
    service
      .from("follows")
      .select("following_id")
      .eq("follower_id", user.id)
      .in("following_id", profileIds),
    service
      .from("follows")
      .select("follower_id")
      .eq("following_id", user.id)
      .in("follower_id", profileIds),
    service
      .from("follow_requests")
      .select("target_id")
      .eq("requester_id", user.id)
      .eq("status", "pending")
      .in("target_id", profileIds),
    service.from("follows").select("following_id").in("following_id", profileIds),
    service.from("follows").select("follower_id").in("follower_id", profileIds),
  ]);

  const privacyMap = new Map(
    (privacyResult.data ?? []).map((row) => [row.user_id, Boolean(row.private_account)]),
  );
  const following = new Set((followingResult.data ?? []).map((row) => row.following_id));
  const followers = new Set((followerResult.data ?? []).map((row) => row.follower_id));
  const requested = new Set((requestResult.data ?? []).map((row) => row.target_id));
  const followerCounts = new Map<string, number>();
  const followingCounts = new Map<string, number>();

  for (const row of followerCountResult.data ?? []) {
    followerCounts.set(row.following_id, (followerCounts.get(row.following_id) ?? 0) + 1);
  }
  for (const row of followingCountResult.data ?? []) {
    followingCounts.set(row.follower_id, (followingCounts.get(row.follower_id) ?? 0) + 1);
  }

  const members = profiles.map((profile) => {
    const privateAccount = privacyMap.get(profile.id) ?? false;
    const viewerFollows = following.has(profile.id);
    return {
      id: profile.id,
      fullName: profile.full_name,
      username: profile.username,
      avatarUrl: profile.avatar_url,
      bio: admin || !privateAccount || viewerFollows ? profile.bio : null,
      isAdmin: Boolean(profile.is_admin),
      privateAccount,
      following: viewerFollows,
      followsYou: followers.has(profile.id),
      mutual: viewerFollows && followers.has(profile.id),
      requested: requested.has(profile.id),
      followerCount: followerCounts.get(profile.id) ?? 0,
      followingCount: followingCounts.get(profile.id) ?? 0,
    };
  });

  return NextResponse.json(
    {
      members,
      page,
      pageSize,
      total: Math.min(count ?? members.length, from + members.length + (profiles.length === pageSize ? 1 : 0)),
      hasMore:
        profiles.length === pageSize &&
        (from + profiles.length < (count ?? from + profiles.length + 1) ||
          (candidateProfiles?.length ?? 0) > profiles.length),
      adminVisibility: admin,
      teenSafetyFiltered: !admin && (candidateProfiles?.length ?? 0) > profiles.length,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
