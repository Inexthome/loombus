"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type EngagementMode = "for_you" | "active" | null;

const MODE_REQUEST_EVENT = "loombus:discussion-engagement-mode-request";
const MODE_STATE_EVENT = "loombus:discussion-engagement-mode-state";

function ForYouWeaveIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="discussion-engagement-weave-icon">
      <path d="M5 7.5 16.5 19M8 4.5 19.5 16M4.5 16 16 4.5M7.5 19 19 7.5" />
      <path d="M4.75 10.5 13.5 19.25M10.5 4.75 19.25 13.5" opacity=".78" />
    </svg>
  );
}

function ActiveWeaveIcon() {
  return (
    <svg viewBox="0 0 30 24" aria-hidden="true" className="discussion-engagement-weave-icon is-active-weave">
      <path d="M4 7.5 15.5 19M7 4.5 18.5 16M3.5 16 15 4.5M6.5 19 18 7.5" />
      <path d="M17.2 13.4c2.2 0 2.1-2.3 4.1-2.3 1.9 0 1.7 4.1 3.6 4.1 1.2 0 1.5-1.4 2.6-1.4" />
    </svg>
  );
}

export function DiscussionEngagementModeControl() {
  const pathname = usePathname();
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [mode, setMode] = useState<EngagementMode>("for_you");

  useEffect(() => {
    if (pathname !== "/discussions") {
      setHost(null);
      return;
    }

    let cancelled = false;
    let timer = 0;
    let mount: HTMLDivElement | null = null;

    function locateFilter() {
      if (cancelled) return;
      const filterSlot = document.querySelector<HTMLElement>('[data-discussions-filter-slot="true"]');
      if (!filterSlot) {
        timer = window.setTimeout(locateFilter, 100);
        return;
      }

      mount = document.createElement("div");
      mount.dataset.discussionEngagementModeControl = "true";
      // Keep Filter, For You, and Active in one flex formatting context so their
      // icon centers and underline baselines cannot drift independently.
      filterSlot.append(mount);
      setHost(mount);
    }

    locateFilter();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      setHost(null);
      mount?.remove();
    };
  }, [pathname]);

  useEffect(() => {
    const handler = (event: Event) => {
      const next = (event as CustomEvent<{ mode?: EngagementMode }>).detail?.mode;
      setMode(next === "for_you" || next === "active" ? next : null);
    };
    window.addEventListener(MODE_STATE_EVENT, handler);
    return () => window.removeEventListener(MODE_STATE_EVENT, handler);
  }, []);

  function selectMode(nextMode: Exclude<EngagementMode, null>) {
    window.dispatchEvent(new CustomEvent(MODE_REQUEST_EVENT, { detail: { mode: nextMode } }));
  }

  if (pathname !== "/discussions" || !host) return null;

  return createPortal(
    <div className="discussion-engagement-mode-control" aria-label="Discussion feed modes">
      <button
        type="button"
        className="discussion-engagement-mode-button"
        data-selected={mode === "for_you" ? "true" : "false"}
        aria-pressed={mode === "for_you"}
        aria-label="For You discussions"
        title="For You — discussions selected from the people, topics, and conversations relevant to you."
        onClick={() => selectMode("for_you")}
      >
        <ForYouWeaveIcon />
      </button>
      <button
        type="button"
        className="discussion-engagement-mode-button"
        data-selected={mode === "active" ? "true" : "false"}
        aria-pressed={mode === "active"}
        aria-label="Active discussions"
        title="Active — discussions with meaningful recent movement."
        onClick={() => selectMode("active")}
      >
        <ActiveWeaveIcon />
      </button>
    </div>,
    host
  );
}
