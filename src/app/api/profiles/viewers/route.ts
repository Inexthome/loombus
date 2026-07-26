import { NextRequest, NextResponse } from "next/server";
import {
  createMemberPrivacyServiceClient,
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
  if (!service) return jsonError("Profile viewer service is not configured.", 503);

  const { user } = await requireMemberUser(request);
  if (!user) return jsonError("Unauthorized.", 401);

  const [{ data: rows, error }, { data: blockRows }, { count }] = await Promise.all([
    service
      .from("profile_views")
      .select("viewer_id, identity_visible, viewed_at")
      .eq("profile_id", user.id)
      .neq("viewer_id", user.id)
      .order("viewed_at", { ascending: false })
      .limit(200),
    service
      .from("user_blocks")
      .select("blocker_id, blocked_id")
      .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`),
    service
      .from("profile_views")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", user.id)
      .neq("viewer_id", user.id),
  ]);

  if (error) return jsonError(error.message, 500);

  const blockedIds = new Set<string>();
  for (const block of blockRows ?? []) {
    blockedIds.add(block.blocker_id === user.id ? block.blocked_id : block.blocker_id);
  }

  const latestByViewer = new Map<
    string,
    { viewer_id: string; identity_visible: boolean; viewed_at: string }
  >();
  for (const row of rows ?? []) {
    if (blockedIds.has(row.viewer_id) || latestByViewer.has(row.viewer_id)) continue;
    latestByViewer.set(row.viewer_id, row);
    if (latestByViewer.size >= 30) break;
  }

  const visibleIds = [...latestByViewer.values()]
    .filter((row) => row.identity_visible)
    .map((row) => row.viewer_id);
  const { data: profiles } = visibleIds.length
    ? await service
        .from("profiles")
        .select("id, full_name, username, avatar_url")
        .in("id", visibleIds)
    : { data: [] };
  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  const viewers = [...latestByViewer.values()].map((row) => ({
    viewedAt: row.viewed_at,
    privateViewer: !row.identity_visible,
    profile: row.identity_visible ? profileMap.get(row.viewer_id) ?? null : null,
  }));

  return NextResponse.json(
    { viewers, totalViews: count ?? 0 },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
