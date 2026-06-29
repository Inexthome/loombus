"use client";

import { useEffect } from "react";

const GOLD = "#d6a84f";
const GOLD_LIGHT = "#fde68a";

export default function ReviewPublicPolish() {
  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;

    const headerLink = main.querySelector<HTMLAnchorElement>('header a[href="/v2/create"]');
    if (headerLink) headerLink.style.color = GOLD;

    const eyebrow = Array.from(main.querySelectorAll<HTMLElement>("header p")).find((element) => /loombus review/i.test(element.textContent ?? ""));
    if (eyebrow) eyebrow.style.color = GOLD;

    for (const span of Array.from(main.querySelectorAll<HTMLElement>("span"))) {
      if (span.textContent?.trim() === "Purpose:") {
        span.style.color = GOLD_LIGHT;
        span.style.fontWeight = "900";
      }
    }
  }, []);

  return null;
}
