"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getDiscussionChildReplyPage,
  getDiscussionRootReplyPage,
  getDiscussionVisibleReplyCount,
  type DiscussionReplyCursor,
  type DiscussionReplySort,
} from "@/lib/discussion-reply-pagination";
import {
  DISCUSSION_REPLY_WINDOW_LOAD_MORE,
  DISCUSSION_REPLY_WINDOW_STATE,
  DISCUSSION_THREAD_WINDOW_REQUEST,
  hydrateReplyWindow,
  type DiscussionReplyWindowLoadMoreDetail,
  type DiscussionReplyWindowStateDetail,
  type DiscussionThreadWindowRequestDetail,
  type HydratedReplyWindow,
} from "@/lib/discussion-reply-window";
import type {
  Profile,
  Reply,
  ReplyReactionCounts,
  ReplyReactionType,
} from "./discussion-detail-v2-model";

const PAGE_SIZE = 30;

type ChildWindowState = {
  totalCount: number;
  nextCursor: DiscussionReplyCursor | null;
  loading: boolean;
  loaded: boolean;
};

function mergeReplies(current: Reply[], incoming: Reply[]) {
  const next = new Map(current.map((reply) => [reply.id, reply]));
  for (const reply of incoming) next.set(reply.id, reply);
  return Array.from(next.values());
}

export function useDiscussionReplyWindows({
  discussionId,
  currentUserId,
  pinnedReplyId,
  sort,
}: {
  discussionId: string;
  currentUserId?: string | null;
  pinnedReplyId?: string | null;
  sort: DiscussionReplySort;
}) {
  const [replies, setReplies] = useState<Reply[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [reactionCounts, setReactionCounts] = useState<Record<string, ReplyReactionCounts>>({});
  const [myReactions, setMyReactions] = useState<Record<string, ReplyReactionType[]>>({});
  const [reportedReplyIds, setReportedReplyIds] = useState<string[]>([]);
  const [discussionTotalCount, setDiscussionTotalCount] = useState(0);
  const [rootTotalCount, setRootTotalCount] = useState(0);
  const [rootNextCursor, setRootNextCursor] = useState<DiscussionReplyCursor | null>(null);
  const [rootLoading, setRootLoading] = useState(false);
  const [rootLoaded, setRootLoaded] = useState(false);
  const [childWindows, setChildWindows] = useState<Record<string, ChildWindowState>>({});
  const generationRef = useRef(0);

  const mergeHydratedWindow = useCallback((windowData: HydratedReplyWindow) => {
    setReplies((current) => mergeReplies(current, windowData.replies));
    setProfiles((current) => ({ ...current, ...windowData.profiles }));
    setReactionCounts((current) => ({ ...current, ...windowData.reactionCounts }));
    setMyReactions((current) => ({ ...current, ...windowData.myReactions }));
    setReportedReplyIds((current) => [
      ...new Set([...current, ...windowData.reportedReplyIds]),
    ]);
  }, []);

  const loadRootPage = useCallback(
    async ({ reset = false }: { reset?: boolean } = {}) => {
      if (!discussionId || rootLoading) return;
      if (!reset && rootLoaded && !rootNextCursor) return;
      const generation = generationRef.current;
      setRootLoading(true);

      try {
        const cursor = reset ? null : rootNextCursor;
        const [page, visibleReplyCount] = await Promise.all([
          getDiscussionRootReplyPage({
            discussionId,
            sort,
            limit: PAGE_SIZE,
            cursor,
          }),
          reset ? getDiscussionVisibleReplyCount(discussionId) : Promise.resolve(null),
        ]);
        const pageReplyIds = page.items.map((item) => item.replyId);
        const replyIds =
          reset && pinnedReplyId && !pageReplyIds.includes(pinnedReplyId)
            ? [...pageReplyIds, pinnedReplyId]
            : pageReplyIds;
        const hydrated = await hydrateReplyWindow({ replyIds, currentUserId });

        if (generation !== generationRef.current) return;
        if (reset) {
          setReplies(hydrated.replies);
          setProfiles(hydrated.profiles);
          setReactionCounts(hydrated.reactionCounts);
          setMyReactions(hydrated.myReactions);
          setReportedReplyIds(hydrated.reportedReplyIds);
          setChildWindows({});
          setDiscussionTotalCount(visibleReplyCount ?? 0);
        } else {
          mergeHydratedWindow(hydrated);
        }
        setRootTotalCount(page.totalCount);
        setRootNextCursor(page.nextCursor);
        setRootLoaded(true);
      } finally {
        if (generation === generationRef.current) setRootLoading(false);
      }
    }, [
      currentUserId,
      discussionId,
      mergeHydratedWindow,
      pinnedReplyId,
      rootLoaded,
      rootLoading,
      rootNextCursor,
      sort,
    ]
  );

  const loadChildPage = useCallback(
    async (parentReplyId: string, { reset = false }: { reset?: boolean } = {}) => {
      if (!discussionId || !parentReplyId) return;
      const currentWindow = childWindows[parentReplyId];
      if (currentWindow?.loading) return;
      if (!reset && currentWindow?.loaded && !currentWindow.nextCursor) return;
      const generation = generationRef.current;

      setChildWindows((current) => ({
        ...current,
        [parentReplyId]: {
          totalCount: current[parentReplyId]?.totalCount ?? 0,
          nextCursor: current[parentReplyId]?.nextCursor ?? null,
          loaded: current[parentReplyId]?.loaded ?? false,
          loading: true,
        },
      }));

      try {
        const page = await getDiscussionChildReplyPage({
          discussionId,
          parentReplyId,
          sort,
          limit: PAGE_SIZE,
          cursor: reset ? null : currentWindow?.nextCursor ?? null,
        });
        const hydrated = await hydrateReplyWindow({
          replyIds: page.items.map((item) => item.replyId),
          currentUserId,
        });

        if (generation !== generationRef.current) return;
        mergeHydratedWindow(hydrated);
        setChildWindows((current) => ({
          ...current,
          [parentReplyId]: {
            totalCount: page.totalCount,
            nextCursor: page.nextCursor,
            loaded: true,
            loading: false,
          },
        }));
      } catch (error) {
        if (generation === generationRef.current) {
          setChildWindows((current) => ({
            ...current,
            [parentReplyId]: {
              totalCount: current[parentReplyId]?.totalCount ?? 0,
              nextCursor: current[parentReplyId]?.nextCursor ?? null,
              loaded: current[parentReplyId]?.loaded ?? false,
              loading: false,
            },
          }));
        }
        throw error;
      }
    }, [childWindows, currentUserId, discussionId, mergeHydratedWindow, sort]
  );

  useEffect(() => {
    generationRef.current += 1;
    setReplies([]);
    setProfiles({});
    setReactionCounts({});
    setMyReactions({});
    setReportedReplyIds([]);
    setDiscussionTotalCount(0);
    setRootTotalCount(0);
    setRootNextCursor(null);
    setRootLoaded(false);
    setChildWindows({});
    void loadRootPage({ reset: true });
  // loadRootPage intentionally excluded because it captures cursor/loading state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discussionId, currentUserId, pinnedReplyId, sort]);

  useEffect(() => {
    const handleThreadRequest = (event: Event) => {
      const detail = (event as CustomEvent<DiscussionThreadWindowRequestDetail>).detail;
      if (!detail || detail.discussionId !== discussionId || !detail.parentReplyId) return;
      const existing = childWindows[detail.parentReplyId];
      if (!existing?.loaded && !existing?.loading) {
        void loadChildPage(detail.parentReplyId, { reset: true });
      }
    };

    window.addEventListener(DISCUSSION_THREAD_WINDOW_REQUEST, handleThreadRequest);
    return () => window.removeEventListener(DISCUSSION_THREAD_WINDOW_REQUEST, handleThreadRequest);
  }, [childWindows, discussionId, loadChildPage]);

  useEffect(() => {
    const handleLoadMore = (event: Event) => {
      const detail = (event as CustomEvent<DiscussionReplyWindowLoadMoreDetail>).detail;
      if (!detail || detail.discussionId !== discussionId) return;
      if (detail.parentReplyId) void loadChildPage(detail.parentReplyId);
      else void loadRootPage();
    };

    window.addEventListener(DISCUSSION_REPLY_WINDOW_LOAD_MORE, handleLoadMore);
    return () => window.removeEventListener(DISCUSSION_REPLY_WINDOW_LOAD_MORE, handleLoadMore);
  }, [discussionId, loadChildPage, loadRootPage]);

  useEffect(() => {
    if (!discussionId || typeof window === "undefined") return;
    const children = Object.fromEntries(
      Object.entries(childWindows).map(([replyId, state]) => [
        replyId,
        {
          totalCount: state.totalCount,
          hasMore: Boolean(state.nextCursor),
          loading: state.loading,
          loaded: state.loaded,
        },
      ])
    );
    const detail: DiscussionReplyWindowStateDetail = {
      discussionId,
      discussionTotalCount,
      rootTotalCount,
      rootHasMore: Boolean(rootNextCursor),
      rootLoading,
      rootLoaded,
      children,
    };
    window.dispatchEvent(
      new CustomEvent<DiscussionReplyWindowStateDetail>(DISCUSSION_REPLY_WINDOW_STATE, {
        detail,
      })
    );
  }, [
    childWindows,
    discussionId,
    discussionTotalCount,
    rootLoaded,
    rootLoading,
    rootNextCursor,
    rootTotalCount,
  ]);

  return {
    replies,
    setReplies,
    profiles,
    setProfiles,
    reactionCounts,
    setReactionCounts,
    myReactions,
    setMyReactions,
    reportedReplyIds,
    setReportedReplyIds,
    discussionTotalCount,
    setDiscussionTotalCount,
    rootTotalCount,
    setRootTotalCount,
    rootNextCursor,
    rootLoading,
    rootLoaded,
    loadMoreRoots: () => loadRootPage(),
    childWindows,
    loadMoreChildren: (parentReplyId: string) => loadChildPage(parentReplyId),
  };
}
