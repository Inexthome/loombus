"use client";

import { useEffect } from "react";

const ACTIONS_ATTR = "data-loombus-room-actions";

function closeOtherMenus(currentMenu: HTMLElement) {
  document.querySelectorAll<HTMLElement>(`[${ACTIONS_ATTR}] [data-room-card-menu]`).forEach((menu) => {
    if (menu !== currentMenu) menu.hidden = true;
  });
}

function createActionsMenu(article: HTMLElement) {
  if (article.querySelector(`[${ACTIONS_ATTR}]`)) return;

  article.classList.add("relative");

  const container = document.createElement("div");
  container.setAttribute(ACTIONS_ATTR, "true");
  container.className = "absolute right-3 top-3 z-10";

  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", "Open discussion actions");
  button.className = "grid size-8 place-items-center rounded-full bg-white text-lg font-black leading-none text-slate-500 ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-slate-950";
  button.textContent = "⋯";

  const menu = document.createElement("div");
  menu.setAttribute("data-room-card-menu", "true");
  menu.hidden = true;
  menu.className = "absolute right-0 top-10 w-40 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 text-left shadow-xl";

  const reportButton = document.createElement("button");
  reportButton.type = "button";
  reportButton.className = "block w-full rounded-xl px-3 py-2 text-left text-sm font-black text-rose-700 hover:bg-rose-50";
  reportButton.textContent = "Report";

  reportButton.addEventListener("click", () => {
    menu.hidden = true;
    article.dispatchEvent(new CustomEvent("loombus:room-post-report", { bubbles: true }));
    window.alert("Report option selected. Full room post reporting can now be wired to the moderation queue.");
  });

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    closeOtherMenus(menu);
    menu.hidden = !menu.hidden;
  });

  menu.appendChild(reportButton);
  container.appendChild(button);
  container.appendChild(menu);
  article.appendChild(container);
}

export function RoomDiscussionCardActions() {
  useEffect(() => {
    function enhanceCards() {
      document.querySelectorAll<HTMLElement>("main.loombus-v2-page-bg section#discussions article").forEach(createActionsMenu);
    }

    enhanceCards();

    const observer = new MutationObserver(enhanceCards);
    observer.observe(document.body, { childList: true, subtree: true });

    function closeMenus() {
      document.querySelectorAll<HTMLElement>(`[${ACTIONS_ATTR}] [data-room-card-menu]`).forEach((menu) => {
        menu.hidden = true;
      });
    }

    document.addEventListener("click", closeMenus);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", closeMenus);
    };
  }, []);

  return null;
}
