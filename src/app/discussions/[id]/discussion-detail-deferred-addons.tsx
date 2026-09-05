"use client";

import { useEffect, useState } from "react";
import { DiscussionViewersPanel } from "@/components/discussion-viewers-panel";

export default function DiscussionDetailDeferredAddons() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | null = null;
    let idleId: number | null = null;

    const reveal = () => {
      if (!cancelled) setReady(true);
    };

    if ("requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(reveal, { timeout: 700 });
    } else {
      timeoutId = window.setTimeout(reveal, 250);
    }

    return () => {
      cancelled = true;
      if (idleId !== null && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, []);

  if (!ready) return null;
  return <DiscussionViewersPanel />;
}
