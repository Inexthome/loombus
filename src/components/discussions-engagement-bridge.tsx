"use client";

import Link from "next/link";
import { ArrowRight, Clock3, MessageCircle, Sparkles, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { normalizePublicText } from "@/lib/public-text";
import { supabase } from "@/lib/supabase/client";

type EngagementMode = "for_you" | "active" | null;

type DiscussionRow = {
  id: string;
  user_id: string;
  title: string;
  topic: string | null;
  created_at: string;
};

type ReplyRow = {
  discussion_id: string;
  user_id: string;
  created_at: string;
};

type BookmarkRow = {
  discussion_id: string;
  user_id: string;
};

type BlockRow = {
  blocker_id: string;
  blocked_id: string;
};

type EngagementItem = {
  discussionId: string;
  title: string;
  detail: string;
};

type EngagementSnapshot = {
  previousVisitAt: string | null;
  continueItems: EngagementItem[];
  newItems: EngagementItem[];
  newCount: number;
  forYouOrder: string[];
  activeIds: Set<string>;
  activeOrder: string[];
};

const ORIGINAL_TAB_LABELS = new Set([
  "All",
  "Following",
  "Research Questions",
  "Debates",
  "Problem Solving",
  "Saved",
]);

const MODE_REQUEST_EVENT = "loombus:discussion-engagement-mode-request";
const MODE_STATE_EVENT = "loombus:discussion-engagement-mode-state";

function findDiscussionsFeedRoot() {
  return (
    Array.from(
      document.querySelectorAll<HTMLElement>(".discussion-feed-route main")
    ).find((main) => main.querySelector("h1")?.textContent?.trim() === "Discussions") ?? null
  );
}

function findHeadingBlock(root: HTMLElement) {
  const heading = Array.from(root.querySelectorAll<HTMLHeadingElement>("h1")).find(
    (candidate) => candidate.textContent?.trim() === "Discussions"
  );
  return heading?.parentElement ?? null;
}

function findOriginalTabRow(root: HTMLElement) {
  const allButton = Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find(
    (button) => button.textContent?.trim() === "All"
  );
  const parent = allButton?.parentElement ?? null;
  if (!parent) return null;

  const labels = Array.from(parent.querySelectorAll("button")).map((button) =>
    button.textContent?.trim()
  );
  return labels.includes("Following") ? parent : null;
}

function getDiscussionIdFromArticle(article: HTMLElement) {
  const link = article.querySelector<HTMLAnchorElement>('a[href^="/discussions/"]');
  const match = (link?.getAttribute("href") ?? "").match(/^\/discussions\/([^/?#]+)/);
  return match?.[1] ?? null;
}

function findDiscussionList(root: HTMLElement) {
  const article = Array.from(root.querySelectorAll<HTMLElement>("article")).find((candidate) =>
    Boolean(getDiscussionIdFromArticle(candidate))
  );
  return article?.parentElement ?? null;
}

function freshnessScore(value: string | null, nowMs: number) {
  if (!value) return 0;
  const ageHours = Math.max(0, (nowMs - new Date(value).getTime()) / 3_600_000);
  if (ageHours <= 24) return 28;
  if (ageHours <= 72) return 20;
  if (ageHours <= 168) return 12;
  if (ageHours <= 336) return 5;
  return 0;
}

function formatNewDetail(count: number) {
  if (count <= 0) return "Meaningful activity since your previous visit";
  return `${count} new ${count === 1 ? "reply" : "replies"}`;
}

function EngagementPanel({ snapshot }: { snapshot: EngagementSnapshot | null }) {
  if (!snapshot) {
    return (
      <section className="border-y border-[color:var(--loombus-border)] py-5" aria-label="Discussion updates">
        <p className="text-sm text-[color:var(--loombus-text-muted)]">
          Preparing your discussion updates…
        </p>
      </section>
    );
  }

  return (
    <section className="border-y border-[color:var(--loombus-border)] py-5" aria-label="Discussion updates">
      <div className="grid gap-5 lg:grid-cols-2 lg:gap-7">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <MessageCircle aria-hidden="true" className="h-4 w-4 text-[#CBAB5B]" />
            <h2 className="text-sm font-semibold tracking-[-0.01em] text-[color:var(--loombus-text)]">
              Continue the conversation
            </h2>
          </div>

          {snapshot.continueItems.length > 0 ? (
            <div className="mt-3 divide-y divide-[color:var(--loombus-border-muted)]">
              {snapshot.continueItems.slice(0, 3).map((item) => (
                <Link
                  key={item.discussionId}
                  href={`/discussions/${item.discussionId}`}
                  className="group flex items-start justify-between gap-4 py-3 first:pt-0"
                >
                  <span className="min-w-0">
                    <strong className="line-clamp-2 block text-sm font-semibold leading-5 text-[color:var(--loombus-text)] group-hover:text-[#CBAB5B]">
                      {normalizePublicText(item.title)}
                    </strong>
                    <span className="mt-1 block text-xs leading-5 text-[color:var(--loombus-text-muted)]">
                      {item.detail}
                    </span>
                  </span>
                  <ArrowRight
                    aria-hidden="true"
                    className="mt-1 h-4 w-4 shrink-0 text-[color:var(--loombus-text-muted)] group-hover:text-[#CBAB5B]"
                  />
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
              When a discussion you joined moves forward, it will return here.
            </p>
          )}
        </div>

        <div className="min-w-0 border-t border-[color:var(--loombus-border-muted)] pt-5 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
          <div className="flex items-center gap-2">
            <Clock3 aria-hidden="true" className="h-4 w-4 text-[#CBAB5B]" />
            <h2 className="text-sm font-semibold tracking-[-0.01em] text-[color:var(--loombus-text)]">
              New since your last visit
            </h2>
          </div>

          {!snapshot.previousVisitAt ? (
            <p className="mt-3 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
              This visit establishes your baseline. On your next return, Loombus will show what meaningfully changed.
            </p>
          ) : snapshot.newCount === 0 ? (
            <p className="mt-3 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
              You&apos;re caught up. No visible discussions have changed since your previous visit.
            </p>
          ) : (
            <>
              <p className="mt-3 text-sm font-semibold text-[color:var(--loombus-text)]">
                {snapshot.newCount} {snapshot.newCount === 1 ? "discussion has" : "discussions have"} meaningful new activity.
              </p>
              <div className="mt-2 divide-y divide-[color:var(--loombus-border-muted)]">
                {snapshot.newItems.slice(0, 3).map((item) => (
                  <Link
                    key={item.discussionId}
                    href={`/discussions/${item.discussionId}`}
                    className="group block py-2.5"
                  >
                    <strong className="line-clamp-1 block text-sm font-semibold text-[color:var(--loombus-text)] group-hover:text-[#CBAB5B]">
                      {normalizePublicText(item.title)}
                    </strong>
                    <span className="mt-0.5 block text-xs text-[color:var(--loombus-text-muted)]">
                      {item.detail}
                    </span>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function EngagementTabs({
  mode,
  onMode,
}: {
  mode: EngagementMode;
  onMode: (mode: Exclude<EngagementMode, null>) => void;
}) {
  const common =
    "shrink-0 rounded-full border px-4 py-2.5 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CBAB5B]";

  return (
    <>
      <button
        type="button"
        onClick={() => onMode("for_you")}
        className={`${common} ${
          mode === "for_you"
            ? "border-[#CBAB5B] bg-[color:var(--loombus-surface)] text-[color:var(--loombus-text)]"
            : "border-transparent bg-[color:var(--loombus-surface-muted)] text-[color:var(--loombus-text)] hover:border-[color:var(--loombus-border)]"
        }`}
        aria-pressed={mode === "for_you"}
        title="Relevant discussions based on people you follow, discussions you joined or saved, topic affinity, freshness, and meaningful activity."
      >
        <span className="inline-flex items-center gap-1.5">
          <Sparkles aria-hidden="true" className="h-3.5 w-3.5 text-[#CBAB5B]" />
          For You
        </span>
      </button>

      <button
        type="button"
        onClick={() => onMode("active")}
        className={`${common} ${
          mode === "active"
            ? "border-[#CBAB5B] bg-[color:var(--loombus-surface)] text-[color:var(--loombus-text)]"
            : "border-transparent bg-[color:var(--loombus-surface-muted)] text-[color:var(--loombus-text)] hover:border-[color:var(--loombus-border)]"
        }`}
        aria-pressed={mode === "active"}
        title="Discussions with meaningful recent movement, not simply the most views."
      >
        <span className="inline-flex items-center gap-1.5">
          <TrendingUp aria-hidden="true" className="h-3.5 w-3.5 text-[#CBAB5B]" />
          Active
        </span>
      </button>
    </>
  );
}

function DiscussionsEngagementController() {
  const [mode, setMode] = useState<EngagementMode>("for_you");
  const [snapshot, setSnapshot] = useState<EngagementSnapshot | null>(null);
  const snapshotRef = useRef<EngagementSnapshot | null>(null);
  const suppressOriginalClick = useRef(false);

  const publishModeState = useCallback((nextMode: EngagementMode) => {
    window.dispatchEvent(
      new CustomEvent(MODE_STATE_EVENT, { detail: { mode: nextMode } })
    );
  }, []);

  const applyFeedMode = useCallback((nextMode: EngagementMode) => {
    const nextSnapshot = snapshotRef.current;
    const root = findDiscussionsFeedRoot();
    const list = root ? findDiscussionList(root) : null;
    if (!root || !list) return;

    const articles = Array.from(list.children).filter(
      (node): node is HTMLElement =>
        node instanceof HTMLElement && Boolean(getDiscussionIdFromArticle(node))
    );

    if (!nextSnapshot || nextMode === null) {
      for (const article of articles) {
        article.style.removeProperty("order");
        article.style.removeProperty("display");
      }
      list.style.removeProperty("display");
      list.style.removeProperty("flex-direction");
      list.style.removeProperty("gap");
      return;
    }

    list.style.display = "flex";
    list.style.flexDirection = "column";
    list.style.gap = "1.25rem";

    const order = nextMode === "active" ? nextSnapshot.activeOrder : nextSnapshot.forYouOrder;
    const orderMap = new Map(order.map((id, index) => [id, index]));

    for (const article of articles) {
      const discussionId = getDiscussionIdFromArticle(article);
      if (!discussionId) continue;
      article.style.order = String(orderMap.get(discussionId) ?? order.length + 100);
      article.style.display =
        nextMode === "active" && !nextSnapshot.activeIds.has(discussionId) ? "none" : "";
    }
  }, []);

  const selectMode = useCallback(
    (nextMode: Exclude<EngagementMode, null>) => {
      const root = findDiscussionsFeedRoot();
      const originalTabRow = root ? findOriginalTabRow(root) : null;
      const allButton = originalTabRow
        ? Array.from(originalTabRow.querySelectorAll<HTMLButtonElement>("button")).find(
            (button) => button.textContent?.trim() === "All"
          )
        : null;

      if (allButton) {
        suppressOriginalClick.current = true;
        allButton.click();
        window.setTimeout(() => {
          suppressOriginalClick.current = false;
        }, 0);
      }

      setMode(nextMode);
      publishModeState(nextMode);
      requestAnimationFrame(() => applyFeedMode(nextMode));
    },
    [applyFeedMode, publishModeState]
  );

  useEffect(() => {
    let mounted = true;

    async function load() {
      const { data: authData } = await supabase.auth.getUser();
      const viewerId = authData.user?.id ?? null;
      const now = Date.now();

      const [discussionResult, qotwResult, replyResult, bookmarkResult] = await Promise.all([
        supabase
          .from("discussions")
          .select("id, user_id, title, topic, created_at")
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
        supabase.from("questions_of_the_week").select("discussion_id"),
        supabase
          .from("replies")
          .select("discussion_id, user_id, created_at")
          .is("deleted_at", null),
        supabase.from("bookmarks").select("discussion_id, user_id"),
      ]);

      if (!mounted || discussionResult.error || !discussionResult.data) return;

      const qotwIds = new Set(
        (qotwResult.data ?? [])
          .map((row) => String(row.discussion_id ?? ""))
          .filter(Boolean)
      );
      const hiddenProfileIds = new Set<string>();
      const followingIds = new Set<string>();
      let previousVisitAt: string | null = null;

      if (viewerId) {
        const [blockResult, followResult, visitResult] = await Promise.all([
          supabase
            .from("user_blocks")
            .select("blocker_id, blocked_id")
            .or(`blocker_id.eq.${viewerId},blocked_id.eq.${viewerId}`),
          supabase.from("follows").select("following_id").eq("follower_id", viewerId),
          supabase.rpc("begin_discussions_feed_session"),
        ]);

        for (const block of (blockResult.data ?? []) as BlockRow[]) {
          hiddenProfileIds.add(
            block.blocker_id === viewerId ? block.blocked_id : block.blocker_id
          );
        }
        for (const follow of followResult.data ?? []) {
          if (typeof follow.following_id === "string") {
            followingIds.add(follow.following_id);
          }
        }

        const visitRows = (visitResult.data ?? []) as Array<{
          previous_visit_at: string | null;
          session_started_at: string;
        }>;
        previousVisitAt = visitRows[0]?.previous_visit_at ?? null;
      }

      const discussions = (discussionResult.data as DiscussionRow[]).filter(
        (discussion) =>
          !qotwIds.has(discussion.id) && !hiddenProfileIds.has(discussion.user_id)
      );
      const discussionById = new Map(
        discussions.map((discussion) => [discussion.id, discussion])
      );
      const replies = (replyResult.data ?? []) as ReplyRow[];
      const bookmarks = (bookmarkResult.data ?? []) as BookmarkRow[];
      const repliesByDiscussion = new Map<string, ReplyRow[]>();

      for (const reply of replies) {
        if (
          !discussionById.has(reply.discussion_id) ||
          hiddenProfileIds.has(reply.user_id)
        ) {
          continue;
        }
        const bucket = repliesByDiscussion.get(reply.discussion_id) ?? [];
        bucket.push(reply);
        repliesByDiscussion.set(reply.discussion_id, bucket);
      }

      const savedIds = new Set<string>();
      const bookmarkCounts = new Map<string, number>();
      for (const bookmark of bookmarks) {
        if (!discussionById.has(bookmark.discussion_id)) continue;
        bookmarkCounts.set(
          bookmark.discussion_id,
          (bookmarkCounts.get(bookmark.discussion_id) ?? 0) + 1
        );
        if (viewerId && bookmark.user_id === viewerId) {
          savedIds.add(bookmark.discussion_id);
        }
      }

      const participatedIds = new Set<string>();
      const preferredTopics = new Set<string>();
      const continueItems: Array<EngagementItem & { sortAt: number }> = [];
      const newItems: Array<EngagementItem & { sortAt: number }> = [];
      const activityAt = new Map<string, string>();
      const activeScores = new Map<string, number>();
      const forYouScores = new Map<string, number>();

      for (const discussion of discussions) {
        const discussionReplies = (repliesByDiscussion.get(discussion.id) ?? []).sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        const latestReply = discussionReplies.at(-1)?.created_at ?? null;
        const latestActivity =
          latestReply &&
          new Date(latestReply).getTime() > new Date(discussion.created_at).getTime()
            ? latestReply
            : discussion.created_at;
        activityAt.set(discussion.id, latestActivity);

        const recentReplies = discussionReplies.filter(
          (reply) =>
            now - new Date(reply.created_at).getTime() <= 7 * 24 * 3_600_000
        );
        const recentContributors = new Set(
          recentReplies.map((reply) => reply.user_id)
        ).size;
        const activeScore =
          recentReplies.length * 8 +
          recentContributors * 6 +
          freshnessScore(latestActivity, now) +
          Math.min(12, bookmarkCounts.get(discussion.id) ?? 0);
        activeScores.set(discussion.id, activeScore);

        if (viewerId) {
          const viewerReplies = discussionReplies.filter(
            (reply) => reply.user_id === viewerId
          );
          const latestViewerReply = viewerReplies.at(-1) ?? null;
          if (latestViewerReply) {
            participatedIds.add(discussion.id);
            if (discussion.topic) preferredTopics.add(discussion.topic);

            const responsesAfter = discussionReplies.filter(
              (reply) =>
                reply.user_id !== viewerId &&
                new Date(reply.created_at).getTime() >
                  new Date(latestViewerReply.created_at).getTime()
            );
            if (responsesAfter.length > 0) {
              continueItems.push({
                discussionId: discussion.id,
                title: discussion.title,
                detail: `${responsesAfter.length} ${
                  responsesAfter.length === 1 ? "reply" : "replies"
                } since your latest contribution`,
                sortAt: new Date(responsesAfter.at(-1)!.created_at).getTime(),
              });
            }
          }
        }
      }

      for (const discussion of discussions) {
        if (savedIds.has(discussion.id) && discussion.topic) {
          preferredTopics.add(discussion.topic);
        }
        if (followingIds.has(discussion.user_id) && discussion.topic) {
          preferredTopics.add(discussion.topic);
        }
      }

      for (const discussion of discussions) {
        const latestActivity = activityAt.get(discussion.id) ?? discussion.created_at;
        const discussionReplies = repliesByDiscussion.get(discussion.id) ?? [];
        let score = activeScores.get(discussion.id) ?? 0;

        if (followingIds.has(discussion.user_id)) score += 70;
        if (savedIds.has(discussion.id)) score += 55;
        if (participatedIds.has(discussion.id)) score += 65;
        if (discussion.topic && preferredTopics.has(discussion.topic)) score += 28;
        score += Math.min(24, discussionReplies.length * 2);
        forYouScores.set(discussion.id, score);

        if (
          previousVisitAt &&
          new Date(latestActivity).getTime() > new Date(previousVisitAt).getTime()
        ) {
          const repliesSince = discussionReplies.filter(
            (reply) =>
              new Date(reply.created_at).getTime() >
              new Date(previousVisitAt as string).getTime()
          ).length;
          newItems.push({
            discussionId: discussion.id,
            title: discussion.title,
            detail: formatNewDetail(repliesSince),
            sortAt: new Date(latestActivity).getTime(),
          });
        }
      }

      const forYouOrder = [...discussions]
        .sort(
          (a, b) =>
            (forYouScores.get(b.id) ?? 0) - (forYouScores.get(a.id) ?? 0) ||
            new Date(activityAt.get(b.id) ?? b.created_at).getTime() -
              new Date(activityAt.get(a.id) ?? a.created_at).getTime()
        )
        .map((discussion) => discussion.id);

      const activeDiscussions = discussions.filter((discussion) => {
        const score = activeScores.get(discussion.id) ?? 0;
        const createdRecently =
          now - new Date(discussion.created_at).getTime() <= 72 * 3_600_000;
        return score >= 18 || createdRecently;
      });
      const activeOrder = activeDiscussions
        .sort(
          (a, b) =>
            (activeScores.get(b.id) ?? 0) - (activeScores.get(a.id) ?? 0) ||
            new Date(activityAt.get(b.id) ?? b.created_at).getTime() -
              new Date(activityAt.get(a.id) ?? a.created_at).getTime()
        )
        .map((discussion) => discussion.id);

      const nextSnapshot: EngagementSnapshot = {
        previousVisitAt,
        continueItems: continueItems.sort((a, b) => b.sortAt - a.sortAt),
        newItems: newItems.sort((a, b) => b.sortAt - a.sortAt),
        newCount: newItems.length,
        forYouOrder,
        activeIds: new Set(activeOrder),
        activeOrder,
      };

      if (mounted) {
        snapshotRef.current = nextSnapshot;
        setSnapshot(nextSnapshot);
        requestAnimationFrame(() => applyFeedMode("for_you"));
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [applyFeedMode]);

  useEffect(() => {
    const handler = (event: Event) => {
      const requestedMode = (event as CustomEvent<{ mode?: EngagementMode }>).detail?.mode;
      if (requestedMode === "for_you" || requestedMode === "active") {
        selectMode(requestedMode);
      }
    };
    window.addEventListener(MODE_REQUEST_EVENT, handler);
    return () => window.removeEventListener(MODE_REQUEST_EVENT, handler);
  }, [selectMode]);

  useEffect(() => {
    const root = findDiscussionsFeedRoot();
    const tabRow = root ? findOriginalTabRow(root) : null;
    if (!tabRow) return;

    const buttons = Array.from(tabRow.querySelectorAll<HTMLButtonElement>("button")).filter(
      (button) => ORIGINAL_TAB_LABELS.has(button.textContent?.trim() ?? "")
    );

    const onOriginalTab = () => {
      if (suppressOriginalClick.current) return;
      setMode(null);
      publishModeState(null);
      requestAnimationFrame(() => applyFeedMode(null));
    };

    for (const button of buttons) {
      button.addEventListener("click", onOriginalTab);
    }
    return () => {
      for (const button of buttons) {
        button.removeEventListener("click", onOriginalTab);
      }
    };
  }, [applyFeedMode, publishModeState]);

  useEffect(() => {
    const root = findDiscussionsFeedRoot();
    if (!root) return;

    const observer = new MutationObserver(() => {
      if (mode) requestAnimationFrame(() => applyFeedMode(mode));
    });
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [mode, applyFeedMode]);

  useEffect(() => {
    const root = findDiscussionsFeedRoot();
    const tabRow = root ? findOriginalTabRow(root) : null;
    const allButton = tabRow
      ? Array.from(tabRow.querySelectorAll<HTMLButtonElement>("button")).find(
          (button) => button.textContent?.trim() === "All"
        )
      : null;
    if (!allButton) return;

    if (mode) {
      allButton.style.borderColor = "transparent";
      allButton.style.background = "var(--loombus-surface-muted)";
    } else {
      allButton.style.removeProperty("border-color");
      allButton.style.removeProperty("background");
    }

    return () => {
      allButton.style.removeProperty("border-color");
      allButton.style.removeProperty("background");
    };
  }, [mode]);

  return <EngagementPanel snapshot={snapshot} />;
}

function EngagementTabController() {
  const [mode, setMode] = useState<EngagementMode>("for_you");

  useEffect(() => {
    const handler = (event: Event) => {
      const nextMode = (event as CustomEvent<{ mode?: EngagementMode }>).detail?.mode;
      setMode(nextMode === "for_you" || nextMode === "active" ? nextMode : null);
    };
    window.addEventListener(MODE_STATE_EVENT, handler);
    return () => window.removeEventListener(MODE_STATE_EVENT, handler);
  }, []);

  function requestMode(nextMode: Exclude<EngagementMode, null>) {
    window.dispatchEvent(
      new CustomEvent(MODE_REQUEST_EVENT, { detail: { mode: nextMode } })
    );
  }

  return <EngagementTabs mode={mode} onMode={requestMode} />;
}

export function DiscussionsEngagementBridge() {
  useEffect(() => {
    let panelRoot: Root | null = null;
    let tabsRoot: Root | null = null;
    let panelMount: HTMLDivElement | null = null;
    let tabsMount: HTMLDivElement | null = null;
    let observer: MutationObserver | null = null;

    function ensureMounted() {
      const feedRoot = findDiscussionsFeedRoot();
      if (!feedRoot) return false;

      const headingBlock = findHeadingBlock(feedRoot);
      const tabRow = findOriginalTabRow(feedRoot);
      if (!headingBlock?.parentElement || !tabRow) return false;

      if (!panelMount?.isConnected) {
        panelMount = document.createElement("div");
        panelMount.dataset.discussionsEngagementMount = "true";
        panelMount.className = "mb-6";

        const qotwMount = feedRoot.querySelector<HTMLElement>(
          '[data-question-of-the-week-mount="true"]'
        );
        if (qotwMount) {
          qotwMount.insertAdjacentElement("afterend", panelMount);
        } else {
          headingBlock.insertAdjacentElement("afterend", panelMount);
        }

        panelRoot = createRoot(panelMount);
        panelRoot.render(<DiscussionsEngagementController />);
      }

      if (!tabsMount?.isConnected) {
        tabsMount = document.createElement("div");
        tabsMount.dataset.discussionsEngagementTabMount = "true";
        tabsMount.style.display = "contents";
        tabRow.insertBefore(tabsMount, tabRow.firstChild);
        tabsRoot = createRoot(tabsMount);
        tabsRoot.render(<EngagementTabController />);
      }

      return true;
    }

    if (!ensureMounted()) {
      observer = new MutationObserver(() => {
        if (ensureMounted()) {
          observer?.disconnect();
          observer = null;
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      observer?.disconnect();
      panelRoot?.unmount();
      tabsRoot?.unmount();
      panelMount?.remove();
      tabsMount?.remove();
    };
  }, []);

  return null;
}
