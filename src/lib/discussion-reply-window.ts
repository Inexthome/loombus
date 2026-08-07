import { supabase } from "@/lib/supabase/client";
import type {
  Profile,
  Reply,
  ReplyReactionCounts,
  ReplyReactionRow,
  ReplyReactionType,
} from "@/app/discussions/[id]/discussion-detail-v2-model";

export type HydratedReplyWindow = {
  replies: Reply[];
  profiles: Record<string, Profile>;
  reactionCounts: Record<string, ReplyReactionCounts>;
  myReactions: Record<string, ReplyReactionType[]>;
  reportedReplyIds: string[];
};

export const DISCUSSION_THREAD_WINDOW_REQUEST = "loombus:discussion-thread-window-request";
export const DISCUSSION_REPLY_WINDOW_STATE = "loombus:discussion-reply-window-state";
export const DISCUSSION_REPLY_WINDOW_LOAD_MORE = "loombus:discussion-reply-window-load-more";

export type DiscussionThreadWindowRequestDetail = {
  discussionId: string;
  parentReplyId: string;
};

export type DiscussionReplyWindowLoadMoreDetail = {
  discussionId: string;
  parentReplyId?: string | null;
};

export type DiscussionReplyWindowChildState = {
  totalCount: number;
  hasMore: boolean;
  loading: boolean;
  loaded: boolean;
};

export type DiscussionReplyWindowStateDetail = {
  discussionId: string;
  discussionTotalCount: number;
  rootTotalCount: number;
  rootHasMore: boolean;
  rootLoading: boolean;
  rootLoaded: boolean;
  children: Record<string, DiscussionReplyWindowChildState>;
};

export async function hydrateReplyWindow({
  replyIds,
  currentUserId,
}: {
  replyIds: string[];
  currentUserId?: string | null;
}): Promise<HydratedReplyWindow> {
  const uniqueReplyIds = [...new Set(replyIds.filter(Boolean))];
  if (uniqueReplyIds.length === 0) {
    return {
      replies: [],
      profiles: {},
      reactionCounts: {},
      myReactions: {},
      reportedReplyIds: [],
    };
  }

  const [{ data: replyData, error: replyError }, blockResult] = await Promise.all([
    supabase
      .from("replies")
      .select("*")
      .in("id", uniqueReplyIds)
      .is("deleted_at", null),
    currentUserId
      ? supabase
          .from("user_blocks")
          .select("blocker_id, blocked_id")
          .or(`blocker_id.eq.${currentUserId},blocked_id.eq.${currentUserId}`)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (replyError) throw replyError;
  if (blockResult.error) throw blockResult.error;

  const blockedIds = new Set<string>();
  for (const block of (blockResult.data ?? []) as Array<{
    blocker_id: string;
    blocked_id: string;
  }>) {
    blockedIds.add(block.blocker_id === currentUserId ? block.blocked_id : block.blocker_id);
  }

  const replyMap = new Map(
    ((replyData ?? []) as Reply[])
      .filter((reply) => !blockedIds.has(reply.user_id))
      .map((reply) => [reply.id, reply])
  );
  const replies = uniqueReplyIds
    .map((replyId) => replyMap.get(replyId))
    .filter((reply): reply is Reply => Boolean(reply));
  const visibleReplyIds = replies.map((reply) => reply.id);

  if (visibleReplyIds.length === 0) {
    return {
      replies: [],
      profiles: {},
      reactionCounts: {},
      myReactions: {},
      reportedReplyIds: [],
    };
  }

  const userIds = [...new Set(replies.map((reply) => reply.user_id))];
  const [profileResult, reactionResult, reportResult] = await Promise.all([
    userIds.length
      ? supabase.from("profiles").select("*").in("id", userIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("reply_reactions")
      .select("reply_id, user_id, reaction_type")
      .in("reply_id", visibleReplyIds),
    currentUserId
      ? supabase
          .from("reports")
          .select("reply_id")
          .eq("reporter_id", currentUserId)
          .in("reply_id", visibleReplyIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (reactionResult.error) throw reactionResult.error;
  if (reportResult.error) throw reportResult.error;

  const profiles: Record<string, Profile> = {};
  for (const profile of (profileResult.data ?? []) as Profile[]) {
    profiles[profile.id] = profile;
  }

  const reactionCounts: Record<string, ReplyReactionCounts> = {};
  const myReactions: Record<string, ReplyReactionType[]> = {};

  for (const row of (reactionResult.data ?? []) as ReplyReactionRow[]) {
    const counts = reactionCounts[row.reply_id] ?? {};
    counts[row.reaction_type] = (counts[row.reaction_type] ?? 0) + 1;
    reactionCounts[row.reply_id] = counts;

    if (currentUserId && row.user_id === currentUserId) {
      myReactions[row.reply_id] = [
        ...(myReactions[row.reply_id] ?? []),
        row.reaction_type,
      ];
    }
  }

  const reportedReplyIds = ((reportResult.data ?? []) as Array<{ reply_id: string | null }>)
    .map((row) => row.reply_id)
    .filter((replyId): replyId is string => Boolean(replyId));

  return {
    replies,
    profiles,
    reactionCounts,
    myReactions,
    reportedReplyIds,
  };
}

export function requestDiscussionThreadWindow(detail: DiscussionThreadWindowRequestDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<DiscussionThreadWindowRequestDetail>(DISCUSSION_THREAD_WINDOW_REQUEST, {
      detail,
    })
  );
}

export function requestDiscussionReplyWindowLoadMore(detail: DiscussionReplyWindowLoadMoreDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<DiscussionReplyWindowLoadMoreDetail>(DISCUSSION_REPLY_WINDOW_LOAD_MORE, {
      detail,
    })
  );
}
