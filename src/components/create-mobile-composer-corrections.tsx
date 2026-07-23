"use client";

import { useEffect } from "react";

const CORRECTION_CSS = String.raw`
@media (max-width:767px){
  main[data-mobile-create]{padding-bottom:2rem!important}

  main[data-mobile-create] [data-mc-role="title"]>span:first-child{
    display:block!important;
    margin-bottom:.65rem!important;
    color:var(--loombus-text)!important;
    font-size:.92rem!important;
    font-weight:850!important;
    line-height:1.2!important;
  }
  main[data-mobile-create] [data-mc-role="title"]>p{
    display:block!important;
    margin-top:.6rem!important;
    color:var(--loombus-text-muted)!important;
    font-size:.78rem!important;
    line-height:1.35!important;
  }
  main[data-mobile-create] [data-mc-role="title"] input{
    min-height:3.2rem!important;
    border:1px solid var(--loombus-border)!important;
    border-radius:1rem!important;
    background:color-mix(in srgb,var(--loombus-surface-strong) 88%,#FEFBEC)!important;
    padding:.8rem .9rem!important;
    font-size:1rem!important;
    font-weight:700!important;
  }

  main[data-mobile-create] [data-mc-role="purpose"] .text-red-500{display:inline!important}
  main[data-mobile-create] [data-mc-role="purpose"]>span:first-child:after{content:""!important}

  main[data-mobile-create][data-mc-panel="attachments"] [data-mc-role="attachments"]>p{
    display:none!important;
  }

  [data-mc-sheet-header="true"]{
    height:min(78dvh,44rem)!important;
    pointer-events:none!important;
  }
  [data-mc-sheet-header="true"]>div{
    position:absolute!important;
    inset-inline:0!important;
    top:0!important;
    z-index:4!important;
    min-height:4.7rem!important;
    pointer-events:auto!important;
    background:var(--loombus-surface-strong)!important;
    color:var(--loombus-text)!important;
  }
  [data-mc-sheet-header="true"] strong{
    color:var(--loombus-text)!important;
    opacity:1!important;
  }
  [data-mc-sheet-header="true"] button{
    pointer-events:auto!important;
    border:1px solid var(--loombus-border)!important;
    background:var(--loombus-surface-strong)!important;
    color:var(--loombus-text)!important;
    opacity:1!important;
    box-shadow:0 .5rem 1.5rem rgb(0 0 0/.12)!important;
  }
  [data-mc-sheet-header="true"][data-panel="attachments"]>div{
    justify-content:flex-end!important;
    border:0!important;
    background:transparent!important;
    padding:1rem!important;
  }
  [data-mc-sheet-header="true"][data-panel="attachments"] strong{display:none!important}

  [data-mc-footer-inline="true"]{
    position:static!important;
    inset:auto!important;
    z-index:auto!important;
    width:auto!important;
    margin:1rem!important;
    border:1px solid var(--loombus-border)!important;
    border-radius:1.5rem!important;
    background:var(--loombus-surface)!important;
    padding:.65rem!important;
    backdrop-filter:none!important;
    box-shadow:0 .9rem 2.4rem rgb(0 0 0/.08)!important;
  }
  [data-mc-footer-inline="true"]>div{width:100%!important}

  main[data-mobile-create] [data-mc-role="body"]{position:relative!important}
  [data-mc-body-guidance="true"]{
    position:absolute!important;
    right:1rem!important;
    bottom:3.6rem!important;
    z-index:5!important;
    display:grid!important;
    width:3.25rem!important;
    height:3.25rem!important;
    place-items:center!important;
    border:1px solid color-mix(in srgb,#CBAB5B 58%,var(--loombus-border))!important;
    border-radius:999px!important;
    background:var(--loombus-surface-strong)!important;
    color:#CBAB5B!important;
    font-size:1.5rem!important;
    line-height:1!important;
    box-shadow:0 .75rem 2rem rgb(0 0 0/.16)!important;
  }

  main[data-mobile-create][data-mc-panel="guidance"] [data-mc-role="guidance"]{
    max-height:min(72dvh,40rem)!important;
    padding-top:5.4rem!important;
    padding-bottom:calc(1.5rem + env(safe-area-inset-bottom))!important;
    color:var(--loombus-text)!important;
    overflow-y:auto!important;
    overscroll-behavior:contain!important;
    -webkit-overflow-scrolling:touch!important;
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
    display:flex!important;
    background:#CBAB5B!important;
    color:#17140c!important;
    margin-bottom:1rem!important;
  }
}
`;

function findCreateRoot() {
  return document.querySelector<HTMLElement>('main[data-mobile-create="true"]');
}

function findComposerCard(root: HTMLElement) {
  return root.querySelector<HTMLElement>(
    "form > div:first-child > section:first-of-type"
  );
}

function buttonByText(root: ParentNode, value: string) {
  return Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find(
    (button) => button.textContent?.trim() === value
  );
}

function findFooter() {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-mc-ui]")).find(
    (element) => {
      const labels = Array.from(element.querySelectorAll("button")).map((button) =>
        button.textContent?.trim()
      );
      return (
        labels.includes("Guidance") &&
        labels.includes("More") &&
        labels.includes("Review")
      );
    }
  );
}

function findSheetHeader() {
  const close = buttonByText(document, "×");
  const candidate = close?.parentElement?.parentElement;
  return candidate instanceof HTMLElement ? candidate : null;
}

function findMoreSheet() {
  const showTags = buttonByText(document, "Show tags");
  const candidate = showTags?.closest("section");
  return candidate instanceof HTMLElement ? candidate : null;
}

export function CreateMobileComposerCorrections() {
  useEffect(() => {
    const media = window.matchMedia("(max-width:767px)");
    let cancelled = false;
    let timer = 0;
    let style: HTMLStyleElement | null = null;
    let root: HTMLElement | null = null;
    let footer: HTMLElement | null = null;
    let sheetHeader: HTMLElement | null = null;
    let moreSheet: HTMLElement | null = null;
    let aiButton: HTMLButtonElement | null = null;

    const sync = () => {
      if (!media.matches || cancelled) return;

      root = findCreateRoot();
      if (!root) return;

      const purpose = root.querySelector<HTMLInputElement>(
        '[data-mc-role="purpose"] input'
      );
      if (purpose) {
        purpose.required = true;
        purpose.setAttribute("aria-required", "true");
      }

      const composerCard = findComposerCard(root);
      footer = footer ?? findFooter() ?? null;
      if (composerCard && footer) {
        footer.dataset.mcFooterInline = "true";
        composerCard.insertAdjacentElement("afterend", footer);
      }

      const body = root.querySelector<HTMLElement>('[data-mc-role="body"]');
      if (body && !body.querySelector('[data-mc-body-guidance="true"]')) {
        aiButton = document.createElement("button");
        aiButton.type = "button";
        aiButton.dataset.mcBodyGuidance = "true";
        aiButton.ariaLabel = "Open Draft Guidance";
        aiButton.textContent = "✦";
        aiButton.addEventListener("click", () => {
          buttonByText(document, "Guidance")?.click();
          window.setTimeout(sync, 0);
        });
        body.append(aiButton);
      }

      sheetHeader = sheetHeader ?? findSheetHeader() ?? null;
      if (sheetHeader) {
        sheetHeader.dataset.mcSheetHeader = "true";
        sheetHeader.dataset.panel = root.dataset.mcPanel ?? "";
      }

      moreSheet = moreSheet ?? findMoreSheet() ?? null;
      if (moreSheet) moreSheet.dataset.mcMoreSheet = "true";
    };

    const locate = () => {
      if (cancelled || !media.matches) return;
      sync();
      if (!root || !footer || !sheetHeader || !moreSheet) {
        timer = window.setTimeout(locate, 120);
      }
    };

    const handleActivity = () => {
      window.setTimeout(sync, 0);
    };

    const activate = () => {
      window.clearTimeout(timer);
      if (!media.matches) return;

      if (!style) {
        style = document.createElement("style");
        style.dataset.mcCorrection = "true";
        style.textContent = CORRECTION_CSS;
        document.head.append(style);
      }

      document.addEventListener("click", handleActivity, true);
      document.addEventListener("input", handleActivity, true);
      document.addEventListener("change", handleActivity, true);
      locate();
    };

    activate();
    media.addEventListener("change", activate);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      media.removeEventListener("change", activate);
      document.removeEventListener("click", handleActivity, true);
      document.removeEventListener("input", handleActivity, true);
      document.removeEventListener("change", handleActivity, true);
      if (footer) delete footer.dataset.mcFooterInline;
      if (sheetHeader) {
        delete sheetHeader.dataset.mcSheetHeader;
        delete sheetHeader.dataset.panel;
      }
      if (moreSheet) delete moreSheet.dataset.mcMoreSheet;
      aiButton?.remove();
      style?.remove();
    };
  }, []);

  return null;
}
