"use client";

import { useEffect } from "react";

const MOBILE_REPLY_LABEL = "Reply";
const MOBILE_JOIN_LABEL = "Join the discussion";

function updateMobileReplyLabel() {
  document
    .querySelectorAll<HTMLButtonElement>(".discussion-v2-mobile-bar button")
    .forEach((button) => {
      if (button.textContent?.replace(/\s+/g, " ").trim() === MOBILE_JOIN_LABEL) {
        button.textContent = MOBILE_REPLY_LABEL;
      }
    });
}

export function DiscussionMobileReplyLabel() {
  useEffect(() => {
    let scheduled = false;

    const apply = () => {
      scheduled = false;
      updateMobileReplyLabel();
    };

    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(apply);
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    schedule();

    return () => observer.disconnect();
  }, []);

  return null;
}
