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

    function ancestorPath(replyId: string) {
      const path: string[] = [];
      const visited = new Set<string>();
      let current: string | null = replyId;

      while (current && !visited.has(current)) {
        visited.add(current);
        path.unshift(current);
        current = parentOf(current);
      }

      return path;
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
        existing.setAttribute("aria-label", `Open ${label} in a focused point thread`);
        return;
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = "discussion-thread-branch-button";
      button.setAttribute(OPEN_BUTTON_ATTR, replyId);
      button.setAttribute(GENERATED_ATTR, "true");
      button.setAttribute("aria-label", `Open ${label} in a focused point thread`);
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

    function ensureContextLabel(wrapper: HTMLElement, visible: boolean) {
      let label = wrapper.querySelector<HTMLElement>(":scope > .discussion-thread-context-label");
      if (!visible) {
        label?.remove();
        return;
      }

      if (!label) {
        label = document.createElement("div");
        label.className = "discussion-thread-context-label";
        label.setAttribute(GENERATED_ATTR, "true");
        wrapper.prepend(label);
      }

      label.textContent = "Point being discussed";
    }

    function ensureResponsesHeading(replyList: HTMLElement) {
      let heading = replyList.querySelector<HTMLElement>(":scope > .discussion-thread-responses-heading");

      if (!activeReplyId) {
        heading?.remove();
        return;
      }

      if (!heading) {
        heading = document.createElement("div");
        heading.className = "discussion-thread-responses-heading";
        heading.setAttribute(GENERATED_ATTR, "true");
        replyList.append(heading);
      }

      const direct = directChildCount(activeReplyId);
      heading.replaceChildren();

      const copy = document.createElement("div");
      const eyebrow = document.createElement("span");
      eyebrow.textContent = "Responses to this point";
      const count = document.createElement("strong");
      count.textContent = `${direct} direct response${direct === 1 ? "" : "s"}`;
      copy.append(eyebrow, count);
      heading.append(copy);
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
      const path = ancestorPath(activeReplyId);
      const depth = Math.max(0, path.length - 1);

      banner.replaceChildren();

      const main = document.createElement("div");
      main.className = "discussion-thread-focus-main";

      const breadcrumbs = document.createElement("nav");
      breadcrumbs.className = "discussion-thread-breadcrumbs";
      breadcrumbs.setAttribute("aria-label", "Point thread path");

      const allCrumb = document.createElement("button");
      allCrumb.type = "button";
      allCrumb.dataset.loombusThreadAll = "true";
      allCrumb.textContent = "Replies";
      breadcrumbs.append(allCrumb);

      path.forEach((replyId, index) => {
        const separator = document.createElement("span");
        separator.setAttribute("aria-hidden", "true");
        separator.textContent = "/";
        breadcrumbs.append(separator);

        const crumb = document.createElement("button");
        crumb.type = "button";
        crumb.dataset.loombusThreadCrumb = replyId;
        crumb.disabled = replyId === activeReplyId;
        crumb.textContent = index === 0 ? "Point" : `Response ${index}`;
        breadcrumbs.append(crumb);
      });

      const copy = document.createElement("div");
      copy.className = "discussion-thread-focus-copy";

      const eyebrow = document.createElement("span");
      eyebrow.textContent = "Point thread";

      const title = document.createElement("strong");
      title.textContent = depth === 0 ? "Focused on one discussion point" : `Focused ${depth} level${depth === 1 ? "" : "s"} into this point`;

      const detail = document.createElement("p");
      detail.textContent =
        total === direct
          ? `${direct} direct response${direct === 1 ? "" : "s"} to the point below.`
          : `${direct} direct response${direct === 1 ? "" : "s"}, with ${total} total response${total === 1 ? "" : "s"} continuing through this branch.`;

      copy.append(eyebrow, title, detail);
      main.append(breadcrumbs, copy);

      const actions = document.createElement("div");
      actions.className = "discussion-thread-focus-actions";

      const respondButton = document.createElement("button");
      respondButton.type = "button";
      respondButton.dataset.loombusThreadRespond = activeReplyId;
      respondButton.className = "discussion-thread-primary-action";
      respondButton.textContent = "Respond to this point";
      actions.append(respondButton);

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

      banner.append(main, actions);
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
            ensureContextLabel(wrapper, false);
            wrapper.hidden = !isRoot(replyId);
            continue;
          }

          const isContext = replyId === activeReplyId;
          const isDirectChild = parentOf(replyId) === activeReplyId;
          wrapper.hidden = !isContext && !isDirectChild;
          ensureContextLabel(wrapper, isContext);

          if (isContext) wrapper.dataset.threadContext = "true";
          if (isDirectChild) wrapper.dataset.threadChild = "true";
        }

        ensureFocusBanner(replyList);
        ensureResponsesHeading(replyList);
      } finally {
        applying = false;
      }
    }

    function focusThread(replyId: string) {
      if (!rows.has(replyId)) return;
      activeReplyId = replyId;
      applyThreadView();
      document
        .querySelector(".discussion-thread-focus-banner")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function showAllReplies() {
      activeReplyId = null;
      applyThreadView();
      document
        .querySelector(".discussion-v2-replies-section")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
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
        if (replyId) focusThread(replyId);
        return;
      }

      const crumbButton = target.closest<HTMLButtonElement>("[data-loombus-thread-crumb]");
      if (crumbButton) {
        const replyId = crumbButton.dataset.loombusThreadCrumb;
        if (replyId) focusThread(replyId);
        return;
      }

      const parentButton = target.closest<HTMLButtonElement>("[data-loombus-thread-parent]");
      if (parentButton) {
        const parentId = parentButton.dataset.loombusThreadParent;
        if (parentId) focusThread(parentId);
        return;
      }

      const respondButton = target.closest<HTMLButtonElement>("[data-loombus-thread-respond]");
      if (respondButton) {
        const replyId = respondButton.dataset.loombusThreadRespond;
        if (!replyId) return;
        const wrapper = document.getElementById(`reply-${replyId}`);
        const originalRespond = Array.from(wrapper?.querySelectorAll<HTMLButtonElement>("button") ?? []).find(
          (button) => button.textContent?.trim() === "Respond to point"
        );
        originalRespond?.click();
        return;
      }

      if (target.closest("[data-loombus-thread-all]")) {
        showAllReplies();
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
