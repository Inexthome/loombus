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
  signalActions: number;
  replies: number;
  saves: number;
  knowledgeSignal: number;
  regularSignal: number;
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
      signalActions: 0,
      replies: 0,
      saves: 0,
      knowledgeSignal: 0,
      regularSignal: 0,
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

  const { data: discussions, error: discussionsError } = await service
    .from("discussions")
    .select("id")
    .eq("user_id", user.id)
    .is("deleted_at", null);

  if (discussionsError) return jsonError(discussionsError.message, 500);

  const ids = (discussions ?? []).map((discussion) => discussion.id);
  const bucket = range === "90d" ? "week" : range === "all" ? "month" : "day";
  if (!ids.length) {
    return NextResponse.json(
      { range, bucket, points: [] },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  const now = new Date();
  const config = rangeConfig(range, now);

  let repliesQuery = service
    .from("replies")
    .select("discussion_id, user_id, created_at")
    .in("discussion_id", ids)
    .is("deleted_at", null)
    .neq("user_id", user.id)
    .order("created_at", { ascending: true });

  let savesQuery = service
    .from("bookmarks")
    .select("discussion_id, user_id, created_at")
    .in("discussion_id", ids)
    .neq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (config.start) {
    repliesQuery = repliesQuery.gte("created_at", config.start.toISOString());
    savesQuery = savesQuery.gte("created_at", config.start.toISOString());
  }

  const [repliesResult, savesResult, promotionsResult] = await Promise.all([
    repliesQuery,
    savesQuery,
    service
      .from("library_knowledge_discussion_promotions")
      .select("discussion_id")
      .eq("user_id", user.id)
      .in("discussion_id", ids),
  ]);

  const firstError = repliesResult.error || savesResult.error || promotionsResult.error;
  if (firstError) return jsonError(firstError.message, 500);

  const replies = repliesResult.data ?? [];
  const saves = savesResult.data ?? [];
  const knowledgeIds = new Set((promotionsResult.data ?? []).map((row) => row.discussion_id));
  const mode = config.mode;
  const events = [
    ...replies.map((row) => ({ ...row, kind: "reply" as const })),
    ...saves.map((row) => ({ ...row, kind: "save" as const })),
  ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  if (!events.length && !config.start) {
    return NextResponse.json(
      { range, bucket: mode, points: [] },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  const firstEvent = events.length ? new Date(events[0].created_at) : now;
  const start = config.start ?? startOfUtcMonth(firstEvent);
  const end = bucketStart(now, mode);
  const points = buildBuckets(start, end, mode);
  const pointByStart = new Map(points.map((point) => [point.start, point]));

  for (const event of events) {
    const date = new Date(event.created_at);
    if (Number.isNaN(date.getTime())) continue;
    const key = bucketStart(date, mode).toISOString();
    const point = pointByStart.get(key);
    if (!point) continue;

    point.signalActions += 1;
    if (event.kind === "reply") point.replies += 1;
    else point.saves += 1;

    if (knowledgeIds.has(event.discussion_id)) point.knowledgeSignal += 1;
    else point.regularSignal += 1;
  }

  return NextResponse.json(
    { range, bucket: mode, points },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
