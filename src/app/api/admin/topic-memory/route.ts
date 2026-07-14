import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";

const DISCUSSION_LIMIT = 500;
const TAG_LIMIT = 2000;
const AI_OUTPUT_LIMIT = 2000;
const ACTIVITY_LIMIT = 5000;
const RECENT_DAYS = 30;
const GROUP_LIMIT = 200;
const EXAMPLE_LIMIT = 8;

const MEMORY_KINDS = ["topic", "lens", "tag"] as const;
type MemoryKind = (typeof MEMORY_KINDS)[number];

type DiscussionRow = {
  id: string;
  title: string;
  topic: string;
  reality_lens: string | null;
  created_at: string;
};

type DiscussionTagRow = {
  discussion_id: string;
  tag: string;
};

type DiscussionAiOutputRow = {
  discussion_id: string;
  feature_key: string;
  generated_at: string;
};

type DiscussionActivityRow = {
  discussion_id: string;
};

type DiscussionSignal = {
  discussion: DiscussionRow;
  replyCount: number;
  viewCount: number;
  saveCount: number;
  hasConversationMap: boolean;
  hasRelatedIdeas: boolean;
};

type MemoryExample = {
  id: string;
  title: string;
  topic: string;
  reality_lens: string | null;
  created_at: string;
  reply_count: number;
  view_count: number;
  save_count: number;
  has_conversation_map: boolean;
  has_related_ideas: boolean;
};

type MutableMemoryGroup = {
  id: string;
  kind: MemoryKind;
  key: string;
  label: string;
  discussion_count: number;
  recent_count: number;
  reply_count: number;
  view_count: number;
  save_count: number;
  conversation_map_count: number;
  related_ideas_count: number;
  latest_at: string | null;
  examples: MemoryExample[];
  discussionIds: Set<string>;
};

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

function getAdminSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json(code ? { error: message, code } : { error: message }, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function incrementCount(counts: Map<string, number>, discussionId: string) {
  counts.set(discussionId, (counts.get(discussionId) ?? 0) + 1);
}

function getOrCreateGroup(
  groups: Map<string, MutableMemoryGroup>,
  kind: MemoryKind,
  key: string,
  label: string
) {
  const id = `${kind}:${key}`;
  const existing = groups.get(id);
  if (existing) return existing;

  const created: MutableMemoryGroup = {
    id,
    kind,
    key,
    label,
    discussion_count: 0,
    recent_count: 0,
    reply_count: 0,
    view_count: 0,
    save_count: 0,
    conversation_map_count: 0,
    related_ideas_count: 0,
    latest_at: null,
    examples: [],
    discussionIds: new Set<string>(),
  };
  groups.set(id, created);
  return created;
}

function addSignalToGroup(
  groups: Map<string, MutableMemoryGroup>,
  kind: MemoryKind,
  key: string,
  label: string,
  signal: DiscussionSignal,
  recentCutoff: number
) {
  const cleanKey = key.trim();
  const cleanLabel = label.trim();
  if (!cleanKey || !cleanLabel) return;

  const group = getOrCreateGroup(groups, kind, cleanKey, cleanLabel);
  if (group.discussionIds.has(signal.discussion.id)) return;
  group.discussionIds.add(signal.discussion.id);

  const createdAt = new Date(signal.discussion.created_at).getTime();
  const isRecent = Number.isFinite(createdAt) && createdAt >= recentCutoff;

  group.discussion_count += 1;
  group.recent_count += isRecent ? 1 : 0;
  group.reply_count += signal.replyCount;
  group.view_count += signal.viewCount;
  group.save_count += signal.saveCount;
  group.conversation_map_count += signal.hasConversationMap ? 1 : 0;
  group.related_ideas_count += signal.hasRelatedIdeas ? 1 : 0;

  if (
    !group.latest_at ||
    new Date(signal.discussion.created_at).getTime() >
      new Date(group.latest_at).getTime()
  ) {
    group.latest_at = signal.discussion.created_at;
  }

  group.examples.push({
    id: signal.discussion.id,
    title: signal.discussion.title,
    topic: signal.discussion.topic,
    reality_lens: signal.discussion.reality_lens,
    created_at: signal.discussion.created_at,
    reply_count: signal.replyCount,
    view_count: signal.viewCount,
    save_count: signal.saveCount,
    has_conversation_map: signal.hasConversationMap,
    has_related_ideas: signal.hasRelatedIdeas,
  });
}

function getSignalScore(group: MutableMemoryGroup) {
  return (
    group.discussion_count * 3 +
    group.recent_count * 4 +
    group.reply_count * 2 +
    group.save_count * 3 +
    group.related_ideas_count * 2 +
    group.conversation_map_count * 2
  );
}

function serializeGroups(groups: Map<string, MutableMemoryGroup>) {
  return [...groups.values()]
    .sort((left, right) => {
      const scoreDifference = getSignalScore(right) - getSignalScore(left);
      if (scoreDifference !== 0) return scoreDifference;
      return (
        new Date(right.latest_at ?? 0).getTime() -
        new Date(left.latest_at ?? 0).getTime()
      );
    })
    .slice(0, GROUP_LIMIT)
    .map((group) => {
      const possibleCoverage = group.discussion_count * 2;
      const coveredOutputs =
        group.conversation_map_count + group.related_ideas_count;

      return {
        id: group.id,
        kind: group.kind,
        key: group.key,
        label: group.label,
        discussion_count: group.discussion_count,
        recent_count: group.recent_count,
        reply_count: group.reply_count,
        view_count: group.view_count,
        save_count: group.save_count,
        conversation_map_count: group.conversation_map_count,
        related_ideas_count: group.related_ideas_count,
        latest_at: group.latest_at,
        signal_score: getSignalScore(group),
        ai_coverage_percent:
          possibleCoverage > 0
            ? Math.round((coveredOutputs / possibleCoverage) * 100)
            : 0,
        examples: [...group.examples]
          .sort(
            (left, right) =>
              new Date(right.created_at).getTime() -
              new Date(left.created_at).getTime()
          )
          .slice(0, EXAMPLE_LIMIT),
      };
    });
}

export async function GET(request: NextRequest) {
  let supabase;

  try {
    supabase = getSupabaseForRequest(request);
  } catch {
    return jsonError("Server configuration error.", 500);
  }

  const accountAccess = await verifyRequestAccountAccess(supabase);

  if (!accountAccess.ok) {
    return jsonError(
      accountAccess.error,
      accountAccess.status,
      accountAccess.code
    );
  }

  if (!accountAccess.profile.is_admin) {
    return jsonError("Admin access required.", 403);
  }

  const adminSupabase = getAdminSupabase();
  if (!adminSupabase) {
    return jsonError("Admin service-role configuration is unavailable.", 503);
  }

  const discussionResult = await adminSupabase
    .from("discussions")
    .select("id, title, topic, reality_lens, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(DISCUSSION_LIMIT);

  if (discussionResult.error) {
    return jsonError(
      discussionResult.error.message || "Unable to load topic-memory discussions.",
      500
    );
  }

  const [tagResult, aiOutputResult, replyResult, viewResult, bookmarkResult] =
    await Promise.all([
      adminSupabase
        .from("discussion_tags")
        .select("discussion_id, tag")
        .limit(TAG_LIMIT),
      adminSupabase
        .from("discussion_ai_outputs")
        .select("discussion_id, feature_key, generated_at")
        .in("feature_key", ["conversation_map", "related_ideas"])
        .limit(AI_OUTPUT_LIMIT),
      adminSupabase
        .from("replies")
        .select("discussion_id")
        .is("deleted_at", null)
        .limit(ACTIVITY_LIMIT),
      adminSupabase
        .from("discussion_views")
        .select("discussion_id")
        .limit(ACTIVITY_LIMIT),
      adminSupabase
        .from("bookmarks")
        .select("discussion_id")
        .limit(ACTIVITY_LIMIT),
    ]);

  const sourceError =
    tagResult.error ||
    aiOutputResult.error ||
    replyResult.error ||
    viewResult.error ||
    bookmarkResult.error;

  if (sourceError) {
    return jsonError(
      sourceError.message || "Unable to load topic-memory activity signals.",
      500
    );
  }

  const discussions = (discussionResult.data ?? []) as DiscussionRow[];
  const discussionIds = new Set(discussions.map((discussion) => discussion.id));
  const tags = ((tagResult.data ?? []) as DiscussionTagRow[]).filter((row) =>
    discussionIds.has(row.discussion_id)
  );
  const aiOutputs = (
    (aiOutputResult.data ?? []) as DiscussionAiOutputRow[]
  ).filter((row) => discussionIds.has(row.discussion_id));
  const replies = ((replyResult.data ?? []) as DiscussionActivityRow[]).filter(
    (row) => discussionIds.has(row.discussion_id)
  );
  const views = ((viewResult.data ?? []) as DiscussionActivityRow[]).filter(
    (row) => discussionIds.has(row.discussion_id)
  );
  const bookmarks = (
    (bookmarkResult.data ?? []) as DiscussionActivityRow[]
  ).filter((row) => discussionIds.has(row.discussion_id));

  const tagsByDiscussion = new Map<string, string[]>();
  for (const row of tags) {
    const current = tagsByDiscussion.get(row.discussion_id) ?? [];
    current.push(row.tag);
    tagsByDiscussion.set(row.discussion_id, current);
  }

  const replyCounts = new Map<string, number>();
  for (const row of replies) incrementCount(replyCounts, row.discussion_id);

  const viewCounts = new Map<string, number>();
  for (const row of views) incrementCount(viewCounts, row.discussion_id);

  const saveCounts = new Map<string, number>();
  for (const row of bookmarks) incrementCount(saveCounts, row.discussion_id);

  const outputsByDiscussion = new Map<string, Set<string>>();
  for (const row of aiOutputs) {
    const current = outputsByDiscussion.get(row.discussion_id) ?? new Set<string>();
    current.add(row.feature_key);
    outputsByDiscussion.set(row.discussion_id, current);
  }

  const topicGroups = new Map<string, MutableMemoryGroup>();
  const lensGroups = new Map<string, MutableMemoryGroup>();
  const tagGroups = new Map<string, MutableMemoryGroup>();
  const recentCutoff = Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000;
  let recentDiscussionCount = 0;

  for (const discussion of discussions) {
    const outputs = outputsByDiscussion.get(discussion.id) ?? new Set<string>();
    const signal: DiscussionSignal = {
      discussion,
      replyCount: replyCounts.get(discussion.id) ?? 0,
      viewCount: viewCounts.get(discussion.id) ?? 0,
      saveCount: saveCounts.get(discussion.id) ?? 0,
      hasConversationMap: outputs.has("conversation_map"),
      hasRelatedIdeas: outputs.has("related_ideas"),
    };

    const createdAt = new Date(discussion.created_at).getTime();
    if (Number.isFinite(createdAt) && createdAt >= recentCutoff) {
      recentDiscussionCount += 1;
    }

    addSignalToGroup(
      topicGroups,
      "topic",
      discussion.topic,
      discussion.topic,
      signal,
      recentCutoff
    );

    if (discussion.reality_lens) {
      addSignalToGroup(
        lensGroups,
        "lens",
        discussion.reality_lens,
        discussion.reality_lens,
        signal,
        recentCutoff
      );
    }

    const seenTags = new Set<string>();
    for (const rawTag of tagsByDiscussion.get(discussion.id) ?? []) {
      const label = rawTag.trim();
      const key = label.toLowerCase();
      if (!key || seenTags.has(key)) continue;
      seenTags.add(key);
      addSignalToGroup(tagGroups, "tag", key, label, signal, recentCutoff);
    }
  }

  const conversationMaps = aiOutputs.filter(
    (row) => row.feature_key === "conversation_map"
  ).length;
  const relatedIdeas = aiOutputs.filter(
    (row) => row.feature_key === "related_ideas"
  ).length;
  const mappedDiscussions = new Set(aiOutputs.map((row) => row.discussion_id)).size;

  const topicMemory = serializeGroups(topicGroups);
  const lensMemory = serializeGroups(lensGroups);
  const tagMemory = serializeGroups(tagGroups);

  return NextResponse.json(
    {
      currentAdminId: accountAccess.user.id,
      generatedAt: new Date().toISOString(),
      recentDays: RECENT_DAYS,
      limits: {
        discussions: DISCUSSION_LIMIT,
        tags: TAG_LIMIT,
        aiOutputs: AI_OUTPUT_LIMIT,
        activityRows: ACTIVITY_LIMIT,
        groupsPerKind: GROUP_LIMIT,
        examplesPerGroup: EXAMPLE_LIMIT,
      },
      metrics: {
        discussions: discussions.length,
        recentDiscussions: recentDiscussionCount,
        replies: replies.length,
        views: views.length,
        saves: bookmarks.length,
        mappedDiscussions,
        conversationMaps,
        relatedIdeas,
        topicGroups: topicGroups.size,
        lensGroups: lensGroups.size,
        tagGroups: tagGroups.size,
      },
      groups: {
        topics: topicMemory,
        lenses: lensMemory,
        tags: tagMemory,
      },
    },
    {
      headers: { "Cache-Control": "private, no-store" },
    }
  );
}
