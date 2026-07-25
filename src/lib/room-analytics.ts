import "server-only";

import {
  getRoomPlanEntitlements,
  type RoomPlanEntitlements,
} from "@/lib/room-plan-entitlements";
import {
  asNumber,
  asString,
  createRoomServiceSupabase,
  getRoomAccess,
  type RoomAccess,
  type RoomRow,
} from "@/lib/room-operations";
import { isCustomerSupportRoomType } from "@/lib/room-required-behaviors";

type ServiceClient = ReturnType<typeof createRoomServiceSupabase>;
type JsonObject = Record<string, unknown>;
type HealthLevel = "action" | "watch" | "good" | "info";

type HealthFinding = {
  level: HealthLevel;
  title: string;
  detail: string;
  deduction: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const VALID_WINDOWS = new Set([7, 30, 90]);

const LIMITS = {
  members: 10000,
  activity: 15000,
  posts: 5000,
  replies: 15000,
  moderation: 2500,
  resources: 7500,
  events: 2500,
  rsvps: 20000,
  tasks: 7500,
  preferences: 10000,
  notifications: 20000,
} as const;

export class RoomAnalyticsError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "room_analytics_error") {
    super(message);
    this.name = "RoomAnalyticsError";
    this.status = status;
    this.code = code;
  }
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function validDateMs(value: unknown) {
  const raw = asString(value);
  if (!raw) return null;
  const time = new Date(raw).getTime();
  return Number.isFinite(time) ? time : null;
}

function rounded(value: number, digits = 1) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function percentage(numerator: number, denominator: number) {
  return denominator > 0 ? rounded((numerator / denominator) * 100) : 0;
}

function median(values: number[]) {
  const clean = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (clean.length === 0) return null;
  const middle = Math.floor(clean.length / 2);
  return clean.length % 2 === 0
    ? rounded((clean[middle - 1] + clean[middle]) / 2)
    : rounded(clean[middle]);
}

function deltaPercent(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return rounded(((current - previous) / previous) * 100);
}

function isActiveMember(row: RoomRow, now: number) {
  const status = asString(row.status).toLowerCase() || "active";
  if (["blocked", "removed", "inactive", "suspended"].includes(status)) {
    return false;
  }
  const suspendedUntil = validDateMs(row.suspended_until);
  return suspendedUntil === null || suspendedUntil <= now;
}

function isSuspendedMember(row: RoomRow, now: number) {
  const status = asString(row.status).toLowerCase();
  const suspendedUntil = validDateMs(row.suspended_until);
  return status === "suspended" || (suspendedUntil !== null && suspendedUntil > now);
}

function isWithin(value: unknown, start: number, end = Number.POSITIVE_INFINITY) {
  const time = validDateMs(value);
  return time !== null && time >= start && time < end;
}

function dayKey(value: unknown) {
  const time = validDateMs(value);
  return time === null ? "" : new Date(time).toISOString().slice(0, 10);
}

function assertResult(
  result: { error: { message?: string | null } | null },
  source: string
) {
  if (result.error) {
    throw new RoomAnalyticsError(
      result.error.message || `${source} could not be loaded.`,
      503,
      "room_analytics_storage_unavailable"
    );
  }
}

async function requireAnalyticsAccess(
  service: ServiceClient,
  roomId: string,
  userId: string
): Promise<{ access: RoomAccess; plan: RoomPlanEntitlements }> {
  const access = await getRoomAccess(service, roomId, userId).catch(() => null);
  if (!access) {
    throw new RoomAnalyticsError("Room not found.", 404, "room_not_found");
  }
  if (!access.allowed && !access.isOwner) {
    throw new RoomAnalyticsError(
      "Active Room membership is required.",
      403,
      "room_membership_required"
    );
  }
  if (!access.canManage) {
    throw new RoomAnalyticsError(
      "Room management access is required.",
      403,
      "room_analytics_manager_required"
    );
  }

  const plan = getRoomPlanEntitlements(
    access.room.subscriptionPlan,
    access.room.subscriptionStatus
  );
  if (!plan.modules.includes("operations")) {
    throw new RoomAnalyticsError(
      "Room analytics and operational health begin with Organization Plus.",
      403,
      "room_analytics_plan_required"
    );
  }

  return { access, plan };
}

function buildTrend(
  days: number,
  activity: RoomRow[],
  posts: RoomRow[],
  replies: RoomRow[],
  now: number
) {
  const points = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(now - offset * DAY_MS).toISOString().slice(0, 10);
    points.push({ date, activity: 0, discussions: 0, replies: 0 });
  }
  const byDate = new Map(points.map((point) => [point.date, point]));

  for (const row of activity) {
    const point = byDate.get(dayKey(row.created_at));
    if (point) point.activity += 1;
  }
  for (const row of posts) {
    const point = byDate.get(dayKey(row.created_at));
    if (point) point.discussions += 1;
  }
  for (const row of replies) {
    const point = byDate.get(dayKey(row.created_at));
    if (point) point.replies += 1;
  }
  return points;
}

function buildHealth(args: {
  access: RoomAccess;
  memberUtilization: number | null;
  storageUtilization: number | null;
  openModeration: number;
  urgentModeration: number;
  unassignedModeration: number;
  oldestModerationHours: number | null;
  activeTasks: number;
  overdueTasks: number;
  blockedTasks: number;
  maturedDiscussions: number;
  unansweredAfter24Hours: number;
  retentionStatus: string | null;
  cappedSources: string[];
}) {
  let score = 100;
  const findings: HealthFinding[] = [];
  const add = (
    level: HealthLevel,
    title: string,
    detail: string,
    deduction = 0
  ) => {
    score -= deduction;
    findings.push({ level, title, detail, deduction });
  };

  const subscriptionStatus = args.access.room.subscriptionStatus.toLowerCase();
  if (subscriptionStatus === "past_due") {
    add(
      "watch",
      "Subscription is in a grace period",
      "Resolve billing before paid Room operations are restricted.",
      8
    );
  }

  if (args.memberUtilization !== null) {
    if (args.memberUtilization >= 95) {
      add(
        "action",
        "Member capacity is nearly full",
        `${args.memberUtilization}% of the Room member limit is in use.`,
        15
      );
    } else if (args.memberUtilization >= 80) {
      add(
        "watch",
        "Member capacity is tightening",
        `${args.memberUtilization}% of the Room member limit is in use.`,
        7
      );
    }
  }

  if (args.storageUtilization !== null) {
    if (args.storageUtilization >= 95) {
      add(
        "action",
        "Room storage is nearly full",
        `${args.storageUtilization}% of the storage allowance is in use.`,
        15
      );
    } else if (args.storageUtilization >= 80) {
      add(
        "watch",
        "Room storage is filling up",
        `${args.storageUtilization}% of the storage allowance is in use.`,
        7
      );
    }
  }

  if (args.urgentModeration > 0) {
    add(
      "action",
      "Urgent moderation work is open",
      `${args.urgentModeration} urgent or high-priority report${
        args.urgentModeration === 1 ? " is" : "s are"
      } awaiting final disposition.`,
      Math.min(16, 10 + args.urgentModeration * 2)
    );
  }
  if (args.unassignedModeration > 0) {
    add(
      "watch",
      "Moderation reports need assignment",
      `${args.unassignedModeration} open report${
        args.unassignedModeration === 1 ? " is" : "s are"
      } unassigned.`,
      Math.min(8, 3 + args.unassignedModeration)
    );
  }
  if ((args.oldestModerationHours ?? 0) >= 72) {
    add(
      "action",
      "A moderation report has waited more than three days",
      `The oldest open report is ${rounded(args.oldestModerationHours ?? 0)} hours old.`,
      8
    );
  } else if ((args.oldestModerationHours ?? 0) >= 24) {
    add(
      "watch",
      "A moderation report has waited more than one day",
      `The oldest open report is ${rounded(args.oldestModerationHours ?? 0)} hours old.`,
      4
    );
  }

  if (args.overdueTasks > 0) {
    const overdueRate = percentage(args.overdueTasks, Math.max(args.activeTasks, 1));
    add(
      overdueRate >= 30 ? "action" : "watch",
      "Operational tasks are overdue",
      `${args.overdueTasks} active task${args.overdueTasks === 1 ? " is" : "s are"} overdue (${overdueRate}%).`,
      overdueRate >= 30 ? 10 : 5
    );
  }
  if (args.blockedTasks > 0) {
    add(
      "watch",
      "Blocked tasks need review",
      `${args.blockedTasks} task${args.blockedTasks === 1 ? " is" : "s are"} marked blocked.`,
      Math.min(6, 2 + args.blockedTasks)
    );
  }

  if (args.maturedDiscussions >= 3) {
    const unansweredRate = percentage(
      args.unansweredAfter24Hours,
      args.maturedDiscussions
    );
    if (unansweredRate >= 40) {
      add(
        "action",
        "Many discussions are waiting for a response",
        `${unansweredRate}% of discussions older than 24 hours have no response from another member.`,
        10
      );
    } else if (unansweredRate >= 20) {
      add(
        "watch",
        "Discussion response coverage is slipping",
        `${unansweredRate}% of discussions older than 24 hours have no response from another member.`,
        5
      );
    }
  }

  if (args.retentionStatus === "failed") {
    add(
      "action",
      "The latest retention run failed",
      "Review the retention workspace before staging or deleting additional records.",
      12
    );
  }

  if (args.cappedSources.length > 0) {
    add(
      "info",
      "Some analytics reached a safety cap",
      `The next scale-testing phase should paginate or aggregate: ${args.cappedSources.join(
        ", "
      )}.`
    );
  }

  score = Math.max(0, Math.min(100, score));
  if (!findings.some((finding) => finding.level === "action" || finding.level === "watch")) {
    add(
      "good",
      "No immediate operational pressure detected",
      "Capacity, workload, moderation, response, and retention indicators are within the current thresholds."
    );
  }

  const status = score >= 85 ? "healthy" : score >= 65 ? "watch" : "action";
  return {
    score,
    status,
    label:
      status === "healthy"
        ? "Operationally healthy"
        : status === "watch"
          ? "Needs monitoring"
          : "Needs action",
    findings,
    dataComplete: args.cappedSources.length === 0,
    cappedSources: args.cappedSources,
  };
}

export async function getRoomAnalyticsOverview(
  roomId: string,
  userId: string,
  requestedWindow = 30
) {
  const windowDays = VALID_WINDOWS.has(requestedWindow) ? requestedWindow : 30;
  const service = createRoomServiceSupabase();
  const { access, plan } = await requireAnalyticsAccess(service, roomId, userId);
  const supportRoom = isCustomerSupportRoomType(access.room.roomType);
  const now = Date.now();
  const currentSince = now - windowDays * DAY_MS;
  const previousSince = now - windowDays * 2 * DAY_MS;
  const sevenDaysSince = now - 7 * DAY_MS;
  const matureCutoff = now - DAY_MS;
  const upcomingLimit = now + 90 * DAY_MS;

  const [
    membersResult,
    activityResult,
    postsResult,
    repliesResult,
    moderationResult,
    resourcesResult,
    eventsResult,
    rsvpsResult,
    tasksResult,
    preferencesResult,
    notificationsResult,
    retentionRunsResult,
    retentionHoldsResult,
  ] = await Promise.all([
    service
      .from("room_members")
      .select("user_id, role, status, suspended_until, joined_at, created_at")
      .eq("room_id", roomId)
      .limit(LIMITS.members),
    service
      .from("room_activity_events")
      .select("event_type, module_key, actor_id, audience, importance, created_at")
      .eq("room_id", roomId)
      .gte("created_at", new Date(previousSince).toISOString())
      .order("created_at", { ascending: false })
      .limit(LIMITS.activity),
    service
      .from("room_posts")
      .select("id, author_id, status, visibility_scope, created_at, deleted_at")
      .eq("room_id", roomId)
      .gte("created_at", new Date(previousSince).toISOString())
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(LIMITS.posts),
    service
      .from("room_post_replies")
      .select("id, post_id, author_id, created_at, deleted_at")
      .eq("room_id", roomId)
      .gte("created_at", new Date(previousSince).toISOString())
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(LIMITS.replies),
    service
      .from("room_moderation_queue")
      .select(
        "status, priority, assigned_to, created_at, resolved_at, escalated_at, last_action_at"
      )
      .eq("room_id", roomId)
      .order("created_at", { ascending: false })
      .limit(LIMITS.moderation),
    service
      .from("room_resources")
      .select("file_size_bytes, is_current, created_at")
      .eq("room_id", roomId)
      .limit(LIMITS.resources),
    service
      .from("room_events")
      .select(
        "id, starts_at, ends_at, capacity, registration_required, created_at"
      )
      .eq("room_id", roomId)
      .gte("starts_at", new Date(previousSince).toISOString())
      .order("starts_at", { ascending: true })
      .limit(LIMITS.events),
    service
      .from("room_event_rsvps")
      .select("event_id, user_id, status, created_at, updated_at")
      .eq("room_id", roomId)
      .limit(LIMITS.rsvps),
    service
      .from("room_module_records")
      .select("status, metadata, created_at, updated_at, archived_at")
      .eq("room_id", roomId)
      .eq("module_key", "task")
      .is("archived_at", null)
      .limit(LIMITS.tasks),
    service
      .from("room_notification_preferences")
      .select(
        "user_id, muted, email_digest_enabled, email_digest_last_sent_at, new_discussions_enabled, announcements_enabled, events_enabled"
      )
      .eq("room_id", roomId)
      .limit(LIMITS.preferences),
    service
      .from("notifications")
      .select("id, type, created_at")
      .eq("room_id", roomId)
      .gte("created_at", new Date(currentSince).toISOString())
      .order("created_at", { ascending: false })
      .limit(LIMITS.notifications),
    service
      .from("room_retention_runs")
      .select(
        "mode, status, candidate_count, staged_count, excluded_count, error_message, started_at, completed_at, created_at"
      )
      .eq("room_id", roomId)
      .order("created_at", { ascending: false })
      .limit(10),
    service
      .from("room_retention_holds")
      .select("id, status")
      .eq("room_id", roomId)
      .eq("status", "active")
      .limit(5000),
  ]);

  const namedResults: Array<[
    { error: { message?: string | null } | null },
    string,
  ]> = [
    [membersResult, "Room members"],
    [activityResult, "Room activity"],
    [postsResult, "Room discussions"],
    [repliesResult, "Room replies"],
    [moderationResult, "Room moderation"],
    [resourcesResult, "Room resources"],
    [eventsResult, "Room events"],
    [rsvpsResult, "Room RSVPs"],
    [tasksResult, "Room tasks"],
    [preferencesResult, "Room notification preferences"],
    [notificationsResult, "Room notifications"],
    [retentionRunsResult, "Room retention runs"],
    [retentionHoldsResult, "Room retention holds"],
  ];
  for (const [result, name] of namedResults) assertResult(result, name);

  const members = (membersResult.data ?? []) as RoomRow[];
  const activity = (activityResult.data ?? []) as RoomRow[];
  const posts = (postsResult.data ?? []) as RoomRow[];
  const replies = (repliesResult.data ?? []) as RoomRow[];
  const moderation = (moderationResult.data ?? []) as RoomRow[];
  const resources = (resourcesResult.data ?? []) as RoomRow[];
  const events = (eventsResult.data ?? []) as RoomRow[];
  const rsvps = (rsvpsResult.data ?? []) as RoomRow[];
  const tasks = (tasksResult.data ?? []) as RoomRow[];
  const preferences = (preferencesResult.data ?? []) as RoomRow[];
  const notifications = (notificationsResult.data ?? []) as RoomRow[];
  const retentionRuns = (retentionRunsResult.data ?? []) as RoomRow[];
  const retentionHolds = (retentionHoldsResult.data ?? []) as RoomRow[];

  const cappedSources = Object.entries(LIMITS)
    .filter(([source, limit]) => {
      const rows = {
        members,
        activity,
        posts,
        replies,
        moderation,
        resources,
        events,
        rsvps,
        tasks,
        preferences,
        notifications,
      }[source as keyof typeof LIMITS];
      return Array.isArray(rows) && rows.length >= limit;
    })
    .map(([source]) => source);

  const activeMemberIds = new Set(
    members
      .filter((row) => isActiveMember(row, now))
      .map((row) => asString(row.user_id))
      .filter(Boolean)
  );
  if (access.room.ownerId) activeMemberIds.add(access.room.ownerId);
  if (access.room.createdBy) activeMemberIds.add(access.room.createdBy);
  const activeMembers = activeMemberIds.size;
  const suspendedMembers = members.filter((row) => isSuspendedMember(row, now)).length;
  const staffMembers = members.filter(
    (row) =>
      isActiveMember(row, now) &&
      ["owner", "administrator", "admin", "moderator"].includes(
        asString(row.role).toLowerCase()
      )
  ).length;
  const memberLimit = access.room.memberLimit ?? plan.memberLimit;
  const memberUtilization =
    memberLimit === null ? null : percentage(activeMembers, memberLimit);

  const currentActivity = activity.filter((row) =>
    isWithin(row.created_at, currentSince)
  );
  const previousActivity = activity.filter((row) =>
    isWithin(row.created_at, previousSince, currentSince)
  );
  const activityLastSevenDays = activity.filter((row) =>
    isWithin(row.created_at, sevenDaysSince)
  );
  const activeContributors = new Set(
    currentActivity.map((row) => asString(row.actor_id)).filter(Boolean)
  ).size;
  const activityByModule = new Map<string, number>();
  for (const row of currentActivity) {
    const key = asString(row.module_key) || "overview";
    activityByModule.set(key, (activityByModule.get(key) ?? 0) + 1);
  }
  const moduleActivity = [...activityByModule.entries()]
    .map(([moduleKey, count]) => ({
      moduleKey,
      count,
      percentage: percentage(count, currentActivity.length),
    }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 12);

  const currentPosts = posts.filter((row) => isWithin(row.created_at, currentSince));
  const previousPosts = posts.filter((row) =>
    isWithin(row.created_at, previousSince, currentSince)
  );
  const currentReplies = replies.filter((row) =>
    isWithin(row.created_at, currentSince)
  );
  const previousReplies = replies.filter((row) =>
    isWithin(row.created_at, previousSince, currentSince)
  );
  const repliesByPost = new Map<string, RoomRow[]>();
  for (const reply of replies) {
    const postId = asString(reply.post_id);
    if (!postId) continue;
    const bucket = repliesByPost.get(postId) ?? [];
    bucket.push(reply);
    repliesByPost.set(postId, bucket);
  }

  const firstResponseHours: number[] = [];
  let maturedDiscussions = 0;
  let unansweredAfter24Hours = 0;
  let repliedDiscussions = 0;
  for (const post of currentPosts) {
    const postId = asString(post.id);
    const postCreated = validDateMs(post.created_at);
    if (!postId || postCreated === null) continue;
    const postAuthor = asString(post.author_id);
    const externalReplies = (repliesByPost.get(postId) ?? [])
      .filter((reply) => asString(reply.author_id) !== postAuthor)
      .map((reply) => ({ row: reply, created: validDateMs(reply.created_at) }))
      .filter(
        (entry): entry is { row: RoomRow; created: number } =>
          entry.created !== null && entry.created >= postCreated
      )
      .sort((left, right) => left.created - right.created);
    if (externalReplies.length > 0) {
      repliedDiscussions += 1;
      firstResponseHours.push((externalReplies[0].created - postCreated) / 3600000);
    }
    if (postCreated <= matureCutoff) {
      maturedDiscussions += 1;
      if (externalReplies.length === 0) unansweredAfter24Hours += 1;
    }
  }
  const openCases = supportRoom
    ? currentPosts.filter(
        (row) =>
          !["resolved", "closed", "cancelled"].includes(
            asString(row.status).toLowerCase()
          )
      ).length
    : null;

  const openModerationRows = moderation.filter((row) =>
    ["open", "reviewing"].includes(asString(row.status).toLowerCase())
  );
  const urgentModeration = openModerationRows.filter((row) =>
    ["high", "urgent"].includes(asString(row.priority).toLowerCase())
  ).length;
  const unassignedModeration = openModerationRows.filter(
    (row) => !asString(row.assigned_to)
  ).length;
  const escalatedModeration = openModerationRows.filter(
    (row) => validDateMs(row.escalated_at) !== null
  ).length;
  const oldestModerationCreated = openModerationRows
    .map((row) => validDateMs(row.created_at))
    .filter((value): value is number => value !== null)
    .sort((left, right) => left - right)[0];
  const oldestModerationHours =
    oldestModerationCreated === undefined
      ? null
      : rounded((now - oldestModerationCreated) / 3600000);
  const moderationResolutionHours = moderation
    .filter(
      (row) =>
        isWithin(row.resolved_at, currentSince) &&
        validDateMs(row.created_at) !== null
    )
    .map((row) => {
      const created = validDateMs(row.created_at) ?? 0;
      const resolved = validDateMs(row.resolved_at) ?? created;
      return (resolved - created) / 3600000;
    });

  const currentResources = resources.filter((row) => row.is_current !== false);
  const storageUsedBytes = currentResources.reduce(
    (total, row) => total + Math.max(0, asNumber(row.file_size_bytes)),
    0
  );
  const storageUtilization =
    plan.storageBytes > 0 ? percentage(storageUsedBytes, plan.storageBytes) : null;

  const activeTasksRows = tasks.filter(
    (row) => asString(row.status).toLowerCase() !== "completed"
  );
  const overdueTasks = activeTasksRows.filter((row) => {
    const dueAt = validDateMs(asObject(row.metadata).dueAt);
    return dueAt !== null && dueAt < now;
  }).length;
  const blockedTasks = activeTasksRows.filter(
    (row) => asString(row.status).toLowerCase() === "blocked"
  ).length;
  const unassignedTasks = activeTasksRows.filter(
    (row) => !asString(asObject(row.metadata).assigneeId)
  ).length;
  const completedTasks = tasks.filter(
    (row) =>
      asString(row.status).toLowerCase() === "completed" &&
      isWithin(row.updated_at, currentSince)
  ).length;

  const upcomingEvents = events.filter((row) => {
    const startsAt = validDateMs(row.starts_at);
    return startsAt !== null && startsAt >= now && startsAt <= upcomingLimit;
  });
  const recentPastEvents = events.filter((row) => {
    const startsAt = validDateMs(row.starts_at);
    return startsAt !== null && startsAt >= currentSince && startsAt < now;
  });
  const upcomingEventIds = new Set(
    upcomingEvents.map((row) => asString(row.id)).filter(Boolean)
  );
  const upcomingRsvps = rsvps.filter((row) =>
    upcomingEventIds.has(asString(row.event_id))
  );
  const rsvpCounts = { going: 0, maybe: 0, declined: 0, waitlist: 0 };
  for (const row of upcomingRsvps) {
    const status = asString(row.status) as keyof typeof rsvpCounts;
    if (status in rsvpCounts) rsvpCounts[status] += 1;
  }
  const eventParticipation =
    upcomingEvents.length > 0 && activeMembers > 0
      ? percentage(
          new Set(upcomingRsvps.map((row) => asString(row.user_id)).filter(Boolean))
            .size,
          activeMembers
        )
      : 0;

  const digestEnabled = preferences.filter(
    (row) => row.email_digest_enabled === true
  ).length;
  const inAppEnabled = preferences.filter((row) => row.muted !== true).length;
  const latestDigestSentAt = preferences
    .map((row) => validDateMs(row.email_digest_last_sent_at))
    .filter((value): value is number => value !== null)
    .sort((left, right) => right - left)[0];

  const latestRetention = retentionRuns[0] ?? null;
  const retentionStatus = latestRetention
    ? asString(latestRetention.status) || null
    : null;

  const health = buildHealth({
    access,
    memberUtilization,
    storageUtilization,
    openModeration: openModerationRows.length,
    urgentModeration,
    unassignedModeration,
    oldestModerationHours,
    activeTasks: activeTasksRows.length,
    overdueTasks,
    blockedTasks,
    maturedDiscussions,
    unansweredAfter24Hours,
    retentionStatus,
    cappedSources,
  });

  return {
    generatedAt: new Date(now).toISOString(),
    room: {
      id: access.room.id,
      name: access.room.name,
      roomType: access.room.roomType,
      supportRoom,
      subscriptionStatus: access.room.subscriptionStatus,
      plan: {
        id: plan.id,
        label: plan.label,
        memberLimit,
        storageBytes: plan.storageBytes,
      },
    },
    access: {
      role: access.role,
      canManage: access.canManage,
      isOwner: access.isOwner,
    },
    window: {
      days: windowDays,
      currentSince: new Date(currentSince).toISOString(),
      previousSince: new Date(previousSince).toISOString(),
    },
    health,
    metrics: {
      members: {
        active: activeMembers,
        suspended: suspendedMembers,
        staff: staffMembers,
        limit: memberLimit,
        utilization: memberUtilization,
      },
      activity: {
        current: currentActivity.length,
        previous: previousActivity.length,
        changePercent: deltaPercent(
          currentActivity.length,
          previousActivity.length
        ),
        lastSevenDays: activityLastSevenDays.length,
        activeContributors,
      },
      discussions: {
        created: currentPosts.length,
        previousCreated: previousPosts.length,
        changePercent: deltaPercent(currentPosts.length, previousPosts.length),
        replies: currentReplies.length,
        previousReplies: previousReplies.length,
        repliedDiscussions,
        responseCoverage: percentage(repliedDiscussions, currentPosts.length),
        maturedDiscussions,
        unansweredAfter24Hours,
        medianFirstResponseHours: median(firstResponseHours),
        openCases,
      },
      moderation: {
        open: openModerationRows.length,
        urgent: urgentModeration,
        unassigned: unassignedModeration,
        escalated: escalatedModeration,
        oldestOpenHours: oldestModerationHours,
        resolvedInWindow: moderationResolutionHours.length,
        medianResolutionHours: median(moderationResolutionHours),
      },
      storage: {
        files: currentResources.length,
        usedBytes: storageUsedBytes,
        limitBytes: plan.storageBytes,
        utilization: storageUtilization,
      },
      tasks: {
        active: activeTasksRows.length,
        overdue: overdueTasks,
        blocked: blockedTasks,
        unassigned: unassignedTasks,
        completedInWindow: completedTasks,
      },
      events: {
        upcoming: upcomingEvents.length,
        completedInWindow: recentPastEvents.length,
        rsvps: rsvpCounts,
        participantCoverage: eventParticipation,
      },
      delivery: {
        preferenceRecords: preferences.length,
        inAppEnabled,
        digestEnabled,
        notificationsGenerated: notifications.length,
        preferenceCoverage: percentage(preferences.length, activeMembers),
        latestDigestSentAt:
          latestDigestSentAt === undefined
            ? null
            : new Date(latestDigestSentAt).toISOString(),
      },
      retention: {
        latestRun: latestRetention
          ? {
              mode: asString(latestRetention.mode),
              status: asString(latestRetention.status),
              candidateCount: asNumber(latestRetention.candidate_count),
              stagedCount: asNumber(latestRetention.staged_count),
              excludedCount: asNumber(latestRetention.excluded_count),
              startedAt:
                asString(latestRetention.started_at) ||
                asString(latestRetention.created_at) ||
                null,
              completedAt: asString(latestRetention.completed_at) || null,
              error: asString(latestRetention.error_message) || null,
            }
          : null,
        activeHolds: retentionHolds.length,
        permanentDeletionEnabled: false,
      },
    },
    trend: buildTrend(
      Math.min(windowDays, 30),
      currentActivity,
      currentPosts,
      currentReplies,
      now
    ),
    moduleActivity,
    privacy: {
      aggregateOnly: supportRoom,
      note: supportRoom
        ? "Customer Support analytics contain aggregate operational counts only. Case titles, message bodies, evidence, notes, and participant identities are excluded."
        : "This dashboard returns aggregate Room operations. It does not return discussion bodies, reply text, moderation evidence, internal notes, or member identities.",
    },
  };
}
