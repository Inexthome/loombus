import { NextRequest, NextResponse } from "next/server";
import {
  createMemberPrivacyServiceClient,
  requireMemberUser,
} from "@/lib/member-privacy-server";

type RangeKey = "7d" | "30d" | "90d" | "all";

type BlockRow = {
  blocker_id: string;
  blocked_id: string;
};

const rangeDays: Record<RangeKey, number | null> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  all: null,
};

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "private, no-store" } }
  );
}

function getSince(range: RangeKey) {
  const days = rangeDays[range];
  if (!days) return null;
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function signalDepth(actions: number, contributors: number) {
  if (!contributors) return 0;
  return Number((actions / contributors).toFixed(2));
}

export async function GET(request: NextRequest) {
  const service = createMemberPrivacyServiceClient();
  if (!service) return jsonError("Insights service is not configured.", 503);

  const { user } = await requireMemberUser(request);
  if (!user) return jsonError("Unauthorized.", 401);

  const requestedRange = String(request.nextUrl.searchParams.get("range") ?? "30d");
  const range: RangeKey = requestedRange in rangeDays ? (requestedRange as RangeKey) : "30d";
  const since = getSince(range);

  let discussionsQuery = service
    .from("discussions")
    .select("id, title, created_at")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (since) discussionsQuery = discussionsQuery.gte("created_at", since);

  const [{ data: discussions, error: discussionsError }, { data: blockRows, error: blocksError }] =
    await Promise.all([
      discussionsQuery,
      service
        .from("user_blocks")
        .select("blocker_id, blocked_id")
        .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`),
    ]);

  if (discussionsError) return jsonError(discussionsError.message, 500);
  if (blocksError) return jsonError(blocksError.message, 500);

  const blockedUserIds = new Set<string>();
  for (const block of (blockRows ?? []) as BlockRow[]) {
    blockedUserIds.add(block.blocker_id === user.id ? block.blocked_id : block.blocker_id);
  }

  const owned = discussions ?? [];
  const ids = owned.map((item) => item.id);

  if (!ids.length) {
    return NextResponse.json(
      {
        range,
        totals: {
          views: 0,
          uniqueReach: 0,
          repliesReceived: 0,
          savesEarned: 0,
          engagedMembers: 0,
          signalActions: 0,
          signalContributors: 0,
          signalDepth: 0,
          knowledgeOriginDiscussions: 0,
        },
        discussions: [],
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  let viewsQuery = service
    .from("discussion_views")
    .select("discussion_id, viewer_id, viewed_at")
    .in("discussion_id", ids)
    .neq("viewer_id", user.id);

  let repliesQuery = service
    .from("replies")
    .select("discussion_id, user_id, created_at")
    .in("discussion_id", ids)
    .is("deleted_at", null)
    .neq("user_id", user.id);

  let savesQuery = service
    .from("bookmarks")
    .select("discussion_id, user_id, created_at")
    .in("discussion_id", ids)
    .neq("user_id", user.id);

  if (since) {
    viewsQuery = viewsQuery.gte("viewed_at", since);
    repliesQuery = repliesQuery.gte("created_at", since);
    savesQuery = savesQuery.gte("created_at", since);
  }

  const [viewsResult, repliesResult, savesResult, promotionsResult] = await Promise.all([
    viewsQuery,
    repliesQuery,
    savesQuery,
    service
      .from("library_knowledge_discussion_promotions")
      .select("discussion_id, source_knowledge_type, source_knowledge_status")
      .eq("user_id", user.id)
      .in("discussion_id", ids),
  ]);

  const firstError =
    viewsResult.error || repliesResult.error || savesResult.error || promotionsResult.error;
  if (firstError) return jsonError(firstError.message, 500);

  const views = (viewsResult.data ?? []).filter(
    (row) => !row.viewer_id || !blockedUserIds.has(row.viewer_id)
  );
  const replies = (repliesResult.data ?? []).filter(
    (row) => !row.user_id || !blockedUserIds.has(row.user_id)
  );
  const saves = (savesResult.data ?? []).filter(
    (row) => !row.user_id || !blockedUserIds.has(row.user_id)
  );
  const promotions = promotionsResult.data ?? [];
  const promotionByDiscussion = new Map(
    promotions.map((promotion) => [promotion.discussion_id, promotion])
  );

  const overallViewers = new Set<string>();
  const overallEngaged = new Set<string>();
  const overallSignalContributors = new Set<string>();
  const byDiscussion = new Map<
    string,
    {
      views: number;
      viewers: Set<string>;
      repliers: Set<string>;
      savers: Set<string>;
      replies: number;
      saves: number;
    }
  >();

  for (const id of ids) {
    byDiscussion.set(id, {
      views: 0,
      viewers: new Set(),
      repliers: new Set(),
      savers: new Set(),
      replies: 0,
      saves: 0,
    });
  }

  for (const row of views) {
    const bucket = byDiscussion.get(row.discussion_id);
    if (!bucket) continue;
    bucket.views += 1;
    if (row.viewer_id) {
      bucket.viewers.add(row.viewer_id);
      overallViewers.add(row.viewer_id);
      overallEngaged.add(row.viewer_id);
    }
  }

  for (const row of replies) {
    const bucket = byDiscussion.get(row.discussion_id);
    if (!bucket) continue;
    bucket.replies += 1;
    if (row.user_id) {
      bucket.repliers.add(row.user_id);
      overallEngaged.add(row.user_id);
      overallSignalContributors.add(row.user_id);
    }
  }

  for (const row of saves) {
    const bucket = byDiscussion.get(row.discussion_id);
    if (!bucket) continue;
    bucket.saves += 1;
    if (row.user_id) {
      bucket.savers.add(row.user_id);
      overallEngaged.add(row.user_id);
      overallSignalContributors.add(row.user_id);
    }
  }

  const discussionMetrics = owned.map((discussion) => {
    const bucket = byDiscussion.get(discussion.id)!;
    const promotion = promotionByDiscussion.get(discussion.id);
    const engaged = new Set<string>([
      ...bucket.viewers,
      ...bucket.repliers,
      ...bucket.savers,
    ]);
    const signalContributors = new Set<string>([
      ...bucket.repliers,
      ...bucket.savers,
    ]);
    const signalActions = bucket.replies + bucket.saves;

    return {
      id: discussion.id,
      title: discussion.title,
      createdAt: discussion.created_at,
      views: bucket.views,
      uniqueReach: bucket.viewers.size,
      repliesReceived: bucket.replies,
      savesEarned: bucket.saves,
      engagedMembers: engaged.size,
      signalActions,
      signalContributors: signalContributors.size,
      signalDepth: signalDepth(signalActions, signalContributors.size),
      knowledgeOrigin: Boolean(promotion),
      knowledgeType: promotion?.source_knowledge_type ?? null,
      knowledgeStatus: promotion?.source_knowledge_status ?? null,
    };
  });

  const totalSignalActions = replies.length + saves.length;

  return NextResponse.json(
    {
      range,
      totals: {
        views: views.length,
        uniqueReach: overallViewers.size,
        repliesReceived: replies.length,
        savesEarned: saves.length,
        engagedMembers: overallEngaged.size,
        signalActions: totalSignalActions,
        signalContributors: overallSignalContributors.size,
        signalDepth: signalDepth(totalSignalActions, overallSignalContributors.size),
        knowledgeOriginDiscussions: promotions.length,
      },
      discussions: discussionMetrics,
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
