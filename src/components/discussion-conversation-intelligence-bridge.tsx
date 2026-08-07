"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useParams } from "next/navigation";
import { DiscussionConversationIntelligence } from "@/components/discussion-conversation-intelligence";

export function DiscussionConversationIntelligenceBridge() {
  const params = useParams();
  const discussionId = String(params.id ?? "");
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!discussionId) return;
    let cancelled = false;
    let timer: number | null = null;

    const findHost = () => {
      if (cancelled) return;
      const intelligence = document.querySelector<HTMLElement>("#discussion-intelligence");
      if (intelligence) {
        let container = intelligence.parentElement?.querySelector<HTMLElement>(":scope > [data-phase-five-intelligence-host='true']") ?? null;
        if (!container) {
          container = document.createElement("div");
          container.dataset.phaseFiveIntelligenceHost = "true";
          intelligence.insertAdjacentElement("afterend", container);
        }
        setHost(container);
        return;
      }
      timer = window.setTimeout(findHost, 80);
    };

    findHost();
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
      document.querySelector("[data-phase-five-intelligence-host='true']")?.remove();
    };
  }, [discussionId]);

  return host ? createPortal(<DiscussionConversationIntelligence discussionId={discussionId} />, host) : null;
}
