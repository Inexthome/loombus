"use client";

import { useParams } from "next/navigation";
import { useEffect } from "react";
import { requestDiscussionThreadWindow } from "@/lib/discussion-reply-window";
import { supabase } from "@/lib/supabase/client";

type ReplyThreadRow = {
  id: string;
  referenced_reply_id: string | null;
};

const OPEN_BUTTON_ATTR = "data-loombus-open-thread";
const GENERATED_ATTR = "data-loombus-thread-generated";
const COLLAPSED_STORAGE_PREFIX = "loombus:discussion-collapsed-response-branches:";

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
    const expanded = new Set<string>();
    const collapsed = new Set<string>();
    const requestedChildren = new Set<string>();
    let activeReplyId: string | null = null;
    let applying = false;
    let reloadTimer: number | null = null;
    const storageKey = `${COLLAPSED_STORAGE_PREFIX}${discussionId}`;

    function loadCollapsedPreference() {
      try {
        const stored = window.localStorage.getItem(storageKey);
        if (!stored) return;
        const parsed = JSON.parse(stored) as unknown;
        if (!Array.isArray(parsed)) return;
        for (const replyId of parsed) {
          if (typeof replyId === "string" && replyId) collapsed.add(replyId);
        }
      } catch {
        // Preference storage is best-effort; default-open behavior remains usable.
      }
    }

    function persistCollapsedPreference() {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify([...collapsed]));
      } catch {
        // Do not block thread interaction if local storage is unavailable.
      }
    }

    function rebuildChildren(nextRows: ReplyThreadRow[]) {
      rows = new Map(nextRows.map((row) => [row.id, row]));
      children = new Map<string, string[]>();

      for (const row of nextRows) {
        const parentId = row.referenced_reply_id;
        if (!parentId || !rows.has(parentId)) continue;
        children.set(parentId, [...(children.get(parentId) ?? []), row.id]);
      }
    }

    function directChildCount(replyId: string) {
      return (children.get(replyId) ?? []).length;
    }

    function parentOf(replyId: string) {
      const parentId = rows.get(replyId)?.referenced_reply_id ?? null;
      return parentId && rows.has(parentId) ? parentId : null;
    }

    function isRoot(replyId: string) {
      return parentOf(replyId) === null;
    }

    function requestChildren(replyId: string) {
      if (requestedChildren.has(replyId) || directChildCount(replyId) <= 0) return;
      requestedChildren.add(replyId);
      requestDiscussionThreadWindow({ discussionId, parentReplyId: replyId });
    }

    function syncDefaultExpandedState() {
      for (const [replyId, childIds] of children.entries()) {
        if (childIds.length <= 0) continue;
        if (collapsed.has(replyId)) {
          expanded.delete(replyId);
          continue;
        }
        expanded.add(replyId);
        requestChildren(replyId);
      }
    }

    function ensureBranchButton(wrapper: HTMLElement, replyId: string) {
      const count = directChildCount(replyId);
      const existing = wrapper.querySelector<HTMLButtonElement>(
        `[${OPEN_BUTTON_ATTR}="${replyId}"]`,
      );

      if (count <= 0) {
        existing?.remove();
        return;
      }

      const footer = wrapper.querySelector<HTMLElement>(".discussion-v2-reply-footer");
      if (!footer) return;

      const responseLabel = `${count} response${count === 1 ? "" : "s"}`;
      const isExpanded = expanded.has(replyId);
      const visibleLabel = isExpanded ? "Hide responses" : responseLabel;
      const ariaLabel = isExpanded
        ? `Hide ${responseLabel}`
        : `Show ${responseLabel} inline`;

      if (existing) {
        if (existing.textContent !== visibleLabel) existing.textContent = visibleLabel;
        existing.setAttribute("aria-label", ariaLabel);
        existing.setAttribute("aria-expanded", String(isExpanded));
        return;
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = "discussion-thread-branch-button";
      button.setAttribute(OPEN_BUTTON_ATTR, replyId);
      button.setAttribute(GENERATED_ATTR, "true");
      button.setAttribute("aria-label", ariaLabel);
      button.setAttribute("aria-expanded", String(isExpanded));
      button.textContent = visibleLabel;

      const signal = footer.querySelector(".discussion-v2-reply-signal");
      if (signal?.nextSibling) {
        footer.insertBefore(button, signal.nextSibling);
      } else if (signal) {
        signal.insertAdjacentElement("afterend", button);
      } else {
        footer.prepend(button);
      }
    }

    function visibleChildWrappers(replyList: HTMLElement, parentId: string) {
      const allWrappers = Array.from(
        replyList.querySelectorAll<HTMLElement>(":scope > [id^='reply-']"),
      );
      const indexById = new Map(
        allWrappers.map((wrapper, index) => [replyIdFromWrapper(wrapper), index]),
      );

      return (children.get(parentId) ?? [])
        .map((childId) => document.getElementById(`reply-${childId}`))
        .filter((wrapper): wrapper is HTMLElement => Boolean(wrapper && wrapper.parentElement === replyList))
        .sort(
          (a, b) =>
            (indexById.get(replyIdFromWrapper(a)) ?? Number.MAX_SAFE_INTEGER) -
            (indexById.get(replyIdFromWrapper(b)) ?? Number.MAX_SAFE_INTEGER),
        );
    }

    function placeExpandedChildren(
      replyList: HTMLElement,
      parentWrapper: HTMLElement,
      parentId: string,
      depth: number,
    ): HTMLElement {
      if (!expanded.has(parentId)) return parentWrapper;
      requestChildren(parentId);

      let anchor = parentWrapper;
      for (const childWrapper of visibleChildWrappers(replyList, parentId)) {
        const childId = replyIdFromWrapper(childWrapper);
        if (!childId) continue;

        if (childWrapper.previousElementSibling !== anchor) {
          anchor.insertAdjacentElement("afterend", childWrapper);
        }
        childWrapper.hidden = false;
        childWrapper.dataset.threadChild = "true";
        childWrapper.dataset.threadDepth = String(depth);
        childWrapper.style.setProperty("--discussion-thread-depth", String(depth));
        ensureBranchButton(childWrapper, childId);
        anchor = placeExpandedChildren(replyList, childWrapper, childId, depth + 1);
      }

      return anchor;
    }

    function applyThreadView() {
      if (applying || cancelled) return;
      applying = true;

      try {
        const replyList = document.querySelector<HTMLElement>(".discussion-v2-reply-list");
        if (!replyList) return;

        replyList.classList.remove("discussion-thread-focused-list");
        replyList.classList.toggle("discussion-thread-inline-list", expanded.size > 0);

        const wrappers = Array.from(
          replyList.querySelectorAll<HTMLElement>(":scope > [id^='reply-']"),
        );

        for (const wrapper of wrappers) {
          const replyId = replyIdFromWrapper(wrapper);
          if (!replyId) continue;

          ensureBranchButton(wrapper, replyId);
          wrapper.removeAttribute("data-thread-context");
          wrapper.removeAttribute("data-thread-child");
          wrapper.removeAttribute("data-thread-depth");
          wrapper.style.removeProperty("--discussion-thread-depth");
          wrapper.hidden = !isRoot(replyId);
        }

        const rootWrappers = wrappers.filter((wrapper) => isRoot(replyIdFromWrapper(wrapper)));
        for (const rootWrapper of rootWrappers) {
          const replyId = replyIdFromWrapper(rootWrapper);
          if (!replyId) continue;
          placeExpandedChildren(replyList, rootWrapper, replyId, 1);
        }

        if (activeReplyId && expanded.has(activeReplyId)) {
          document.getElementById(`reply-${activeReplyId}`)?.setAttribute("data-thread-context", "true");
        }
      } finally {
        applying = false;
      }
    }

    function toggleThread(replyId: string) {
      if (!rows.has(replyId)) return;

      if (expanded.has(replyId)) {
        expanded.delete(replyId);
        collapsed.add(replyId);
        if (activeReplyId === replyId) activeReplyId = parentOf(replyId);
      } else {
        collapsed.delete(replyId);
        expanded.add(replyId);
        activeReplyId = replyId;
        requestChildren(replyId);
      }

      persistCollapsedPreference();
      applyThreadView();
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

      for (const replyId of [...collapsed]) {
        if (!rows.has(replyId) || directChildCount(replyId) <= 0) collapsed.delete(replyId);
      }
      for (const replyId of [...expanded]) {
        if (!rows.has(replyId) || directChildCount(replyId) <= 0) expanded.delete(replyId);
      }
      if (activeReplyId && !rows.has(activeReplyId)) activeReplyId = null;

      syncDefaultExpandedState();
      persistCollapsedPreference();
      window.requestAnimationFrame(applyThreadView);
    }

    const handleClick = (event: Event) => {
      const target = event.target as Element | null;
      if (!target) return;

      const openButton = target.closest<HTMLButtonElement>(`[${OPEN_BUTTON_ATTR}]`);
      if (!openButton) return;

      const replyId = openButton.getAttribute(OPEN_BUTTON_ATTR);
      if (replyId) toggleThread(replyId);
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

    loadCollapsedPreference();
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
          wrapper.removeAttribute("data-thread-depth");
          wrapper.style.removeProperty("--discussion-thread-depth");
        });
      document.querySelectorAll(`[${GENERATED_ATTR}="true"]`).forEach((node) => node.remove());
      document
        .querySelector(".discussion-v2-reply-list")
        ?.classList.remove("discussion-thread-focused-list", "discussion-thread-inline-list");
    };
  }, [discussionId]);

  return null;
}
