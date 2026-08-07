"use client";

import { useParams } from "next/navigation";
import { useEffect } from "react";
import { getDiscussionVisibleReplyCount } from "@/lib/discussion-reply-pagination";
import {
  DISCUSSION_REPLY_WINDOW_STATE,
  requestDiscussionReplyWindowLoadMore,
  type DiscussionReplyWindowStateDetail,
} from "@/lib/discussion-reply-window";

const GENERATED_ATTR = "data-loombus-reply-pagination-generated";

function activeParentReplyId() {
  const context = document.querySelector<HTMLElement>(
    ".discussion-v2-reply-list > [data-thread-context='true'][id^='reply-']"
  );
  return context?.id.startsWith("reply-") ? context.id.slice("reply-".length) : null;
}

function updateConversationHeading(totalCount: number) {
  const heading = document.querySelector<HTMLElement>(
    ".discussion-v2-replies-heading h2"
  );
  if (!heading) return;
  heading.textContent = `${totalCount.toLocaleString()} ${totalCount === 1 ? "reply" : "replies"}`;
}

export function DiscussionReplyPaginationBridge() {
  const params = useParams();
  const discussionId = String(params.id ?? "");

  useEffect(() => {
    if (!discussionId) return;

    let cancelled = false;
    let applying = false;
    let latestState: DiscussionReplyWindowStateDetail | null = null;
    let refreshTimer: number | null = null;

    function ensureControls() {
      if (applying || cancelled) return;
      applying = true;

      try {
        const replyList = document.querySelector<HTMLElement>(".discussion-v2-reply-list");
        if (!replyList || !latestState) return;

        updateConversationHeading(latestState.discussionTotalCount);

        let controls = replyList.parentElement?.querySelector<HTMLElement>(
          `:scope > [${GENERATED_ATTR}='true']`
        );
        const parentReplyId = activeParentReplyId();
        const state = parentReplyId
          ? latestState.children[parentReplyId]
          : {
              totalCount: latestState.rootTotalCount,
              hasMore: latestState.rootHasMore,
              loading: latestState.rootLoading,
              loaded: latestState.rootLoaded,
            };

        const shouldShow = Boolean(state?.hasMore || state?.loading);
        if (!shouldShow) {
          controls?.remove();
          return;
        }

        if (!controls) {
          controls = document.createElement("div");
          controls.className = "discussion-reply-pagination-controls";
          controls.setAttribute(GENERATED_ATTR, "true");
          replyList.insertAdjacentElement("afterend", controls);
        }

        controls.replaceChildren();
        const button = document.createElement("button");
        button.type = "button";
        button.className = "discussion-reply-pagination-button";
        button.disabled = Boolean(state?.loading);
        button.textContent = state?.loading
          ? "Loading…"
          : parentReplyId
            ? "Load more responses"
            : "Load more replies";
        button.setAttribute(
          "aria-label",
          parentReplyId ? "Load the next responses to this point" : "Load the next discussion replies"
        );
        button.addEventListener("click", () => {
          requestDiscussionReplyWindowLoadMore({
            discussionId,
            parentReplyId,
          });
        });
        controls.append(button);
      } finally {
        applying = false;
      }
    }

    async function refreshExactCount() {
      try {
        const total = await getDiscussionVisibleReplyCount(discussionId);
        if (cancelled) return;
        if (latestState) latestState = { ...latestState, discussionTotalCount: total };
        updateConversationHeading(total);
      } catch {
        // Count refresh is supplementary; the current window remains usable.
      }
    }

    const handleState = (event: Event) => {
      const detail = (event as CustomEvent<DiscussionReplyWindowStateDetail>).detail;
      if (!detail || detail.discussionId !== discussionId) return;
      latestState = detail;
      window.requestAnimationFrame(ensureControls);
    };

    const handleMetricsChanged = () => {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        void refreshExactCount();
      }, 220);
    };

    const observer = new MutationObserver(() => {
      if (!applying) window.requestAnimationFrame(ensureControls);
    });

    window.addEventListener(DISCUSSION_REPLY_WINDOW_STATE, handleState);
    window.addEventListener("loombus:discussion-metrics-changed", handleMetricsChanged);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelled = true;
      window.removeEventListener(DISCUSSION_REPLY_WINDOW_STATE, handleState);
      window.removeEventListener("loombus:discussion-metrics-changed", handleMetricsChanged);
      observer.disconnect();
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      document
        .querySelectorAll(`[${GENERATED_ATTR}='true']`)
        .forEach((node) => node.remove());
    };
  }, [discussionId]);

  return null;
}
