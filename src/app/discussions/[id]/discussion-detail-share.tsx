"use client";

import { Check, Link2, Share2 } from "lucide-react";
import { useEffect, useState } from "react";

type ShareState = "idle" | "working" | "copied" | "shared" | "error";

export default function DiscussionDetailShare() {
  const [state, setState] = useState<ShareState>("idle");
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    setCanNativeShare(typeof navigator.share === "function");
  }, []);

  useEffect(() => {
    if (state === "idle" || state === "working") return;
    const timeout = window.setTimeout(() => setState("idle"), 2400);
    return () => window.clearTimeout(timeout);
  }, [state]);

  async function shareDiscussion() {
    if (state === "working") return;

    const url = window.location.href;
    const title = document.title || "Loombus discussion";
    setState("working");

    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title, url });
        setState("shared");
        return;
      }

      await navigator.clipboard.writeText(url);
      setState("copied");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setState("idle");
        return;
      }

      try {
        await navigator.clipboard.writeText(url);
        setState("copied");
      } catch {
        setState("error");
      }
    }
  }

  const completed = state === "copied" || state === "shared";
  const workingLabel = canNativeShare ? "Opening share..." : "Copying link...";

  return (
    <div className="discussion-detail-share-control" aria-live="polite">
      <button
        type="button"
        onClick={shareDiscussion}
        disabled={state === "working"}
        aria-label={canNativeShare ? "Share this discussion" : "Copy this discussion link"}
      >
        {completed ? (
          <Check aria-hidden="true" />
        ) : canNativeShare ? (
          <Share2 aria-hidden="true" />
        ) : (
          <Link2 aria-hidden="true" />
        )}
        <span>
          {state === "working"
            ? workingLabel
            : state === "copied"
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
