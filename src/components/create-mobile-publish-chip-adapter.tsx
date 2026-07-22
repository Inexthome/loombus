"use client";

import { useEffect } from "react";

const CSS = String.raw`
@media (max-width:767px){
  .mc-context-chip.mc-context-chip--direct-publish{
    margin-left:auto;
    border-color:var(--loombus-gold)!important;
  }

  .mc-context-chip.mc-context-chip--direct-publish:not(:disabled){
    background:var(--loombus-gold)!important;
    color:var(--loombus-gold-contrast)!important;
    box-shadow:0 .6rem 1.45rem var(--loombus-gold-soft)!important;
  }

  .mc-context-chip.mc-context-chip--direct-publish:disabled{
    cursor:not-allowed!important;
    border-color:var(--loombus-border)!important;
    background:var(--loombus-surface-muted)!important;
    color:var(--loombus-text-subtle)!important;
    box-shadow:none!important;
    opacity:.72!important;
  }
}
`;

function startsWithPublish(button: HTMLButtonElement) {
  const label = button.textContent?.trim() ?? "";
  return label.startsWith("Publish") || label.startsWith("Publishing");
}

export function CreateMobilePublishChipAdapter() {
  useEffect(() => {
    const media = window.matchMedia("(max-width:767px)");
    let observer: MutationObserver | null = null;
    let timer = 0;
    let cleanupCurrent: (() => void) | null = null;

    const activate = () => {
      cleanupCurrent?.();
      cleanupCurrent = null;

      if (!media.matches) return;

      let cancelled = false;

      const locate = () => {
        if (cancelled) return;

        const root = document.querySelector<HTMLElement>("main[data-mobile-create]");
        const row = root?.querySelector<HTMLElement>(".mc-context-row");

        if (!root || !row) {
          timer = window.setTimeout(locate, 100);
          return;
        }

        const style = document.createElement("style");
        style.dataset.mcDirectPublish = "true";
        style.textContent = CSS;
        document.head.append(style);

        const chip = Array.from(row.querySelectorAll<HTMLButtonElement>("button")).find(
          (button) => button.textContent?.trim().startsWith("Add")
        );

        if (!chip) {
          style.remove();
          timer = window.setTimeout(locate, 100);
          return;
        }

        chip.classList.add("mc-context-chip--direct-publish");

        const findOriginalPublish = () =>
          Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find(
            (button) => !button.closest("[data-mc-ui]") && startsWithPublish(button)
          );

        const sync = () => {
          const original = findOriginalPublish();
          const publishing = Boolean(
            original?.textContent?.trim().startsWith("Publishing")
          );
          const disabled = !original || original.disabled;

          chip.disabled = disabled;
          chip.textContent = publishing ? "Publishing…" : "Publish";
          chip.dataset.configured = disabled ? "false" : "true";
          chip.setAttribute(
            "aria-label",
            disabled
              ? "Complete the required fields before publishing"
              : "Publish discussion"
          );
        };

        const handleClick = (event: MouseEvent) => {
          event.preventDefault();
          const original = findOriginalPublish();
          if (original && !original.disabled) original.click();
        };

        chip.addEventListener("click", handleClick);
        observer = new MutationObserver(sync);
        observer.observe(root, {
          attributes: true,
          childList: true,
          subtree: true,
          characterData: true,
        });
        sync();

        cleanupCurrent = () => {
          observer?.disconnect();
          observer = null;
          chip.removeEventListener("click", handleClick);
          chip.classList.remove("mc-context-chip--direct-publish");
          style.remove();
        };
      };

      locate();

      cleanupCurrent = () => {
        cancelled = true;
        window.clearTimeout(timer);
        observer?.disconnect();
        observer = null;
        document.querySelector('style[data-mc-direct-publish="true"]')?.remove();
      };
    };

    activate();
    media.addEventListener("change", activate);

    return () => {
      media.removeEventListener("change", activate);
      cleanupCurrent?.();
      window.clearTimeout(timer);
    };
  }, []);

  return null;
}
