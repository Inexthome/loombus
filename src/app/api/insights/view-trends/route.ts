import { NextRequest, NextResponse } from "next/server";
import {
  createMemberPrivacyServiceClient,
  requireMemberUser,
} from "@/lib/member-privacy-server";

type RangeKey = "7d" | "30d" | "90d" | "all";
type BucketMode = "day" | "week" | "month";

type TrendBucket = {
  start: string;
  label: string;
  totalViews: number;
  knowledgeViews: number;
  regularViews: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "private, no-store" } }
  );
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfUtcWeek(date: Date) {
  const day = startOfUtcDay(date);
  const weekday = day.getUTCDay();
  const daysFromMonday = (weekday + 6) % 7;
  return new Date(day.getTime() - daysFromMonday * DAY_MS);
}

function startOfUtcMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function bucketStart(date: Date, mode: BucketMode) {
  if (mode === "week") return startOfUtcWeek(date);
  if (mode === "month") return startOfUtcMonth(date);
  return startOfUtcDay(date);
}

function addBucket(date: Date, mode: BucketMode) {
  if (mode === "week") return new Date(date.getTime() + 7 * DAY_MS);
  if (mode === "month") {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  }
  return new Date(date.getTime() + DAY_MS);
}

function formatLabel(date: Date, mode: BucketMode) {
  if (mode === "month") {
    return new Intl.DateTimeFormat("en", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);
  }
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function rangeConfig(range: RangeKey, now: Date) {
  if (range === "7d") {
    const end = startOfUtcDay(now);
    return { mode: "day" as const, start: new Date(end.getTime() - 6 * DAY_MS) };
  }
  if (range === "30d") {
    const end = startOfUtcDay(now);
    return { mode: "day" as const, start: new Date(end.getTime() - 29 * DAY_MS) };
  }
  if (range === "90d") {
    const end = startOfUtcWeek(now);
    return { mode: "week" as const, start: new Date(end.getTime() - 12 * 7 * DAY_MS) };
  }
  return { mode: "month" as const, start: null };
}

function buildBuckets(start: Date, end: Date, mode: BucketMode) {
  const buckets: TrendBucket[] = [];
  for (let cursor = bucketStart(start, mode); cursor <= end; cursor = addBucket(cursor, mode)) {
    buckets.push({
      start: cursor.toISOString(),
      label: formatLabel(cursor, mode),
      totalViews: 0,
      knowledgeViews: 0,
      regularViews: 0,
    });
  }
  return buckets;
}

export async function GET(request: NextRequest) {
  const service = createMemberPrivacyServiceClient();
  if (!service) return jsonError("Insights service is not configured.", 503);

  const { user } = await requireMemberUser(request);
  if (!user) return jsonError("Unauthorized.", 401);

  const requestedRange = String(request.nextUrl.searchParams.get("range") ?? "30d");
  const range: RangeKey = ["7d", "30d", "90d", "all"].includes(requestedRange)
    ? (requestedRange as RangeKey)
    : "30d";

  const [{ data: discussions, error: discussionsError }, { data: blockRows, error: blocksError }] =
    await Promise.all([
      service
        .from("discussions")
        .select("id")
        .eq("user_id", user.id)
        .is("deleted_at", null),
      service
        .from("user_blocks")
        .select("blocker_id, blocked_id")
        .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`),
    ]);

  if (discussionsError) return jsonError(discussionsError.message, 500);
  if (blocksError) return jsonError(blocksError.message, 500);

  const blockedUserIds = new Set(
    (blockRows ?? []).map((block) =>
      block.blocker_id === user.id ? block.blocked_id : block.blocker_id
    )
  );
  const ids = (discussions ?? []).map((discussion) => discussion.id);
  if (!ids.length) {
    return NextResponse.json(
      { range, bucket: range === "90d" ? "week" : range === "all" ? "month" : "day", points: [] },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  const now = new Date();
  const config = rangeConfig(range, now);

  let viewsQuery = service
    .from("discussion_views")
    .select("discussion_id, viewer_id, viewed_at")
    .in("discussion_id", ids)
    .neq("viewer_id", user.id)
    .order("viewed_at", { ascending: true });

  if (config.start) viewsQuery = viewsQuery.gte("viewed_at", config.start.toISOString());

  const [viewsResult, promotionsResult] = await Promise.all([
    viewsQuery,
    service
      .from("library_knowledge_discussion_promotions")
      .select("discussion_id")
      .eq("user_id", user.id)
      .in("discussion_id", ids),
  ]);

  const firstError = viewsResult.error || promotionsResult.error;
  if (firstError) return jsonError(firstError.message, 500);

  const views = (viewsResult.data ?? []).filter(
    (view) => !view.viewer_id || !blockedUserIds.has(view.viewer_id)
  );
  const knowledgeIds = new Set((promotionsResult.data ?? []).map((row) => row.discussion_id));
  const mode = config.mode;

  if (!views.length && !config.start) {
    return NextResponse.json(
      { range, bucket: mode, points: [] },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  const firstView = views.length ? new Date(views[0].viewed_at) : now;
  const start = config.start ?? startOfUtcMonth(firstView);
  const end = bucketStart(now, mode);
  const points = buildBuckets(start, end, mode);
  const pointByStart = new Map(points.map((point) => [point.start, point]));

  for (const view of views) {
    const date = new Date(view.viewed_at);
    if (Number.isNaN(date.getTime())) continue;
    const key = bucketStart(date, mode).toISOString();
    const point = pointByStart.get(key);
    if (!point) continue;
    point.totalViews += 1;
    if (knowledgeIds.has(view.discussion_id)) point.knowledgeViews += 1;
    else point.regularViews += 1;
  }

  return NextResponse.json(
    { range, bucket: mode, points },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
