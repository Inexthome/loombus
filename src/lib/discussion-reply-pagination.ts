import { supabase } from "@/lib/supabase/client";

export type DiscussionReplySort = "best" | "newest" | "oldest";

export type DiscussionReplyCursor = {
  signal: number;
  createdAt: string;
  id: string;
};

export type DiscussionReplyPageItem = {
  replyId: string;
  signalTotal: number;
  createdAt: string;
};

export type DiscussionReplyPage = {
  items: DiscussionReplyPageItem[];
  totalCount: number;
  nextCursor: DiscussionReplyCursor | null;
};

type RootPageRow = {
  reply_id: string;
  signal_total: number | string;
  created_at: string;
  total_root_count: number | string;
};

type ChildPageRow = {
  reply_id: string;
  signal_total: number | string;
  created_at: string;
  total_child_count: number | string;
};

const DEFAULT_PAGE_SIZE = 30;

function normalizeLimit(limit?: number) {
  if (!Number.isFinite(limit)) return DEFAULT_PAGE_SIZE;
  return Math.max(1, Math.min(100, Math.trunc(limit ?? DEFAULT_PAGE_SIZE)));
}

function toCursor(item?: DiscussionReplyPageItem): DiscussionReplyCursor | null {
  if (!item) return null;
  return {
    signal: item.signalTotal,
    createdAt: item.createdAt,
    id: item.replyId,
  };
}

function rpcCursor(cursor?: DiscussionReplyCursor | null) {
  return {
    p_cursor_signal: cursor?.signal ?? null,
    p_cursor_created_at: cursor?.createdAt ?? null,
    p_cursor_id: cursor?.id ?? null,
  };
}

export async function getDiscussionVisibleReplyCount(discussionId: string) {
  const { data, error } = await supabase.rpc("get_discussion_visible_reply_count", {
    p_discussion_id: discussionId,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

export async function getDiscussionRootReplyPage({
  discussionId,
  sort = "best",
  limit = DEFAULT_PAGE_SIZE,
  cursor = null,
}: {
  discussionId: string;
  sort?: DiscussionReplySort;
  limit?: number;
  cursor?: DiscussionReplyCursor | null;
}): Promise<DiscussionReplyPage> {
  const { data, error } = await supabase.rpc("get_discussion_root_reply_page", {
    p_discussion_id: discussionId,
    p_sort: sort,
    p_limit: normalizeLimit(limit),
    ...rpcCursor(cursor),
  });

  if (error) throw error;
  const rows = (data ?? []) as RootPageRow[];
  const items = rows.map((row) => ({
    replyId: row.reply_id,
    signalTotal: Number(row.signal_total ?? 0),
    createdAt: row.created_at,
  }));

  return {
    items,
    totalCount: Number(rows[0]?.total_root_count ?? 0),
    nextCursor: items.length === normalizeLimit(limit) ? toCursor(items.at(-1)) : null,
  };
}

export async function getDiscussionChildReplyPage({
  discussionId,
  parentReplyId,
  sort = "best",
  limit = DEFAULT_PAGE_SIZE,
  cursor = null,
}: {
  discussionId: string;
  parentReplyId: string;
  sort?: DiscussionReplySort;
  limit?: number;
  cursor?: DiscussionReplyCursor | null;
}): Promise<DiscussionReplyPage> {
  const { data, error } = await supabase.rpc("get_discussion_child_reply_page", {
    p_discussion_id: discussionId,
    p_parent_reply_id: parentReplyId,
    p_sort: sort,
    p_limit: normalizeLimit(limit),
    ...rpcCursor(cursor),
  });

  if (error) throw error;
  const rows = (data ?? []) as ChildPageRow[];
  const items = rows.map((row) => ({
    replyId: row.reply_id,
    signalTotal: Number(row.signal_total ?? 0),
    createdAt: row.created_at,
  }));

  return {
    items,
    totalCount: Number(rows[0]?.total_child_count ?? 0),
    nextCursor: items.length === normalizeLimit(limit) ? toCursor(items.at(-1)) : null,
  };
}
