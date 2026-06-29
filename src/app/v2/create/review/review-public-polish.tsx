"use client";

import { useEffect } from "react";

const GOLD = "#d6a84f";
const PURPOSE_TEXT = "#78350f";

function applyReviewPolish() {
  const main = document.querySelector("main");
  if (!main) return;

  const headerLink = main.querySelector<HTMLAnchorElement>('header a[href="/v2/create"]');
  if (headerLink) {
    headerLink.style.setProperty("color", GOLD, "important");
    headerLink.style.setProperty("font-weight", "900", "important");
  }

  const eyebrow = Array.from(main.querySelectorAll<HTMLElement>("header p")).find((element) => /loombus review/i.test(element.textContent ?? ""));
  if (eyebrow) {
    eyebrow.style.setProperty("color", GOLD, "important");
    eyebrow.style.setProperty("font-weight", "900", "important");
  }

  for (const span of Array.from(main.querySelectorAll<HTMLElement>("span"))) {
    if (span.textContent?.trim() === "Purpose:") {
      span.style.setProperty("color", PURPOSE_TEXT, "important");
      span.style.setProperty("font-weight", "900", "important");
      const container = span.closest("div") as HTMLElement | null;
      container?.style.setProperty("color", PURPOSE_TEXT, "important");
    }
  }
}

export default function ReviewPublicPolish() {
  useEffect(() => {
    applyReviewPolish();
    const observer = new MutationObserver(applyReviewPolish);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
