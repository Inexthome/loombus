"use client";

import { useEffect } from "react";

export function CreateReviewMobileContrast() {
  useEffect(() => {
    if (!window.matchMedia("(max-width:767px)").matches) return;

    const style = document.createElement("style");
    style.textContent = `
      @media (max-width:767px){
        [data-create-review-copy="true"]{
          background:#CBAB5B!important;
          color:#17140c!important;
          border-color:#CBAB5B!important;
          opacity:1!important;
        }
        [data-create-review-copy="true"] svg{
          color:#17140c!important;
        }
        [data-create-review-copy="true"]:disabled{
          background:color-mix(in srgb,#CBAB5B 62%,var(--loombus-surface-muted))!important;
          color:#17140c!important;
          opacity:.78!important;
        }
      }
    `;
    document.head.append(style);

    let stopped = false;
    let timer = 0;
    let copyButton: HTMLButtonElement | null = null;

    const locate = () => {
      if (stopped) return;
      copyButton = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
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
