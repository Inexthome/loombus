import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";

type MemberConnectionsMode = "followers" | "following";

type FollowRow = {
  follower_id: string;
  following_id: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
};

type BlockRow = {
  blocker_id: string;
  blocked_id: string;
};

const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{1,60}$/;

function getSupabaseForRequest(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment configuration.");
  }

  const authorization = request.headers.get("authorization") ?? "";

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: authorization ? { Authorization: authorization } : {},
    },
  });
}

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json(code ? { error: message, code } : { error: message }, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function uniqueIds(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

export async function GET(request: NextRequest) {
  let supabase;

  try {
    supabase = getSupabaseForRequest(request);
  } catch {
    return jsonError("Member-network service is not configured.", 500);
  }

  const accountAccess = await verifyRequestAccountAccess(supabase);

  if (!accountAccess.ok) {
    return jsonError(
      accountAccess.error,
      accountAccess.status,
      accountAccess.code
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const username = (searchParams.get("username") ?? "").trim();
  const modeValue = searchParams.get("mode");

  if (!USERNAME_PATTERN.test(username)) {
    return jsonError("Invalid member username.", 400, "invalid_username");
  }

  if (modeValue !== "followers" && modeValue !== "following") {
    return jsonError("Invalid member-network view.", 400, "invalid_mode");
  }

  const mode: MemberConnectionsMode = modeValue;

  const { data: ownerData, error: ownerError } = await supabase
    .from("profiles")
    .select("id, full_name, username, bio, avatar_url")
    .eq("username", username)
    .maybeSingle();

  if (ownerError) {
    return jsonError(
      "Unable to load the member profile.",
      503,
      "member_profile_unavailable"
    );
  }

  if (!ownerData) {
    return jsonError("Member profile not found.", 404, "member_not_found");
  }

  const owner = ownerData as ProfileRow;
  const viewerId = accountAccess.user.id;

  const [blockResult, followerResult, followingResult] = await Promise.all([
    supabase
      .from("user_blocks")
      .select("blocker_id, blocked_id")
      .or(`blocker_id.eq.${viewerId},blocked_id.eq.${viewerId}`),
    supabase
      .from("follows")
      .select("follower_id, following_id")
      .eq("following_id", owner.id),
    supabase
      .from("follows")
      .select("follower_id, following_id")
      .eq("follower_id", owner.id),
  ]);

  if (blockResult.error) {
    return jsonError(
      "Unable to verify member-network privacy.",
      503,
      "member_network_privacy_unavailable"
    );
  }

  if (followerResult.error || followingResult.error) {
    return jsonError(
      "Unable to load this member network.",
      503,
      "member_connections_unavailable"
    );
  }

  const hiddenIds = new Set<string>();

  for (const block of (blockResult.data ?? []) as BlockRow[]) {
    hiddenIds.add(
      block.blocker_id === viewerId ? block.blocked_id : block.blocker_id
    );
  }

  if (hiddenIds.has(owner.id)) {
    return jsonError("Member profile not found.", 404, "member_not_found");
  }

  const followerIds = uniqueIds(
    ((followerResult.data ?? []) as FollowRow[]).map((row) => row.follower_id)
  ).filter((id) => !hiddenIds.has(id));

  const followingIds = uniqueIds(
    ((followingResult.data ?? []) as FollowRow[]).map((row) => row.following_id)
  ).filter((id) => !hiddenIds.has(id));

  const selectedIds = mode === "followers" ? followerIds : followingIds;
  let profiles = new Map<string, ProfileRow>();
  const viewerFollowing = new Set<string>();
  const followsViewer = new Set<string>();

  if (selectedIds.length > 0) {
    const [profileResult, viewerFollowingResult, followsViewerResult] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, username, bio, avatar_url")
          .in("id", selectedIds),
        supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", viewerId)
          .in("following_id", selectedIds),
        supabase
          .from("follows")
          .select("follower_id")
          .eq("following_id", viewerId)
          .in("follower_id", selectedIds),
      ]);

    if (profileResult.error) {
      return jsonError(
        "Unable to load member profiles.",
        503,
        "member_connection_profiles_unavailable"
      );
    }

    if (viewerFollowingResult.error || followsViewerResult.error) {
      return jsonError(
        "Unable to load relationship context.",
        503,
        "member_relationships_unavailable"
      );
    }

    profiles = new Map(
      ((profileResult.data ?? []) as ProfileRow[]).map((profile) => [
        profile.id,
        profile,
      ])
    );

    for (const row of viewerFollowingResult.data ?? []) {
      if (row.following_id) viewerFollowing.add(row.following_id);
    }

    for (const row of followsViewerResult.data ?? []) {
      if (row.follower_id) followsViewer.add(row.follower_id);
    }
  }

  const items = selectedIds
    .map((id) => profiles.get(id))
    .filter((profile): profile is ProfileRow => Boolean(profile))
    .map((profile) => {
      const viewerFollows = viewerFollowing.has(profile.id);
      const profileFollowsViewer = followsViewer.has(profile.id);

      return {
        profile,
        viewerFollows,
        followsViewer: profileFollowsViewer,
        mutual: viewerFollows && profileFollowsViewer,
      };
    })
    .sort((a, b) => {
      const aName =
        a.profile.full_name?.trim() ||
        a.profile.username?.trim() ||
        "Loombus member";
      const bName =
        b.profile.full_name?.trim() ||
        b.profile.username?.trim() ||
        "Loombus member";
      return aName.localeCompare(bName);
    });

  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      mode,
      viewerId,
      viewerIsOwner: viewerId === owner.id,
      owner,
      counts: {
        followers: followerIds.length,
        following: followingIds.length,
      },
      items,
    },
    {
      headers: { "Cache-Control": "private, no-store" },
    }
  );
}
