"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

const STYLE_ID = "loombus-v2-discussions-gold-polish";
const FILTER_PANEL_ID = "loombus-v2-discussions-filter-panel";
const STICKY_BUTTON_ATTR = "data-loombus-sticky-button";
const GOLD = "#d6a84f";
const GOLD_DARK = "#8a5a00";
const GOLD_SOFT = "#fff7e6";
const FILTERS = ["All", "Following", "Research Questions", "Debates", "Problem Solving", "Saved", "Trending"];

function isDiscussionsPath(pathname: string) {
  return pathname === "/v2/discussions" || pathname.startsWith("/v2/discussions?");
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    main[data-loombus-discussions-polish="true"] aside a[href="/v2/topics"],
    main[data-loombus-discussions-polish="true"] aside a[href="/v2/saved"],
    main[data-loombus-discussions-polish="true"] aside a[href="/v2/people"] {
      color: ${GOLD_DARK} !important;
    }

    main[data-loombus-discussions-polish="true"] aside svg.text-blue-600,
    main[data-loombus-discussions-polish="true"] article svg.text-blue-600,
    main[data-loombus-discussions-polish="true"] .text-blue-600,
    main[data-loombus-discussions-polish="true"] .text-blue-700 {
      color: ${GOLD_DARK} !important;
      stroke: currentColor !important;
    }

    main[data-loombus-discussions-polish="true"] aside button span.grid,
    main[data-loombus-discussions-polish="true"] aside span.grid.bg-blue-100,
    main[data-loombus-discussions-polish="true"] article span.bg-blue-50 {
      background: ${GOLD_SOFT} !important;
      color: ${GOLD_DARK} !important;
      border: 1px solid rgba(214, 168, 79, 0.32) !important;
    }

    main[data-loombus-discussions-polish="true"] button.bg-blue-600,
    main[data-loombus-discussions-polish="true"] .bg-blue-600,
    main[data-loombus-discussions-polish="true"] .bg-blue-700 {
      background: ${GOLD} !important;
      color: #111827 !important;
    }

    main[data-loombus-discussions-polish="true"] .hover\\:text-blue-700:hover,
    main[data-loombus-discussions-polish="true"] .hover\\:text-blue-900:hover {
      color: ${GOLD_DARK} !important;
    }

    main[data-loombus-discussions-polish="true"] .hover\\:bg-blue-50:hover,
    main[data-loombus-discussions-polish="true"] .hover\\:bg-blue-100:hover {
      background: ${GOLD_SOFT} !important;
    }
  `;
  document.head.appendChild(style);
}

function getDiscussionIdFromHref(href: string) {
  const match = href.match(/\/v2\/discussions\/([^/?#]+)/);
  return match?.[1] ?? "";
}

function getOriginalFilterButton(label: string) {
  return Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === label);
}

function ensureFilterPanel() {
  const searchInput = document.querySelector<HTMLInputElement>('input[placeholder="Search discussions, topics, and contributors"]');
  const searchRow = searchInput?.closest("div.mb-4.flex.gap-3") as HTMLElement | null;
  if (!searchRow) return;

  const filterButton = searchRow.querySelector<HTMLButtonElement>("button");
  if (!filterButton || filterButton.dataset.loombusFilterWired === "true") return;

  filterButton.dataset.loombusFilterWired = "true";
  filterButton.setAttribute("aria-label", "Open discussion filters");
  filterButton.setAttribute("aria-expanded", "false");

  let panel = document.getElementById(FILTER_PANEL_ID) as HTMLDivElement | null;
  if (!panel) {
    panel = document.createElement("div");
    panel.id = FILTER_PANEL_ID;
    panel.hidden = true;
    panel.className = "mb-4 rounded-[1.5rem] border border-amber-200 bg-white p-4 shadow-sm";
    panel.innerHTML = `
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 class="text-sm font-black text-slate-900">Filter discussions</h2>
          <p class="mt-1 text-xs font-semibold text-slate-500">Use quick filters to narrow the discussion view.</p>
        </div>
        <button type="button" data-filter-clear="true" class="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-black text-slate-600 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-900">Clear filters</button>
      </div>
      <div class="mt-4 flex flex-wrap gap-2">
        ${FILTERS.map((filter) => `<button type="button" data-filter-value="${filter}" class="rounded-full bg-slate-50 px-4 py-2 text-sm font-bold text-slate-600 ring-1 ring-slate-200 transition hover:bg-amber-50 hover:text-amber-900">${filter}</button>`).join("")}
      </div>
    `;
    searchRow.insertAdjacentElement("afterend", panel);

    panel.querySelector<HTMLButtonElement>('[data-filter-clear="true"]')?.addEventListener("click", () => {
      const input = document.querySelector<HTMLInputElement>('input[placeholder="Search discussions, topics, and contributors"]');
      if (input) {
        input.value = "";
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
      getOriginalFilterButton("All")?.click();
    });

    for (const button of Array.from(panel.querySelectorAll<HTMLButtonElement>("[data-filter-value]"))) {
      button.addEventListener("click", () => {
        getOriginalFilterButton(button.dataset.filterValue ?? "All")?.click();
      });
    }
  }

  filterButton.addEventListener("click", () => {
    const nextOpen = panel ? panel.hidden : false;
    if (panel) panel.hidden = !nextOpen;
    filterButton.setAttribute("aria-expanded", String(nextOpen));
    filterButton.classList.toggle("border-amber-300", nextOpen);
    filterButton.classList.toggle("bg-amber-50", nextOpen);
    filterButton.classList.toggle("text-amber-800", nextOpen);
  });
}

function setStickyButtonState(button: HTMLButtonElement, saved: boolean, loading = false) {
  button.disabled = loading;
  button.className = saved
    ? "inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-800 transition disabled:opacity-70"
    : "inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-600 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800 disabled:opacity-70";
  button.innerHTML = saved
    ? `<span aria-hidden="true">✓</span><span>Sticky</span>`
    : `<span aria-hidden="true">📌</span><span>Add sticky</span>`;
}

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

async function loadExistingStickies() {
  const accessToken = await getAccessToken();
  if (!accessToken) return new Set<string>();

  const response = await fetch("/api/stickies", {
    headers: { ["Authorization"]: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) return new Set<string>();

  const result = await response.json().catch(() => ({}));
  const sourceKeys = (result.stickies ?? [])
    .map((sticky: { source_key?: string }) => sticky.source_key)
    .filter(Boolean) as string[];
  return new Set(sourceKeys);
}

async function addSticky(discussionId: string, button: HTMLButtonElement) {
  setStickyButtonState(button, false, true);

  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      setStickyButtonState(button, false, false);
      return;
    }

    const response = await fetch("/api/stickies", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ["Authorization"]: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ itemType: "discussion", discussionId }),
    });

    setStickyButtonState(button, response.ok, false);
    button.title = response.ok ? "Added to Stickies" : "Unable to add to Stickies";
  } catch {
    setStickyButtonState(button, false, false);
    button.title = "Unable to add to Stickies";
  }
}

async function ensureStickyButtons() {
  const savedIds = await loadExistingStickies();

  for (const article of Array.from(document.querySelectorAll<HTMLElement>("article"))) {
    if (article.querySelector(`[${STICKY_BUTTON_ATTR}]`)) continue;

    const discussionLink = Array.from(article.querySelectorAll<HTMLAnchorElement>('a[href^="/v2/discussions/"]')).find((link) => getDiscussionIdFromHref(link.getAttribute("href") ?? ""));
    const discussionId = getDiscussionIdFromHref(discussionLink?.getAttribute("href") ?? "");
    if (!discussionId) continue;

    const footer = Array.from(article.querySelectorAll<HTMLElement>("div")).find((element) => element.className.includes("border-t") && element.className.includes("gap-4"));
    if (!footer) continue;

    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute(STICKY_BUTTON_ATTR, "true");
    button.setAttribute("aria-label", "Add discussion to Stickies");
    button.title = savedIds.has(discussionId) ? "Added to Stickies" : "Add to Stickies";
    setStickyButtonState(button, savedIds.has(discussionId));
    button.addEventListener("click", () => void addSticky(discussionId, button));
    footer.insertBefore(button, footer.lastElementChild);
  }
}

function applyGoldPolish() {
  document.querySelector("main")?.setAttribute("data-loombus-discussions-polish", "true");
}

export default function DiscussionsPublicPolish() {
  const pathname = usePathname() ?? "";

  useEffect(() => {
    if (!isDiscussionsPath(pathname)) return;

    ensureStyles();
    applyGoldPolish();
    ensureFilterPanel();
    void ensureStickyButtons();

    const observer = new MutationObserver(() => {
      applyGoldPolish();
      ensureFilterPanel();
      void ensureStickyButtons();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
