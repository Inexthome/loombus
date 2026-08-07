import { NextRequest, NextResponse } from "next/server";
import {
  createMemberPrivacyServiceClient,
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

export async function GET(request: NextRequest) {
  const service = createMemberPrivacyServiceClient();
  if (!service) return jsonError("Discussion viewer service is not configured.", 503);

  const { user } = await requireMemberUser(request);
  if (!user) return jsonError("Unauthorized.", 401);

  const discussionId = String(
    request.nextUrl.searchParams.get("discussionId") ?? ""
  ).trim();
  if (!UUID_PATTERN.test(discussionId)) return jsonError("Invalid discussion id.", 400);

  const { data: discussion, error: discussionError } = await service
    .from("discussions")
    .select("id, user_id")
    .eq("id", discussionId)
    .is("deleted_at", null)
    .maybeSingle();
  if (discussionError) return jsonError(discussionError.message, 500);
  if (!discussion) return jsonError("Discussion not found.", 404);

  const { data: viewerProfile } = await service
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (discussion.user_id !== user.id && viewerProfile?.is_admin !== true) {
    return jsonError("Only the discussion owner can view reader identities.", 403);
  }

  const [{ data: rows, error }, { data: blockRows }, { count }] = await Promise.all([
    service
      .from("discussion_views")
      .select("viewer_id, viewed_at")
      .eq("discussion_id", discussionId)
      .not("viewer_id", "is", null)
      .neq("viewer_id", discussion.user_id)
      .order("viewed_at", { ascending: false })
      .limit(250),
    service
      .from("user_blocks")
      .select("blocker_id, blocked_id")
      .or(`blocker_id.eq.${discussion.user_id},blocked_id.eq.${discussion.user_id}`),
    service
      .from("discussion_views")
      .select("discussion_id", { count: "exact", head: true })
      .eq("discussion_id", discussionId)
      .not("viewer_id", "is", null)
      .neq("viewer_id", discussion.user_id),
  ]);

  if (error) return jsonError(error.message, 500);

  const blockedIds = new Set<string>();
  for (const block of blockRows ?? []) {
    blockedIds.add(
      block.blocker_id === discussion.user_id ? block.blocked_id : block.blocker_id
    );
  }

  const latestByViewer = new Map<
    string,
    { viewer_id: string; viewed_at: string }
  >();
  for (const row of rows ?? []) {
    if (!row.viewer_id || blockedIds.has(row.viewer_id) || latestByViewer.has(row.viewer_id)) {
      continue;
    }
    latestByViewer.set(row.viewer_id, row);
    if (latestByViewer.size >= 30) break;
  }

  const viewerIds = [...latestByViewer.keys()];
  const { data: profiles } = viewerIds.length
    ? await service
        .from("profiles")
        .select("id, full_name, username, avatar_url")
        .in("id", viewerIds)
    : { data: [] };
  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  const viewers = [...latestByViewer.values()].map((row) => ({
    viewedAt: row.viewed_at,
    profile: profileMap.get(row.viewer_id) ?? null,
  }));

  return NextResponse.json(
    { viewers, totalAuthenticatedViews: count ?? 0 },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
