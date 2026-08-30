"use client";

import { useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QuestionOfTheWeekRail } from "@/components/question-of-the-week-rail";

const DESKTOP_QUERY = "(min-width: 1280px)";

function findDiscussionsFeedRoot() {
  return Array.from(
    document.querySelectorAll<HTMLElement>(".discussion-feed-route main")
  ).find(
    (main) => main.querySelector("h1")?.textContent?.trim() === "Discussions"
  );
}

function findHeadingBlock(root: HTMLElement) {
  const heading = Array.from(root.querySelectorAll<HTMLHeadingElement>("h1")).find(
    (candidate) => candidate.textContent?.trim() === "Discussions"
  );
  return heading?.parentElement ?? null;
}

export function QuestionOfTheWeekBridge() {
  useEffect(() => {
    let reactRoot: Root | null = null;
    let mount: HTMLDivElement | null = null;
    let observer: MutationObserver | null = null;
    const desktopQuery = window.matchMedia(DESKTOP_QUERY);

    function removeMount() {
      observer?.disconnect();
      observer = null;
      reactRoot?.unmount();
      reactRoot = null;
      mount?.remove();
      mount = null;
    }

    function ensureMounted() {
      if (desktopQuery.matches) {
        removeMount();
        return true;
      }

      if (mount?.isConnected) return true;

      const feedRoot = findDiscussionsFeedRoot();
      if (!feedRoot) return false;
      const headingBlock = findHeadingBlock(feedRoot);
      if (!headingBlock?.parentElement) return false;

      const existing = feedRoot.querySelector<HTMLDivElement>(
        '[data-question-of-the-week-mount="true"]'
      );
      if (existing) {
        mount = existing;
        return true;
      }

      mount = document.createElement("div");
      mount.dataset.questionOfTheWeekMount = "true";
      mount.className = "mb-6";
      headingBlock.insertAdjacentElement("afterend", mount);
      reactRoot = createRoot(mount);
      reactRoot.render(<QuestionOfTheWeekRail />);
      return true;
    }

    function watchForMountTarget() {
      if (desktopQuery.matches || ensureMounted() || observer) return;

      observer = new MutationObserver(() => {
        if (ensureMounted()) {
          observer?.disconnect();
          observer = null;
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    function syncForViewport() {
      if (desktopQuery.matches) {
        removeMount();
        return;
      }

      watchForMountTarget();
    }

    syncForViewport();
    desktopQuery.addEventListener("change", syncForViewport);

    return () => {
      desktopQuery.removeEventListener("change", syncForViewport);
      removeMount();
    };
  }, []);

  return null;
}
