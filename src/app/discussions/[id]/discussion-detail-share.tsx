"use client";

import { Check, Link2, Share2 } from "lucide-react";
import { useEffect, useState } from "react";

export default function DiscussionDetailShare() {
  const [state, setState] = useState<"idle" | "copied" | "shared" | "error">("idle");
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    setCanNativeShare(typeof navigator.share === "function");
  }, []);

  useEffect(() => {
    if (state === "idle") return;
    const timeout = window.setTimeout(() => setState("idle"), 2400);
    return () => window.clearTimeout(timeout);
  }, [state]);

  async function shareDiscussion() {
    const url = window.location.href;
    const title = document.title || "Loombus discussion";

    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title, url });
        setState("shared");
        return;
      }

      await navigator.clipboard.writeText(url);
      setState("copied");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;

      try {
        await navigator.clipboard.writeText(url);
        setState("copied");
      } catch {
        setState("error");
      }
    }
  }

  const completed = state === "copied" || state === "shared";

  return (
    <div className="discussion-detail-share-control" aria-live="polite">
      <button type="button" onClick={shareDiscussion}>
        {completed ? (
          <Check aria-hidden="true" />
        ) : canNativeShare ? (
          <Share2 aria-hidden="true" />
        ) : (
          <Link2 aria-hidden="true" />
        )}
        <span>
          {state === "copied"
            ? "Link copied"
            : state === "shared"
              ? "Shared"
              : state === "error"
                ? "Copy unavailable"
                : "Share discussion"}
        </span>
      </button>
    </div>
  );
}
