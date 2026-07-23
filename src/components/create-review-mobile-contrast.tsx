"use client";

import { useEffect } from "react";

export function CreateReviewMobileContrast() {
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      [data-create-review-copy="true"] {
        background: #CBAB5B !important;
        background-color: #CBAB5B !important;
        border-color: #CBAB5B !important;
        color: #17140c !important;
        -webkit-text-fill-color: #17140c !important;
        color-scheme: light !important;
        opacity: 1 !important;
      }

      [data-create-review-copy="true"] *,
      [data-create-review-copy="true"] svg {
        color: #17140c !important;
        -webkit-text-fill-color: #17140c !important;
        opacity: 1 !important;
      }

      [data-create-review-copy="true"]:disabled {
        background: color-mix(in srgb, #CBAB5B 72%, var(--loombus-surface-muted)) !important;
        background-color: color-mix(in srgb, #CBAB5B 72%, var(--loombus-surface-muted)) !important;
        border-color: color-mix(in srgb, #CBAB5B 72%, var(--loombus-border)) !important;
        color: #17140c !important;
        -webkit-text-fill-color: #17140c !important;
        opacity: 0.82 !important;
      }
    `;
    document.head.append(style);

    let stopped = false;
    let timer = 0;
    let copyButton: HTMLButtonElement | null = null;

    const locate = () => {
      if (stopped) return;

      copyButton =
        Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
          (button) => button.textContent?.includes("Copy review draft")
        ) ?? null;

      if (!copyButton) {
        timer = window.setTimeout(locate, 120);
        return;
      }

      copyButton.dataset.createReviewCopy = "true";
    };

    locate();

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      if (copyButton) delete copyButton.dataset.createReviewCopy;
      style.remove();
    };
  }, []);

  return null;
}
