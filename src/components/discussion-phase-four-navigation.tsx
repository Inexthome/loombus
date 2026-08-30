"use client";

import { useEffect } from "react";

const GENERATED_ATTR = "data-loombus-phase-four-generated";

type WorkspaceMode = "state" | "intelligence" | "points" | "evidence" | "reply";

const WORKSPACE_ITEMS: Array<{ mode: WorkspaceMode; label: string; controls: string }> = [
  { mode: "state", label: "State of Discussion", controls: "discussion-intelligence" },
  { mode: "intelligence", label: "Conversation Intelligence", controls: "discussion-conversation-intelligence" },
  { mode: "points", label: "Points", controls: "discussion-major-points" },
  { mode: "evidence", label: "Evidence", controls: "discussion-evidence" },
  { mode: "reply", label: "Reply", controls: "discussion-reply-composer" },
];

function text(element: Element | null) {
  return element?.textContent?.trim() ?? "";
}

function responseCount(button: HTMLButtonElement | null) {
  if (!button) return 0;
  const match = button.textContent?.match(/([\d,]+)\s+responses?/i);
  return match ? Number(match[1].replaceAll(",", "")) : 0;
}

function compactCopy(value: string, max = 180) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max - 1).trimEnd()}…` : normalized;
}

export function DiscussionPhaseFourNavigation() {
  useEffect(() => {
    let cancelled = false;
    let refreshTimer: number | null = null;

    function activateWorkspace(mainColumn: HTMLElement, mode: WorkspaceMode, shouldScroll = false) {
      mainColumn.dataset.discussionWorkspaceMode = mode;
      const nav = mainColumn.querySelector<HTMLElement>(`:scope > [${GENERATED_ATTR}='nav']`);
      nav?.querySelectorAll<HTMLButtonElement>("button[data-discussion-workspace-mode]").forEach((button) => {
        const selected = button.dataset.discussionWorkspaceMode === mode;
        button.setAttribute("aria-selected", selected ? "true" : "false");
        button.tabIndex = selected ? 0 : -1;
      });

      if (shouldScroll) {
        window.requestAnimationFrame(() => {
          nav?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    }

    function ensureNavigation(mainColumn: HTMLElement) {
      let nav = mainColumn.querySelector<HTMLElement>(`:scope > [${GENERATED_ATTR}='nav']`);
      if (!nav) {
        nav = document.createElement("nav");
        nav.className = "discussion-phase-four-nav discussion-editorial-workspace-tabs";
        nav.setAttribute(GENERATED_ATTR, "nav");
        nav.setAttribute("aria-label", "Discussion workspace");
        nav.setAttribute("role", "tablist");

        for (const item of WORKSPACE_ITEMS) {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = item.label;
          button.dataset.discussionWorkspaceMode = item.mode;
          button.setAttribute("role", "tab");
          button.setAttribute("aria-controls", item.controls);
          button.setAttribute("aria-selected", item.mode === "state" ? "true" : "false");
          button.tabIndex = item.mode === "state" ? 0 : -1;
          button.onclick = () => activateWorkspace(mainColumn, item.mode, true);
          button.onkeydown = (event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const buttons = Array.from(
              nav?.querySelectorAll<HTMLButtonElement>("button[data-discussion-workspace-mode]") ?? []
            );
            const currentIndex = buttons.indexOf(button);
            let nextIndex = currentIndex;
            if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % buttons.length;
            if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + buttons.length) % buttons.length;
            if (event.key === "Home") nextIndex = 0;
            if (event.key === "End") nextIndex = buttons.length - 1;
            const next = buttons[nextIndex];
            const nextMode = next?.dataset.discussionWorkspaceMode as WorkspaceMode | undefined;
            if (!next || !nextMode) return;
            activateWorkspace(mainColumn, nextMode);
            next.focus();
          };
          nav.append(button);
        }

        const opening = mainColumn.querySelector("#discussion-opening");
        opening?.insertAdjacentElement("afterend", nav);
      }

      if (!mainColumn.dataset.discussionWorkspaceMode) {
        activateWorkspace(mainColumn, "state");
      } else {
        activateWorkspace(mainColumn, mainColumn.dataset.discussionWorkspaceMode as WorkspaceMode);
      }
      return nav;
    }

    function ensureDiscoveryPanel(
      mainColumn: HTMLElement,
      id: string,
      eyebrow: string,
      title: string,
      description: string
    ) {
      let panel = mainColumn.querySelector<HTMLElement>(`#${id}`);
      if (!panel) {
        panel = document.createElement("section");
        panel.id = id;
        panel.className = "discussion-phase-four-panel";
        panel.setAttribute(GENERATED_ATTR, id);

        const heading = document.createElement("header");
        heading.className = "discussion-phase-four-panel-heading";
        const eyebrowElement = document.createElement("span");
        eyebrowElement.textContent = eyebrow;
        const titleElement = document.createElement("h2");
        titleElement.textContent = title;
        const descriptionElement = document.createElement("p");
        descriptionElement.textContent = description;
        heading.append(eyebrowElement, titleElement, descriptionElement);

        const list = document.createElement("div");
        list.className = "discussion-phase-four-list";
        panel.append(heading, list);

        const composer = mainColumn.querySelector(".discussion-v2-composer-card");
        composer?.insertAdjacentElement("beforebegin", panel);
      }
      return panel;
    }

    function renderPoints(panel: HTMLElement, wrappers: HTMLElement[]) {
      const list = panel.querySelector<HTMLElement>(".discussion-phase-four-list");
      if (!list) return;

      const points = wrappers
        .map((wrapper) => {
          const branch = wrapper.querySelector<HTMLButtonElement>(".discussion-thread-branch-button");
          const count = responseCount(branch);
          return {
            wrapper,
            branch,
            count,
            author: text(wrapper.querySelector(".discussion-v2-author-name")) || "Member",
            copy: compactCopy(text(wrapper.querySelector(".discussion-v2-reply-body"))),
          };
        })
        .filter((item) => item.branch && item.count > 0 && item.copy)
        .sort((a, b) => b.count - a.count)
        .slice(0, 12);

      list.replaceChildren();
      if (points.length === 0) {
        const empty = document.createElement("p");
        empty.className = "discussion-phase-four-empty";
        empty.textContent = "Points will appear here as responses develop their own conversations.";
        list.append(empty);
        return;
      }

      for (const point of points) {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "discussion-phase-four-discovery-card";
        card.onclick = () => point.branch?.click();

        const meta = document.createElement("span");
        meta.textContent = `${point.count.toLocaleString()} ${point.count === 1 ? "response" : "responses"} · ${point.author}`;
        const copy = document.createElement("strong");
        copy.textContent = point.copy;
        const action = document.createElement("small");
        action.textContent = "Open point thread";
        card.append(meta, copy, action);
        list.append(card);
      }
    }

    function renderEvidence(panel: HTMLElement, wrappers: HTMLElement[]) {
      const list = panel.querySelector<HTMLElement>(".discussion-phase-four-list");
      if (!list) return;

      const evidence = wrappers
        .map((wrapper) => {
          const reactionButton = Array.from(
            wrapper.querySelectorAll<HTMLButtonElement>(".discussion-v2-reaction-row button")
          ).find((button) => button.textContent?.toLowerCase().includes("evidence"));
          const countText = text(reactionButton?.querySelector("strong") ?? null);
          const count = Number(countText.replaceAll(",", "")) || 0;
          return {
            wrapper,
            count,
            author: text(wrapper.querySelector(".discussion-v2-author-name")) || "Member",
            copy: compactCopy(text(wrapper.querySelector(".discussion-v2-reply-body"))),
          };
        })
        .filter((item) => item.count > 0 && item.copy)
        .sort((a, b) => b.count - a.count)
        .slice(0, 12);

      list.replaceChildren();
      if (evidence.length === 0) {
        const empty = document.createElement("p");
        empty.className = "discussion-phase-four-empty";
        empty.textContent = "Responses receiving Evidence signals will be surfaced here as they appear.";
        list.append(empty);
        return;
      }

      for (const item of evidence) {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "discussion-phase-four-discovery-card";
        card.onclick = () => item.wrapper.scrollIntoView({ behavior: "smooth", block: "center" });

        const meta = document.createElement("span");
        meta.textContent = `${item.count.toLocaleString()} Evidence signal${item.count === 1 ? "" : "s"} · ${item.author}`;
        const copy = document.createElement("strong");
        copy.textContent = item.copy;
        const action = document.createElement("small");
        action.textContent = "View original response";
        card.append(meta, copy, action);
        list.append(card);
      }
    }

    function refresh() {
      if (cancelled) return;
      const mainColumn = document.querySelector<HTMLElement>(".discussion-v2-main-column");
      const replyList = document.querySelector<HTMLElement>(".discussion-v2-reply-list");
      if (!mainColumn) return;

      const composer = mainColumn.querySelector<HTMLElement>(".discussion-v2-composer-card");
      if (composer && !composer.id) composer.id = "discussion-reply-composer";

      ensureNavigation(mainColumn);
      const pointsPanel = ensureDiscoveryPanel(
        mainColumn,
        "discussion-major-points",
        "Points",
        "Conversations forming inside the conversation",
        "Responses that develop their own branches are surfaced here so important sub-conversations are easier to find."
      );
      const evidencePanel = ensureDiscoveryPanel(
        mainColumn,
        "discussion-evidence",
        "Evidence",
        "Responses members are asking others to substantiate",
        "Evidence signals surface the contributions that deserve closer sourcing and verification."
      );

      const wrappers = replyList
        ? Array.from(replyList.querySelectorAll<HTMLElement>(":scope > [id^='reply-']"))
        : [];
      renderPoints(pointsPanel, wrappers);
      renderEvidence(evidencePanel, wrappers);
    }

    function scheduleRefresh() {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        refresh();
      }, 120);
    }

    function handleExistingNavigation(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest<HTMLButtonElement>("button");
      if (!button) return;
      const label = button.textContent?.replace(/\s+/g, " ").trim().toLowerCase() ?? "";
      const mainColumn = document.querySelector<HTMLElement>(".discussion-v2-main-column");
      if (!mainColumn) return;

      const opensReply =
        label === "join the discussion" ||
        label === "add your reply" ||
        label === "write the first reply" ||
        (label === "reply" && Boolean(button.closest(".discussion-v2-mobile-bar")));

      if (opensReply) activateWorkspace(mainColumn, "reply");
      if (label === "state of discussion" && button.closest(".discussion-v2-section-nav")) {
        activateWorkspace(mainColumn, "state");
      }
    }

    const observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => Array.from(mutation.addedNodes).some((node) => {
        if (!(node instanceof Element)) return false;
        return node.matches("[id^='reply-']") || Boolean(node.querySelector("[id^='reply-']"));
      }))) {
        scheduleRefresh();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", handleExistingNavigation, true);
    window.addEventListener("loombus:discussion-metrics-changed", scheduleRefresh);
    window.addEventListener("loombus:discussion-reply-window-state", scheduleRefresh);
    refresh();

    return () => {
      cancelled = true;
      observer.disconnect();
      document.removeEventListener("click", handleExistingNavigation, true);
      window.removeEventListener("loombus:discussion-metrics-changed", scheduleRefresh);
      window.removeEventListener("loombus:discussion-reply-window-state", scheduleRefresh);
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      document.querySelectorAll(`[${GENERATED_ATTR}]`).forEach((node) => node.remove());
      document.querySelector<HTMLElement>(".discussion-v2-main-column")?.removeAttribute("data-discussion-workspace-mode");
    };
  }, []);

  return null;
}
