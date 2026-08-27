"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const ACCOUNT_BUTTON_SELECTOR =
  '.loombus-desktop-flat-topbar [aria-label="Open account menu"]';
const ACCOUNT_MENU_SELECTOR = ".loombus-desktop-account-menu";

export function DesktopAccountAutoCloseController() {
  const pathname = usePathname();

  useEffect(() => {
    const button = document.querySelector<HTMLButtonElement>(ACCOUNT_BUTTON_SELECTOR);
    if (button?.getAttribute("aria-expanded") === "true") button.click();
  }, [pathname]);

  useEffect(() => {
    function closeMenu({ focus = false } = {}) {
      const button = document.querySelector<HTMLButtonElement>(ACCOUNT_BUTTON_SELECTOR);
      if (button?.getAttribute("aria-expanded") !== "true") return;
      button.click();
      if (focus) window.setTimeout(() => button.focus(), 0);
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Element | null;
      if (!target) return;
      if (target.closest(ACCOUNT_BUTTON_SELECTOR) || target.closest(ACCOUNT_MENU_SELECTOR)) return;
      closeMenu();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenu({ focus: true });
    }

    document.addEventListener("mousedown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return null;
}
