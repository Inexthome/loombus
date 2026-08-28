"use client";

import { useEffect } from "react";

const CLEAR_LABELS = new Set(["clear", "clear draft"]);
const enhancedDialogs = new WeakSet<HTMLElement>();

function hasMeaningfulDraft(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea")).some(
    (element) => element.type !== "file" && element.value.trim().length > 0
  );
}

function enhanceTabs(root: HTMLElement) {
  const tablist = root.querySelector<HTMLElement>(".create-composer-tabs");
  if (!tablist) return;
  tablist.setAttribute("role", "tablist");

  const tabs = Array.from(tablist.querySelectorAll<HTMLButtonElement>("button"));
  const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.dataset.active === "true"));
  tabs.forEach((tab, index) => {
    const active = index === activeIndex;
    tab.id = `create-composer-tab-${index}`;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", String(active));
    tab.setAttribute("aria-controls", `create-composer-panel-${index}`);
    tab.tabIndex = active ? 0 : -1;
  });

  const panel = root.querySelector<HTMLElement>(".create-composer-write, .create-composer-panel");
  if (panel) {
    panel.id = `create-composer-panel-${activeIndex}`;
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", `create-composer-tab-${activeIndex}`);
  }
}

function enhanceDialogs() {
  const overlays = Array.from(document.querySelectorAll<HTMLElement>('div[class*="z-[110]"]'));
  overlays.forEach((overlay) => {
    const dialog = overlay.querySelector<HTMLElement>("section");
    const title = dialog?.querySelector<HTMLElement>("h2");
    if (!dialog || !title) return;
    if (!title.id) {
      title.id = `create-dialog-title-${title.textContent?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || "panel"}`;
    }
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", title.id);

    if (!enhancedDialogs.has(dialog)) {
      enhancedDialogs.add(dialog);
      window.requestAnimationFrame(() => {
        dialog.querySelector<HTMLElement>("button:not([aria-label^='Close composer options'])")?.focus();
      });
    }
  });
}

export function CreateInteractionHardening() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-create-composer-variant]");
    if (!root) return;

    const refresh = () => {
      enhanceTabs(root);
      enhanceDialogs();
    };

    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-active"],
    });

    const onClickCapture = (event: MouseEvent) => {
      const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>("button");
      if (!button || !root.contains(button)) return;
      const label = button.textContent?.replace(/\s+/g, " ").trim().toLowerCase() ?? "";
      if (!CLEAR_LABELS.has(label) || !hasMeaningfulDraft(root)) return;
      if (!window.confirm("Clear this draft? This removes the current saved draft.")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const tab = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('[role="tab"]');
      if (!tab || !root.contains(tab) || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('.create-composer-tabs [role="tab"]'));
      const index = tabs.indexOf(tab);
      if (index < 0) return;
      event.preventDefault();
      const nextIndex =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? tabs.length - 1
            : event.key === "ArrowRight"
              ? (index + 1) % tabs.length
              : (index - 1 + tabs.length) % tabs.length;
      tabs[nextIndex]?.focus();
      tabs[nextIndex]?.click();
    };

    root.addEventListener("click", onClickCapture, true);
    root.addEventListener("keydown", onKeyDown);
    return () => {
      observer.disconnect();
      root.removeEventListener("click", onClickCapture, true);
      root.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return null;
}
