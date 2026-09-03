"use client";

import { useEffect } from "react";

const PANEL_SELECTOR = '[data-discussions-engagement-mount="true"]';
const WRAPPER_ATTR = "data-discussions-engagement-compact";

function countMeaningfulLinks(panel: HTMLElement) {
  return panel.querySelectorAll<HTMLAnchorElement>('a[href^="/discussions/"]').length;
}

function getSummaryText(panel: HTMLElement) {
  const linkCount = countMeaningfulLinks(panel);

  if (linkCount > 0) {
    return `${linkCount} ${linkCount === 1 ? "update" : "updates"} worth revisiting`;
  }

  const text = panel.textContent ?? "";
  if (text.includes("Preparing your discussion updates")) {
    return "Checking for meaningful updates…";
  }
  if (text.includes("establishes your baseline")) {
    return "Your update baseline is ready";
  }

  return "You’re caught up";
}

export function DiscussionsEngagementLayoutBridge() {
  useEffect(() => {
    let observer: MutationObserver | null = null;
    let wrapper: HTMLDetailsElement | null = null;
    let summaryStatus: HTMLSpanElement | null = null;
    let panel: HTMLElement | null = null;

    function refreshSummary() {
      if (!panel || !summaryStatus || !wrapper) return;

      const linkCount = countMeaningfulLinks(panel);
      summaryStatus.textContent = getSummaryText(panel);
      wrapper.dataset.hasUpdates = linkCount > 0 ? "true" : "false";

      if (linkCount === 0) {
        wrapper.open = false;
      }
    }

    function install() {
      panel = document.querySelector<HTMLElement>(PANEL_SELECTOR);
      if (!panel?.parentElement) return false;

      if (panel.closest(`[${WRAPPER_ATTR}="true"]`)) {
        wrapper = panel.closest<HTMLDetailsElement>(`[${WRAPPER_ATTR}="true"]`);
        summaryStatus = wrapper?.querySelector<HTMLSpanElement>(
          '[data-discussions-engagement-summary-status="true"]'
        ) ?? null;
        refreshSummary();
        return true;
      }

      wrapper = document.createElement("details");
      wrapper.setAttribute(WRAPPER_ATTR, "true");
      wrapper.className =
        "group mb-5 border-y border-[color:var(--loombus-border)] bg-transparent";

      const summary = document.createElement("summary");
      summary.className =
        "flex min-h-12 cursor-pointer list-none items-center gap-3 py-3 text-sm text-[color:var(--loombus-text)] marker:hidden [&::-webkit-details-marker]:hidden";
      summary.innerHTML = `
        <span class="font-semibold tracking-[-0.01em]">Your updates</span>
        <span data-discussions-engagement-summary-status="true" class="min-w-0 flex-1 truncate text-right text-xs font-medium text-[color:var(--loombus-text-muted)]"></span>
        <span aria-hidden="true" class="text-xs text-[#CBAB5B] transition-transform group-open:rotate-180">⌄</span>
      `;

      summaryStatus = summary.querySelector<HTMLSpanElement>(
        '[data-discussions-engagement-summary-status="true"]'
      );

      const originalParent = panel.parentElement;
      originalParent.insertBefore(wrapper, panel);
      wrapper.append(summary, panel);

      panel.classList.remove("mb-6");
      panel.classList.add("pb-4");

      summary.addEventListener("click", (event) => {
        if (wrapper?.dataset.hasUpdates !== "true") {
          event.preventDefault();
          if (wrapper) wrapper.open = false;
        }
      });

      refreshSummary();
      return true;
    }

    function observePanel() {
      if (!panel) return;
      observer?.disconnect();
      observer = new MutationObserver(refreshSummary);
      observer.observe(panel, { childList: true, subtree: true, characterData: true });
    }

    if (install()) {
      observePanel();
    } else {
      observer = new MutationObserver(() => {
        if (install()) {
          observePanel();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      observer?.disconnect();
      if (wrapper && panel && wrapper.parentElement) {
        wrapper.parentElement.insertBefore(panel, wrapper);
        wrapper.remove();
      }
    };
  }, []);

  return null;
}
