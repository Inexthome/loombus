"use client";

import { useEffect } from "react";

const CORRECTION_CSS = String.raw`
@media (max-width:767px){
  [data-mc-sheet-header="true"]{
    height:min(78dvh,44rem)!important;
    pointer-events:none!important;
  }
  [data-mc-sheet-header="true"]>div{
    position:absolute!important;
    inset-inline:0!important;
    top:0!important;
    z-index:2!important;
    pointer-events:auto!important;
    min-height:4.7rem!important;
    background:var(--loombus-surface-strong)!important;
    color:var(--loombus-text)!important;
  }
  [data-mc-sheet-header="true"][data-panel="attachments"]>div{
    justify-content:flex-end!important;
    border:0!important;
    background:transparent!important;
  }
  [data-mc-sheet-header="true"][data-panel="attachments"] strong{
    display:none!important;
  }
  [data-mc-sheet-header="true"] button{
    color:var(--loombus-text-muted)!important;
    opacity:1!important;
  }
  main[data-mobile-create][data-mc-panel="guidance"] [data-mc-role="guidance"]{
    max-height:min(72dvh,40rem)!important;
    padding-top:5.4rem!important;
    padding-bottom:calc(1.5rem + env(safe-area-inset-bottom))!important;
    color:var(--loombus-text)!important;
  }
  main[data-mobile-create][data-mc-panel="guidance"] [data-mc-role="guidance"] *{
    opacity:1!important;
  }
  main[data-mobile-create][data-mc-panel="guidance"] [data-mc-role="guidance"] p,
  main[data-mobile-create][data-mc-panel="guidance"] [data-mc-role="guidance"] span,
  main[data-mobile-create][data-mc-panel="guidance"] [data-mc-role="guidance"] strong{
    color:var(--loombus-text)!important;
  }
  main[data-mobile-create][data-mc-panel="guidance"] [data-mc-role="guidance"] button{
    display:flex!important;
    width:100%!important;
    min-height:3.25rem!important;
    align-items:center!important;
    justify-content:center!important;
    border:1px solid var(--loombus-border)!important;
    background:var(--loombus-surface-strong)!important;
    color:var(--loombus-text)!important;
    opacity:1!important;
  }
  main[data-mobile-create][data-mc-panel="guidance"] [data-mc-role="guidance"] button+button{
    margin-top:.75rem!important;
  }
  [data-mc-more-sheet="true"]{
    max-height:min(82dvh,46rem)!important;
    padding-top:5.5rem!important;
    padding-bottom:calc(5.5rem + env(safe-area-inset-bottom))!important;
    overflow-y:auto!important;
    overscroll-behavior:contain!important;
    -webkit-overflow-scrolling:touch!important;
  }
  [data-mc-more-sheet="true"] button{
    flex:none!important;
    min-height:3.35rem!important;
    color:var(--loombus-text)!important;
    opacity:1!important;
  }
  [data-mc-more-sheet="true"] button:last-child{
    background:#CBAB5B!important;
    color:#17140c!important;
    margin-bottom:1rem!important;
  }
  main[data-mobile-create] [data-mc-role="body"]{
    position:relative!important;
  }
  [data-mc-body-guidance="true"]{
    position:absolute!important;
    right:1rem!important;
    bottom:3.6rem!important;
    z-index:3!important;
    display:grid!important;
    width:3.25rem!important;
    height:3.25rem!important;
    place-items:center!important;
    border:1px solid color-mix(in srgb,#CBAB5B 55%,var(--loombus-border))!important;
    border-radius:999px!important;
    background:var(--loombus-surface-strong)!important;
    color:#CBAB5B!important;
    box-shadow:0 .75rem 2rem rgb(0 0 0/.16)!important;
  }
  [data-create-review-copy="true"]{
    background:#CBAB5B!important;
    color:#17140c!important;
    border-color:#CBAB5B!important;
    opacity:1!important;
  }
  [data-create-review-copy="true"] svg,
  [data-create-review-copy="true"] span{
    color:#17140c!important;
  }
  [data-create-review-copy="true"]:disabled{
    background:color-mix(in srgb,#CBAB5B 58%,var(--loombus-surface-muted))!important;
    color:#17140c!important;
    opacity:.72!important;
  }
}
`;

function buttonByText(root: ParentNode, value: string) {
  return Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find(
    (button) => button.textContent?.trim() === value
  );
}

export function CreateMobileV2Corrections() {
  useEffect(() => {
    const media = window.matchMedia("(max-width:767px)");
    if (!media.matches) return;

    const style = document.createElement("style");
    style.dataset.mcCorrection = "true";
    style.textContent = CORRECTION_CSS;
    document.head.append(style);

    let cancelled = false;
    let timer = 0;
    let root: HTMLElement | null = null;
    let aiButton: HTMLButtonElement | null = null;

    const syncPanelChrome = () => {
      if (!root) return;
      const close = buttonByText(document, "×");
      const sheetHeader = close?.parentElement?.parentElement;
      if (sheetHeader instanceof HTMLElement) {
        sheetHeader.dataset.mcSheetHeader = "true";
        sheetHeader.dataset.panel = root.dataset.mcPanel ?? "";
      }

      const showTags = buttonByText(document, "Show tags");
      const moreSheet = showTags?.closest("section");
      if (moreSheet instanceof HTMLElement) {
        moreSheet.dataset.mcMoreSheet = "true";
      }
    };

    const locate = () => {
      if (cancelled) return;
      root = Array.from(document.querySelectorAll<HTMLElement>("main")).find(
        (main) => main.dataset.mobileCreate === "true"
      ) ?? null;

      if (!root) {
        timer = window.setTimeout(locate, 120);
        return;
      }

      const body = root.querySelector<HTMLElement>('[data-mc-role="body"]');
      if (body && !body.querySelector('[data-mc-body-guidance="true"]')) {
        aiButton = document.createElement("button");
        aiButton.type = "button";
        aiButton.dataset.mcBodyGuidance = "true";
        aiButton.ariaLabel = "Open Draft Guidance";
        aiButton.innerHTML = "✦";
        aiButton.addEventListener("click", () => {
          const guidance = buttonByText(document, "Guidance");
          guidance?.click();
          window.setTimeout(syncPanelChrome, 0);
        });
        body.append(aiButton);
      }

      const reviewCopy = Array.from(
        document.querySelectorAll<HTMLButtonElement>("button")
      ).find((button) => button.textContent?.includes("Copy review draft"));
      if (reviewCopy) reviewCopy.dataset.createReviewCopy = "true";

      document.addEventListener("click", syncPanelChrome, true);
      syncPanelChrome();
    };

    locate();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener("click", syncPanelChrome, true);
      aiButton?.remove();
      style.remove();
    };
  }, []);

  return null;
}
