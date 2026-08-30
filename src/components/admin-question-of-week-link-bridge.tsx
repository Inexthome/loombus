"use client";

import { useEffect } from "react";
import { Sparkles, ChevronRight } from "lucide-react";
import { createRoot, type Root } from "react-dom/client";
import Link from "next/link";

function AdminQuestionOfWeekRow() {
  return (
    <Link href="/admin/question-of-the-week" className="admin-ops-module-row">
      <span className="admin-ops-module-icon"><Sparkles aria-hidden="true" /></span>
      <span className="admin-ops-module-copy">
        <strong>Question of the Week</strong>
        <span>Review sources, generate candidates, replace the current question, or select an existing public discussion.</span>
      </span>
      <ChevronRight className="admin-ops-row-chevron" aria-hidden="true" />
    </Link>
  );
}

export function AdminQuestionOfWeekLinkBridge() {
  useEffect(() => {
    let mount: HTMLDivElement | null = null;
    let root: Root | null = null;
    let observer: MutationObserver | null = null;

    function ensureMounted() {
      if (mount?.isConnected) return true;
      const headings = Array.from(document.querySelectorAll<HTMLElement>(".admin-ops-directory-heading h2"));
      const publishingHeading = headings.find((heading) => heading.textContent?.trim() === "Knowledge & publishing");
      const section = publishingHeading?.closest(".admin-ops-directory-section");
      const list = section?.querySelector<HTMLElement>(".admin-ops-module-list");
      if (!list) return false;
      const existing = list.querySelector<HTMLDivElement>('[data-admin-question-week-link="true"]');
      if (existing) {
        mount = existing;
        return true;
      }
      mount = document.createElement("div");
      mount.dataset.adminQuestionWeekLink = "true";
      list.appendChild(mount);
      root = createRoot(mount);
      root.render(<AdminQuestionOfWeekRow />);
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
      root?.unmount();
      mount?.remove();
    };
  }, []);

  return null;
}
