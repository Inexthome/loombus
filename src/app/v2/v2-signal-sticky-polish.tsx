"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

function parseCompactCount(value: string | null | undefined) {
  const clean = (value ?? "").trim().toLowerCase();
  if (!clean) return 0;

  const match = clean.match(/([0-9]+(?:\.[0-9]+)?)(k)?/);
  if (!match) return 0;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return 0;

  return Math.round(amount * (match[2] === "k" ? 1000 : 1));
}

function getMetricFromText(text: string, symbol: string) {
  const match = text.match(new RegExp(`${symbol}\\s*([0-9]+(?:\\.[0-9]+)?k?)`, "i"));
  return parseCompactCount(match?.[1]);
}

function getSignalScoreFromText(text: string) {
  const replies = getMetricFromText(text, "💬");
  const saves = getMetricFromText(text, "🔖");
  const views = getMetricFromText(text, "👁");
  return replies * 3 + saves * 5 + views;
}

function getDiscussionIdFromHref(href: string | null | undefined) {
  if (!href) return "";
  const parts = href.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

async function addToSticky(discussionId: string) {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;

  if (!accessToken) {
    window.location.href = "/login";
    return { ok: false, message: "Sign in required" };
  }

  const response = await fetch("/api/stickies", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ discussionId }),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    return { ok: false, message: result.error ?? "Unable to add to Stickies" };
  }

  return { ok: true, message: "Added" };
}

async function getSignalScoreForDiscussion(discussionId: string) {
  const [replyResult, viewResult, saveResult] = await Promise.all([
    supabase.from("replies").select("id", { count: "exact", head: true }).eq("discussion_id", discussionId).is("deleted_at", null),
    supabase.from("discussion_views").select("id", { count: "exact", head: true }).eq("discussion_id", discussionId),
    supabase.from("bookmarks").select("id", { count: "exact", head: true }).eq("discussion_id", discussionId),
  ]);

  return (replyResult.count ?? 0) * 3 + (saveResult.count ?? 0) * 5 + (viewResult.count ?? 0);
}

function normalizeDiscussionCards() {
  if (!window.location.pathname.startsWith("/v2/discussions")) return;

  for (const article of Array.from(document.querySelectorAll("article"))) {
    const articleText = article.textContent ?? "";
    const firstDetailLink = article.querySelector<HTMLAnchorElement>('a[href^="/v2/discussions/"]');
    const discussionId = getDiscussionIdFromHref(firstDetailLink?.getAttribute("href"));
    if (!discussionId) continue;

    const signalScore = getSignalScoreFromText(articleText);
    const oldSignalLink = Array.from(article.querySelectorAll<HTMLAnchorElement>("a")).find((link) => link.textContent?.includes("Open Signal"));

    if (oldSignalLink) {
      oldSignalLink.removeAttribute("href");
      oldSignalLink.setAttribute("role", "status");
      oldSignalLink.setAttribute("aria-label", `Signal score ${signalScore}`);
      oldSignalLink.setAttribute("data-v2-signal-pill", "true");
      oldSignalLink.textContent = `Signal ${signalScore}`;
    }

    const stickyButton = Array.from(article.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.includes("Add to Sticky"));
    if (!stickyButton || stickyButton.dataset.v2StickyReady === "true") continue;

    stickyButton.dataset.v2StickyReady = "true";
    stickyButton.setAttribute("aria-label", "Add discussion to Stickies");
    stickyButton.setAttribute("title", "Add to Stickies");
    stickyButton.innerHTML = '<span aria-hidden="true">📌</span><span>Add</span>';

    stickyButton.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      stickyButton.textContent = "Adding";
      stickyButton.setAttribute("disabled", "true");

      const result = await addToSticky(discussionId);
      stickyButton.textContent = result.ok ? "📌 Added" : "📌 Add";
      stickyButton.toggleAttribute("disabled", result.ok);
      stickyButton.setAttribute("title", result.message);
    });
  }
}

function normalizeHomeFeaturedSignal() {
  if (window.location.pathname !== "/v2") return;

  const featuredLink = document.querySelector<HTMLAnchorElement>('a[href^="/v2/discussions/"]');
  const discussionId = getDiscussionIdFromHref(featuredLink?.getAttribute("href"));
  if (!featuredLink || !discussionId || featuredLink.querySelector("[data-v2-home-signal]")) return;

  const row = featuredLink.querySelector("div.mt-5.flex");
  if (!row) return;

  const signalPill = document.createElement("span");
  signalPill.dataset.v2HomeSignal = "true";
  signalPill.className = "rounded-full border border-orange-200 bg-orange-50 px-3 py-1 font-black text-orange-800";
  signalPill.textContent = "Signal";
  row.appendChild(signalPill);

  getSignalScoreForDiscussion(discussionId)
    .then((score) => {
      signalPill.textContent = `Signal ${score}`;
    })
    .catch(() => {
      signalPill.remove();
    });
}

export function V2SignalStickyPolish() {
  useEffect(() => {
    const run = () => {
      normalizeDiscussionCards();
      normalizeHomeFeaturedSignal();
    };

    run();

    const observer = new MutationObserver(run);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return (
    <style jsx global>{`
      [data-v2-signal-pill="true"] {
        margin-left: auto !important;
        border: 1px solid rgb(253 186 116) !important;
        background: rgb(255 247 237) !important;
        color: rgb(154 52 18) !important;
        padding: 0.5rem 1rem !important;
        font-weight: 900 !important;
        border-radius: 9999px !important;
        box-shadow: none !important;
        transform: none !important;
        cursor: default !important;
      }
    `}</style>
  );
}
