"use client";

import { useEffect } from "react";

const MOBILE_QUERY = "(max-width: 63.99rem)";
const MOBILE_REPLY_LABEL = "Reply";
const DESKTOP_JOIN_LABEL = "Join the discussion";

function normalize(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function updateOpeningReplyLabel(isMobile: boolean) {
  const button = document.querySelector<HTMLButtonElement>(
    ".discussion-v2-opening-actions > button.discussion-v2-button-primary"
  );
  if (!button) return;

  const textNode = Array.from(button.childNodes).find(
    (node) =>
      node.nodeType === Node.TEXT_NODE &&
      [DESKTOP_JOIN_LABEL, MOBILE_REPLY_LABEL].includes(normalize(node.textContent))
  );
  if (!textNode) return;

  const nextLabel = isMobile ? MOBILE_REPLY_LABEL : DESKTOP_JOIN_LABEL;
  if (normalize(textNode.textContent) !== nextLabel) {
    textNode.textContent = nextLabel;
  }
}

export function DiscussionMobileReplyLabel() {
  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);
    let scheduled = false;

    const apply = () => {
      scheduled = false;
      updateOpeningReplyLabel(media.matches);
    };

    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(apply);
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    media.addEventListener("change", schedule);
    schedule();

    return () => {
      observer.disconnect();
      media.removeEventListener("change", schedule);
      updateOpeningReplyLabel(false);
    };
  }, []);

  return null;
}
