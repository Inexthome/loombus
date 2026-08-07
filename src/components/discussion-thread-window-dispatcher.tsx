"use client";

import { useParams } from "next/navigation";
import { useEffect } from "react";
import { requestDiscussionThreadWindow } from "@/lib/discussion-reply-window";

const THREAD_TARGET_SELECTORS = [
  "[data-loombus-open-thread]",
  "[data-loombus-thread-crumb]",
  "[data-loombus-thread-parent]",
] as const;

function getRequestedReplyId(target: Element) {
  const open = target.closest<HTMLElement>(THREAD_TARGET_SELECTORS[0]);
  if (open) return open.getAttribute("data-loombus-open-thread");

  const crumb = target.closest<HTMLElement>(THREAD_TARGET_SELECTORS[1]);
  if (crumb) return crumb.dataset.loombusThreadCrumb ?? null;

  const parent = target.closest<HTMLElement>(THREAD_TARGET_SELECTORS[2]);
  if (parent) return parent.dataset.loombusThreadParent ?? null;

  return null;
}

export function DiscussionThreadWindowDispatcher() {
  const params = useParams();
  const discussionId = String(params.id ?? "");

  useEffect(() => {
    if (!discussionId) return;

    const handleClick = (event: Event) => {
      const target = event.target as Element | null;
      if (!target) return;
      const parentReplyId = getRequestedReplyId(target);
      if (!parentReplyId) return;
      requestDiscussionThreadWindow({ discussionId, parentReplyId });
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [discussionId]);

  return null;
}
