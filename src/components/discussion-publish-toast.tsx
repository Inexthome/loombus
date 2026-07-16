"use client";

import { CheckCircle2, X } from "lucide-react";
import { useEffect, useState } from "react";

const DISCUSSION_PUBLISH_NOTICE_KEY = "loombus:discussion-publish-notice";

export function DiscussionPublishToast() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    const storedMessage = window.sessionStorage.getItem(
      DISCUSSION_PUBLISH_NOTICE_KEY
    );

    if (!storedMessage) return;

    window.sessionStorage.removeItem(DISCUSSION_PUBLISH_NOTICE_KEY);
    setMessage(storedMessage);

    const timerId = window.setTimeout(() => setMessage(""), 5000);
    return () => window.clearTimeout(timerId);
  }, []);

  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+1rem)] z-[120] flex w-[min(92vw,38rem)] -translate-x-1/2 items-start gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold leading-6 text-emerald-950 shadow-2xl shadow-black/20 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100"
    >
      <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
      <span className="min-w-0 flex-1">{message}</span>
      <button
        type="button"
        onClick={() => setMessage("")}
        aria-label="Dismiss publish confirmation"
        className="rounded-full p-1 transition hover:bg-emerald-200/70 focus:outline-none focus:ring-2 focus:ring-emerald-700 dark:hover:bg-emerald-900"
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  );
}
