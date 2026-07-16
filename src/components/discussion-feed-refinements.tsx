"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

type DiscussionType =
  | "open_discussion"
  | "debate"
  | "research_question"
  | "problem_solving";

type ExactMode = Exclude<DiscussionType, "open_discussion">;

const EXACT_TAB_TYPES: Record<string, ExactMode> = {
  "Research Questions": "research_question",
  Debates: "debate",
  "Problem Solving": "problem_solving",
};

const MODE_LABELS: Record<DiscussionType, string> = {
  open_discussion: "Open Discussion",
  debate: "Debate",
  research_question: "Research Question",
  problem_solving: "Problem Solving",
};

const STANDARD_TAB_LABELS = new Set(["All", "Following", "Saved"]);
const ALL_TAB_LABELS = [
  "All",
  "Following",
  "Research Questions",
  "Debates",
  "Problem Solving",
  "Saved",
];

function findDiscussionsFeedRoot() {
  return Array.from(
    document.querySelectorAll<HTMLElement>(".discussion-feed-route main")
  ).find(
    (main) => main.querySelector("h1")?.textContent?.trim() === "Discussions"
  );
}

function findTabButton(root: Element, label: string) {
  return Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find(
    (button) => button.textContent?.trim() === label
  );
}

function getDiscussionId(article: HTMLElement) {
  const link = Array.from(
    article.querySelectorAll<HTMLAnchorElement>('a[href^="/discussions/"]')
  ).find((anchor) => /^\/discussions\/[^/]+$/.test(anchor.getAttribute("href") ?? ""));

  return link?.getAttribute("href")?.split("/").filter(Boolean).at(-1) ?? null;
}

function getModeBadge(article: HTMLElement) {
  const primaryLink = Array.from(
    article.querySelectorAll<HTMLAnchorElement>('a[href^="/discussions/"]')
  ).find((anchor) => anchor.querySelector("h2"));
  const badgeRow = primaryLink?.querySelector("div");
  const badges = badgeRow
    ? Array.from(badgeRow.querySelectorAll<HTMLElement>(":scope > span"))
    : [];
  return badges[1] ?? null;
}

function renameActivityTerminology(root: Element) {
  for (const article of Array.from(root.querySelectorAll<HTMLElement>("article"))) {
    for (const span of Array.from(article.querySelectorAll<HTMLElement>("span"))) {
      const text = span.textContent?.trim() ?? "";
      const match = text.match(/^Signal\s+(\d+)$/i);
      if (match) {
        span.textContent = `Activity ${match[1]}`;
      }
    }
  }

  for (const paragraph of Array.from(root.querySelectorAll<HTMLElement>("aside p"))) {
    const text = paragraph.textContent?.trim() ?? "";
    if (text === "Trending topics") {
      paragraph.textContent = "Active topics";
      continue;
    }
    if (text === "Top contributors") {
      paragraph.textContent = "Active contributors";
      continue;
    }

    if (/\bsignals?$/i.test(text)) {
      paragraph.textContent = text.replace(/\bsignals?$/i, "activity");
    }
  }

  for (const span of Array.from(root.querySelectorAll<HTMLElement>("aside span"))) {
    const text = span.textContent?.trim() ?? "";
    if (/^\d+\s+signals?$/i.test(text)) {
      span.textContent = text.replace(/\bsignals?$/i, "activity");
    }
  }
}

function styleExactTabs(root: Element, selectedLabel: string | null) {
  for (const label of ALL_TAB_LABELS) {
    const button = findTabButton(root, label);
    if (!button) continue;

    if (!selectedLabel) {
      button.removeAttribute("data-loombus-exact-tab");
    } else {
      button.dataset.loombusExactTab =
        label === selectedLabel ? "active" : "inactive";
    }
  }
}

function ensureExactEmptyState(root: Element, cardList: Element | null) {
  let empty = root.querySelector<HTMLElement>(
    '[data-loombus-exact-mode-empty="true"]'
  );
  if (empty || !cardList?.parentElement) return empty;

  empty = document.createElement("section");
  empty.dataset.loombusExactModeEmpty = "true";
  empty.hidden = true;
  empty.className =
    "mt-5 rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-7 shadow-xl shadow-black/10";

  const heading = document.createElement("h2");
  heading.className =
    "text-2xl font-semibold tracking-tight text-[color:var(--loombus-text)]";
  heading.textContent = "No discussions found.";

  const copy = document.createElement("p");
  copy.className =
    "mt-3 max-w-2xl text-[color:var(--loombus-text-muted)]";
  copy.textContent =
    "No discussions match this exact discussion mode and the current topic or search filters.";

  empty.append(heading, copy);
  cardList.insertAdjacentElement("afterend", empty);
  return empty;
}

export function DiscussionFeedRefinements() {
  useEffect(() => {
    const root = findDiscussionsFeedRoot();
    if (!root) return;

    const typeByDiscussionId = new Map<string, DiscussionType>();
    let activeExactMode: ExactMode | null = null;
    let activeExactLabel: string | null = null;
    let loadingPromise: Promise<void> | null = null;
    let bypassTabInterception = false;
    let applying = false;

    async function loadDiscussionTypes() {
      if (loadingPromise) return loadingPromise;

      loadingPromise = (async () => {
        const { data } = await supabase
          .from("discussions")
          .select("id, discussion_type")
          .is("deleted_at", null);

        typeByDiscussionId.clear();
        for (const row of data ?? []) {
          const id = typeof row.id === "string" ? row.id : "";
          const type = row.discussion_type as DiscussionType | null;
          if (id && type && MODE_LABELS[type]) {
            typeByDiscussionId.set(id, type);
          }
        }
      })().finally(() => {
        loadingPromise = null;
      });

      return loadingPromise;
    }

    function applyRefinements() {
      if (applying) return;
      applying = true;

      renameActivityTerminology(root);
      const articles = Array.from(root.querySelectorAll<HTMLElement>("article"));
      let visibleCount = 0;

      for (const article of articles) {
        const discussionId = getDiscussionId(article);
        if (!discussionId) continue;

        const type = typeByDiscussionId.get(discussionId) ?? "open_discussion";
        const badge = getModeBadge(article);
        if (badge && badge.textContent?.trim() !== MODE_LABELS[type]) {
          badge.textContent = MODE_LABELS[type];
        }

        const shouldHide = Boolean(activeExactMode && type !== activeExactMode);
        article.hidden = shouldHide;
        if (!shouldHide) visibleCount += 1;
      }

      const cardList = articles[0]?.parentElement ?? null;
      const empty = ensureExactEmptyState(root, cardList);
      if (empty) {
        empty.hidden = !activeExactMode || visibleCount > 0;
      }

      styleExactTabs(root, activeExactLabel);
      applying = false;
    }

    function clearExactMode() {
      activeExactMode = null;
      activeExactLabel = null;
      styleExactTabs(root, null);
      for (const article of Array.from(root.querySelectorAll<HTMLElement>("article"))) {
        article.hidden = false;
      }
      const empty = root.querySelector<HTMLElement>(
        '[data-loombus-exact-mode-empty="true"]'
      );
      if (empty) empty.hidden = true;
    }

    async function activateExactMode(label: string, mode: ExactMode) {
      await loadDiscussionTypes();

      const allButton = findTabButton(root, "All");
      if (allButton) {
        bypassTabInterception = true;
        allButton.click();
        bypassTabInterception = false;
      }

      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() =>
          window.requestAnimationFrame(() => resolve())
        );
      });

      activeExactMode = mode;
      activeExactLabel = label;
      applyRefinements();
    }

    const handleClick = (event: Event) => {
      if (bypassTabInterception) return;
      const button = (event.target as Element | null)?.closest("button");
      if (!button || !root.contains(button)) return;

      const label = button.textContent?.trim() ?? "";
      const exactMode = EXACT_TAB_TYPES[label];

      if (exactMode) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        void activateExactMode(label, exactMode);
        return;
      }

      if (
        STANDARD_TAB_LABELS.has(label) ||
        button.getAttribute("aria-label") === "Reset discussion filters"
      ) {
        clearExactMode();
      }
    };

    const observer = new MutationObserver(() => {
      window.requestAnimationFrame(applyRefinements);
    });

    root.addEventListener("click", handleClick, true);
    observer.observe(root, { childList: true, subtree: true });

    void loadDiscussionTypes().then(applyRefinements);

    return () => {
      observer.disconnect();
      root.removeEventListener("click", handleClick, true);
      clearExactMode();
    };
  }, []);

  return null;
}
