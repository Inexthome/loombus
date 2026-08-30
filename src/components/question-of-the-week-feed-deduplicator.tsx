"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

const HIDDEN_ATTRIBUTE = "data-qotw-feed-duplicate-hidden";

function discussionIdFromHref(href: string | null) {
  const match = href?.match(/^\/discussions\/([0-9a-f-]{36})(?:[/?#]|$)/i);
  return match?.[1]?.toLowerCase() ?? null;
}

function hideDuplicateFeedCards(questionDiscussionIds: Set<string>) {
  const main = document.querySelector<HTMLElement>(".discussion-feed-route main");
  if (!main) return;

  for (const article of main.querySelectorAll<HTMLElement>("article")) {
    if (article.closest('[data-question-of-the-week-mount="true"]')) continue;

    const links = Array.from(
      article.querySelectorAll<HTMLAnchorElement>('a[href^="/discussions/"]')
    );
    const isDuplicate = links.some((link) => {
      const discussionId = discussionIdFromHref(link.getAttribute("href"));
      return discussionId ? questionDiscussionIds.has(discussionId) : false;
    });

    if (isDuplicate) {
      article.hidden = true;
      article.setAttribute(HIDDEN_ATTRIBUTE, "true");
    }
  }
}

export function QuestionOfTheWeekFeedDeduplicator() {
  useEffect(() => {
    let cancelled = false;
    let observer: MutationObserver | null = null;

    async function start() {
      const { data, error } = await supabase
        .from("questions_of_the_week")
        .select("discussion_id")
        .order("week_start", { ascending: false })
        .limit(52);

      if (cancelled || error) return;

      const questionDiscussionIds = new Set(
        (data ?? [])
          .map((row) => String(row.discussion_id ?? "").toLowerCase())
          .filter(Boolean)
      );

      if (questionDiscussionIds.size === 0) return;

      const apply = () => hideDuplicateFeedCards(questionDiscussionIds);
      apply();

      const feedRoot = document.querySelector<HTMLElement>(".discussion-feed-route main");
      if (!feedRoot) return;

      observer = new MutationObserver(apply);
      observer.observe(feedRoot, { childList: true, subtree: true });
    }

    void start();

    return () => {
      cancelled = true;
      observer?.disconnect();
      for (const article of document.querySelectorAll<HTMLElement>(
        `[${HIDDEN_ATTRIBUTE}="true"]`
      )) {
        article.hidden = false;
        article.removeAttribute(HIDDEN_ATTRIBUTE);
      }
    };
  }, []);

  return null;
}
