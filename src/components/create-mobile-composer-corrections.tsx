"use client";

import { useEffect } from "react";

const CORRECTION_CSS = String.raw`
@media (max-width:767px){
  main[data-mobile-create]{
    padding-bottom:2rem!important;
  }

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

  main[data-mobile-create] [data-mc-role="purpose"] .text-red-500{
    display:inline!important;
  }

  main[data-mobile-create] [data-mc-role="purpose"]>span:first-child:after{
    content:""!important;
  }

  main[data-mobile-create][data-mc-panel="attachments"] [data-mc-role="attachments"]>p{
    display:none!important;
  }

  [data-mc-attachment-header="true"]{
    height:min(78dvh,44rem)!important;
  }

  [data-mc-attachment-header="true"]>div{
    justify-content:flex-end!important;
    border:0!important;
    background:transparent!important;
    padding:1rem!important;
  }

  [data-mc-attachment-header="true"] strong{
    display:none!important;
  }

  [data-mc-attachment-header="true"] button{
    pointer-events:auto!important;
    border:1px solid var(--loombus-border)!important;
    background:var(--loombus-surface-strong)!important;
    color:var(--loombus-text)!important;
    box-shadow:0 .5rem 1.5rem rgb(0 0 0/.12)!important;
  }

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

  [data-mc-footer-inline="true"]>div{
    width:100%!important;
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
  return Array.from(document.querySelectorAll<HTMLElement>("[data-mc-ui]")).find(
    (element) =>
      element.querySelector("strong") &&
      Array.from(element.querySelectorAll("button")).some(
        (button) => button.textContent?.trim() === "×"
      )
  );
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

      sheetHeader = sheetHeader ?? findSheetHeader() ?? null;
      if (sheetHeader) {
        const attachmentsOpen = root.dataset.mcPanel === "attachments";
        if (attachmentsOpen) {
          sheetHeader.dataset.mcAttachmentHeader = "true";
          const title = sheetHeader.querySelector("strong");
          if (title) title.textContent = "";
        } else {
          delete sheetHeader.dataset.mcAttachmentHeader;
        }
      }
    };

    const locate = () => {
      if (cancelled || !media.matches) return;
      sync();
      if (!root || !footer || !sheetHeader) {
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
      if (sheetHeader) delete sheetHeader.dataset.mcAttachmentHeader;
      style?.remove();
    };
  }, []);

  return null;
}
