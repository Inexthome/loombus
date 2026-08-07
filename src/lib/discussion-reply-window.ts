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

export type DiscussionThreadWindowRequestDetail = {
  discussionId: string;
  parentReplyId: string;
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

  const { data: replyData, error: replyError } = await supabase
    .from("replies")
    .select("*")
    .in("id", uniqueReplyIds)
    .is("deleted_at", null);

  if (replyError) throw replyError;

  const replyMap = new Map(((replyData ?? []) as Reply[]).map((reply) => [reply.id, reply]));
  const replies = uniqueReplyIds
    .map((replyId) => replyMap.get(replyId))
    .filter((reply): reply is Reply => Boolean(reply));

  const userIds = [...new Set(replies.map((reply) => reply.user_id))];
  const [profileResult, reactionResult, reportResult] = await Promise.all([
    userIds.length
      ? supabase.from("profiles").select("*").in("id", userIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("reply_reactions")
      .select("reply_id, user_id, reaction_type")
      .in("reply_id", uniqueReplyIds),
    currentUserId
      ? supabase
          .from("reports")
          .select("reply_id")
          .eq("reporter_id", currentUserId)
          .in("reply_id", uniqueReplyIds)
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
