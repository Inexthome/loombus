"use client";

import { useParams } from "next/navigation";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

type ReplyThreadRow = {
  id: string;
  referenced_reply_id: string | null;
};

const OPEN_BUTTON_ATTR = "data-loombus-open-thread";
const GENERATED_ATTR = "data-loombus-thread-generated";

function replyIdFromWrapper(element: Element) {
  const id = element.id;
  return id.startsWith("reply-") ? id.slice("reply-".length) : "";
}

export function DiscussionFocusedThreadBridge() {
  const params = useParams();
  const discussionId = String(params.id ?? "");

  useEffect(() => {
    if (!discussionId) return;

    let cancelled = false;
    let rows = new Map<string, ReplyThreadRow>();
    let children = new Map<string, string[]>();
    let activeReplyId: string | null = null;
    let applying = false;
    let reloadTimer: number | null = null;

    function rebuildChildren(nextRows: ReplyThreadRow[]) {
      rows = new Map(nextRows.map((row) => [row.id, row]));
      children = new Map<string, string[]>();

      for (const row of nextRows) {
        const parentId = row.referenced_reply_id;
        if (!parentId || !rows.has(parentId)) continue;
        children.set(parentId, [...(children.get(parentId) ?? []), row.id]);
      }
    }

    function descendantCount(replyId: string, visited = new Set<string>()): number {
      if (visited.has(replyId)) return 0;
      visited.add(replyId);
      let total = 0;
      for (const childId of children.get(replyId) ?? []) {
        total += 1 + descendantCount(childId, visited);
      }
      return total;
    }

    function directChildCount(replyId: string) {
      return (children.get(replyId) ?? []).length;
    }

    function isRoot(replyId: string) {
      const parentId = rows.get(replyId)?.referenced_reply_id;
      return !parentId || !rows.has(parentId);
    }

    function parentOf(replyId: string) {
      const parentId = rows.get(replyId)?.referenced_reply_id ?? null;
      return parentId && rows.has(parentId) ? parentId : null;
    }

    function ensureBranchButton(wrapper: HTMLElement, replyId: string) {
      const count = descendantCount(replyId);
      const existing = wrapper.querySelector<HTMLButtonElement>(
        `[${OPEN_BUTTON_ATTR}="${replyId}"]`
      );

      if (count <= 0) {
        existing?.remove();
        return;
      }

      const footer = wrapper.querySelector<HTMLElement>(".discussion-v2-reply-footer");
      if (!footer) return;

      const label = `${count} response${count === 1 ? "" : "s"}`;
      if (existing) {
        existing.textContent = label;
        existing.setAttribute("aria-label", `Open ${label} in a focused thread`);
        return;
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = "discussion-thread-branch-button";
      button.setAttribute(OPEN_BUTTON_ATTR, replyId);
      button.setAttribute(GENERATED_ATTR, "true");
      button.setAttribute("aria-label", `Open ${label} in a focused thread`);
      button.textContent = label;

      const signal = footer.querySelector(".discussion-v2-reply-signal");
      if (signal?.nextSibling) {
        footer.insertBefore(button, signal.nextSibling);
      } else if (signal) {
        signal.insertAdjacentElement("afterend", button);
      } else {
        footer.prepend(button);
      }
    }

    function ensureFocusBanner(replyList: HTMLElement) {
      let banner = replyList.parentElement?.querySelector<HTMLElement>(
        ":scope > .discussion-thread-focus-banner"
      );

      if (!activeReplyId) {
        banner?.remove();
        return;
      }

      if (!banner) {
        banner = document.createElement("section");
        banner.className = "discussion-thread-focus-banner";
        banner.setAttribute(GENERATED_ATTR, "true");
        banner.setAttribute("aria-live", "polite");
        replyList.insertAdjacentElement("beforebegin", banner);
      }

      const direct = directChildCount(activeReplyId);
      const total = descendantCount(activeReplyId);
      const parentId = parentOf(activeReplyId);

      banner.replaceChildren();

      const copy = document.createElement("div");
      copy.className = "discussion-thread-focus-copy";

      const eyebrow = document.createElement("span");
      eyebrow.textContent = "Focused thread";

      const title = document.createElement("strong");
      title.textContent = `${direct} direct response${direct === 1 ? "" : "s"}`;

      const detail = document.createElement("p");
      detail.textContent =
        total === direct
          ? "This response and its direct conversation are isolated from the main reply stream."
          : `${total} total responses continue through this branch. Open any response count to move deeper without adding indentation.`;

      copy.append(eyebrow, title, detail);

      const actions = document.createElement("div");
      actions.className = "discussion-thread-focus-actions";

      if (parentId) {
        const parentButton = document.createElement("button");
        parentButton.type = "button";
        parentButton.dataset.loombusThreadParent = parentId;
        parentButton.textContent = "Parent thread";
        actions.append(parentButton);
      }

      const allButton = document.createElement("button");
      allButton.type = "button";
      allButton.dataset.loombusThreadAll = "true";
      allButton.textContent = "Back to replies";
      actions.append(allButton);

      banner.append(copy, actions);
    }

    function applyThreadView() {
      if (applying || cancelled) return;
      applying = true;

      try {
        const replyList = document.querySelector<HTMLElement>(".discussion-v2-reply-list");
        if (!replyList) return;

        replyList.classList.toggle("discussion-thread-focused-list", Boolean(activeReplyId));

        const wrappers = Array.from(
          replyList.querySelectorAll<HTMLElement>(":scope > [id^='reply-']")
        );

        for (const wrapper of wrappers) {
          const replyId = replyIdFromWrapper(wrapper);
          if (!replyId) continue;

          ensureBranchButton(wrapper, replyId);
          wrapper.removeAttribute("data-thread-context");
          wrapper.removeAttribute("data-thread-child");

          if (!activeReplyId) {
            wrapper.hidden = !isRoot(replyId);
            continue;
          }

          const isContext = replyId === activeReplyId;
          const isDirectChild = parentOf(replyId) === activeReplyId;
          wrapper.hidden = !isContext && !isDirectChild;

          if (isContext) wrapper.dataset.threadContext = "true";
          if (isDirectChild) wrapper.dataset.threadChild = "true";
        }

        ensureFocusBanner(replyList);
      } finally {
        applying = false;
      }
    }

    function scheduleHierarchyReload() {
      if (reloadTimer !== null) window.clearTimeout(reloadTimer);
      reloadTimer = window.setTimeout(() => {
        reloadTimer = null;
        void loadHierarchy();
      }, 180);
    }

    async function loadHierarchy() {
      const { data } = await supabase
        .from("replies")
        .select("id, referenced_reply_id")
        .eq("discussion_id", discussionId)
        .is("deleted_at", null);

      if (cancelled || !data) return;
      rebuildChildren(data as ReplyThreadRow[]);

      if (activeReplyId && !rows.has(activeReplyId)) activeReplyId = null;
      window.requestAnimationFrame(applyThreadView);
    }

    const handleClick = (event: Event) => {
      const target = event.target as Element | null;
      if (!target) return;

      const openButton = target.closest<HTMLButtonElement>(`[${OPEN_BUTTON_ATTR}]`);
      if (openButton) {
        const replyId = openButton.getAttribute(OPEN_BUTTON_ATTR);
        if (!replyId || !rows.has(replyId)) return;
        activeReplyId = replyId;
        applyThreadView();
        document
          .querySelector(".discussion-thread-focus-banner")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      const parentButton = target.closest<HTMLButtonElement>("[data-loombus-thread-parent]");
      if (parentButton) {
        const parentId = parentButton.dataset.loombusThreadParent;
        if (!parentId || !rows.has(parentId)) return;
        activeReplyId = parentId;
        applyThreadView();
        document
          .querySelector(".discussion-thread-focus-banner")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      if (target.closest("[data-loombus-thread-all]")) {
        activeReplyId = null;
        applyThreadView();
        document
          .querySelector(".discussion-v2-replies-section")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };

    const observer = new MutationObserver((mutations) => {
      if (applying) return;

      let foundUnknownReply = false;
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof Element)) continue;
          const wrappers = node.matches("[id^='reply-']")
            ? [node]
            : Array.from(node.querySelectorAll("[id^='reply-']"));
          if (wrappers.some((wrapper) => !rows.has(replyIdFromWrapper(wrapper)))) {
            foundUnknownReply = true;
          }
        }
      }

      window.requestAnimationFrame(applyThreadView);
      if (foundUnknownReply) scheduleHierarchyReload();
    });

    document.addEventListener("click", handleClick);
    observer.observe(document.body, { childList: true, subtree: true });

    const refresh = () => scheduleHierarchyReload();
    window.addEventListener("loombus:discussion-metrics-changed", refresh);
    void loadHierarchy();

    return () => {
      cancelled = true;
      document.removeEventListener("click", handleClick);
      observer.disconnect();
      window.removeEventListener("loombus:discussion-metrics-changed", refresh);
      if (reloadTimer !== null) window.clearTimeout(reloadTimer);

      document
        .querySelectorAll<HTMLElement>(".discussion-v2-reply-list > [id^='reply-']")
        .forEach((wrapper) => {
          wrapper.hidden = false;
          wrapper.removeAttribute("data-thread-context");
          wrapper.removeAttribute("data-thread-child");
        });
      document.querySelectorAll(`[${GENERATED_ATTR}="true"]`).forEach((node) => node.remove());
      document
        .querySelector(".discussion-v2-reply-list")
        ?.classList.remove("discussion-thread-focused-list");
    };
  }, [discussionId]);

  return null;
}
