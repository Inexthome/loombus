"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bookmark,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import styles from "./question-of-the-week-rail.module.css";

type QuestionOfWeekRow = {
  id: string;
  discussion_id: string;
  week_start: string;
  week_end: string;
  category: string;
  published_at: string;
  discussions:
    | {
        id: string;
        title: string;
        discussion_status: "open" | "resolved" | null;
        deleted_at: string | null;
      }
    | {
        id: string;
        title: string;
        discussion_status: "open" | "resolved" | null;
        deleted_at: string | null;
      }[]
    | null;
};

type QuestionCard = {
  id: string;
  discussionId: string;
  title: string;
  weekStart: string;
  weekEnd: string;
  category: string;
  isCurrent: boolean;
};

type ReplyRow = {
  discussion_id: string;
  user_id: string;
  created_at: string;
};

type CardMetrics = {
  replies: number;
  views: number;
  saved: number;
  signal: number;
};

type ParticipationState = {
  joined: boolean;
  repliesSinceContribution: number;
};

function dateOnly(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatWindow(start: string, end: string) {
  const startDate = new Date(`${start}T12:00:00`);
  const endDate = new Date(`${end}T12:00:00`);
  const sameMonth = startDate.getMonth() === endDate.getMonth();
  const startText = startDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const endText = endDate.toLocaleDateString(undefined, {
    month: sameMonth ? undefined : "short",
    day: "numeric",
  });
  return `${startText}–${endText}`;
}

function weekLabel(index: number, current: boolean) {
  if (current) return "This week";
  if (index === 0) return "Latest";
  if (index === 1) return "Last week";
  return `${index} weeks ago`;
}

function unwrapDiscussion(row: QuestionOfWeekRow) {
  if (Array.isArray(row.discussions)) return row.discussions[0] ?? null;
  return row.discussions;
}

function countByDiscussion(rows: Array<{ discussion_id: string }> | null) {
  const counts: Record<string, number> = {};
  for (const row of rows ?? []) {
    counts[row.discussion_id] = (counts[row.discussion_id] ?? 0) + 1;
  }
  return counts;
}

function QuestionOfTheWeekTooltip() {
  return (
    <button
      type="button"
      className={styles.headingHelp}
      aria-label="About Question of the Week"
      aria-describedby="question-of-the-week-tooltip"
    >
      <span className={styles.headingHelpMark} aria-hidden="true">
        i
      </span>
      <span
        id="question-of-the-week-tooltip"
        className={styles.headingTooltip}
        role="tooltip"
      >
        real-world question worth thinking through together
      </span>
    </button>
  );
}

export function QuestionOfTheWeekRail() {
  const [questions, setQuestions] = useState<QuestionCard[]>([]);
  const [metrics, setMetrics] = useState<Record<string, CardMetrics>>({});
  const [participation, setParticipation] = useState<Record<string, ParticipationState>>({});
  const [loading, setLoading] = useState(true);
  const railRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const today = dateOnly(new Date());
      const [{ data, error }, viewerResult] = await Promise.all([
        supabase
          .from("questions_of_the_week")
          .select(
            "id, discussion_id, week_start, week_end, category, published_at, discussions!inner(id, title, discussion_status, deleted_at)"
          )
          .lte("published_at", new Date().toISOString())
          .order("week_start", { ascending: false })
          .limit(12),
        supabase.auth.getUser(),
      ]);

      if (!mounted) return;
      if (error || !data) {
        setQuestions([]);
        setLoading(false);
        return;
      }

      const cards = (data as unknown as QuestionOfWeekRow[]).flatMap((row) => {
        const discussion = unwrapDiscussion(row);
        if (!discussion || discussion.deleted_at) return [];
        return [
          {
            id: row.id,
            discussionId: row.discussion_id,
            title: discussion.title,
            weekStart: row.week_start,
            weekEnd: row.week_end,
            category: row.category,
            isCurrent: row.week_start <= today && row.week_end >= today,
          },
        ];
      });

      setQuestions(cards);

      const discussionIds = cards.map((card) => card.discussionId);
      if (discussionIds.length > 0) {
        const [replyResult, bookmarkResult, viewResult] = await Promise.all([
          supabase
            .from("replies")
            .select("discussion_id, user_id, created_at")
            .in("discussion_id", discussionIds)
            .is("deleted_at", null),
          supabase
            .from("bookmarks")
            .select("discussion_id")
            .in("discussion_id", discussionIds),
          supabase
            .from("discussion_views")
            .select("discussion_id")
            .in("discussion_id", discussionIds),
        ]);

        if (mounted) {
          const replies = (replyResult.data ?? []) as ReplyRow[];
          const savedCounts = countByDiscussion(
            (bookmarkResult.data ?? []) as Array<{ discussion_id: string }>
          );
          const viewCounts = countByDiscussion(
            (viewResult.data ?? []) as Array<{ discussion_id: string }>
          );
          const nextMetrics: Record<string, CardMetrics> = {};
          const nextParticipation: Record<string, ParticipationState> = {};
          const viewerId = viewerResult.data.user?.id ?? null;

          for (const discussionId of discussionIds) {
            const discussionReplies = replies.filter(
              (reply) => reply.discussion_id === discussionId
            );
            const saved = savedCounts[discussionId] ?? 0;
            nextMetrics[discussionId] = {
              replies: discussionReplies.length,
              views: viewCounts[discussionId] ?? 0,
              saved,
              signal: discussionReplies.length + saved,
            };

            if (viewerId) {
              const viewerReplies = discussionReplies
                .filter((reply) => reply.user_id === viewerId)
                .sort(
                  (a, b) =>
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                );
              const latestViewerReply = viewerReplies[0] ?? null;
              nextParticipation[discussionId] = {
                joined: Boolean(latestViewerReply),
                repliesSinceContribution: latestViewerReply
                  ? discussionReplies.filter(
                      (reply) =>
                        reply.user_id !== viewerId &&
                        new Date(reply.created_at).getTime() >
                          new Date(latestViewerReply.created_at).getTime()
                    ).length
                  : 0,
              };
            }
          }

          setMetrics(nextMetrics);
          setParticipation(nextParticipation);
        }
      }

      if (mounted) setLoading(false);
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const activeIndex = useMemo(() => {
    const currentIndex = questions.findIndex((question) => question.isCurrent);
    return currentIndex >= 0 ? currentIndex : 0;
  }, [questions]);

  function move(direction: -1 | 1) {
    railRef.current?.scrollBy({
      left: direction * Math.max(280, railRef.current.clientWidth * 0.72),
      behavior: "smooth",
    });
  }

  return (
    <section
      aria-labelledby="question-of-the-week-heading"
      className="border-y border-[color:var(--loombus-border)] py-5"
    >
      <div className="mb-4 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[#CBAB5B]">
            Loombus Editorial
          </p>
          <h2
            id="question-of-the-week-heading"
            className="mt-1 flex items-center text-lg font-semibold tracking-[-0.02em] text-[color:var(--loombus-text)]"
          >
            Question of the Week
            <QuestionOfTheWeekTooltip />
          </h2>
        </div>

        {questions.length > 1 ? (
          <div className="hidden shrink-0 items-center gap-1 sm:flex" aria-label="Question history controls">
            <button
              type="button"
              onClick={() => move(-1)}
              className="inline-flex h-9 w-9 items-center justify-center border border-[color:var(--loombus-border)] text-[color:var(--loombus-text-muted)] transition hover:text-[color:var(--loombus-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CBAB5B]"
              aria-label="Scroll toward newer questions"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => move(1)}
              className="inline-flex h-9 w-9 items-center justify-center border border-[color:var(--loombus-border)] text-[color:var(--loombus-text-muted)] transition hover:text-[color:var(--loombus-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CBAB5B]"
              aria-label="Scroll toward older questions"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="border-t border-[color:var(--loombus-border-muted)] py-6 text-sm text-[color:var(--loombus-text-muted)]">
          Loading the weekly question…
        </div>
      ) : questions.length === 0 ? (
        <div className="border-t border-[color:var(--loombus-border-muted)] py-6">
          <p className="text-sm font-semibold text-[color:var(--loombus-text)]">
            The first Question of the Week is being prepared.
          </p>
          <p className="mt-1 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
            It will appear here without changing the normal Discussions feed.
          </p>
        </div>
      ) : (
        <div
          ref={railRef}
          role="list"
          aria-label="Question of the Week history"
          className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {questions.map((question, index) => {
            const label = weekLabel(index - activeIndex, question.isCurrent);
            const cardMetrics = metrics[question.discussionId] ?? {
              replies: 0,
              views: 0,
              saved: 0,
              signal: 0,
            };
            const memberState = participation[question.discussionId];

            return (
              <Link
                key={question.id}
                role="listitem"
                href={`/discussions/${question.discussionId}`}
                className={`group min-w-[84%] snap-start border p-5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CBAB5B] sm:min-w-[58%] lg:min-w-[42%] ${
                  question.isCurrent
                    ? "border-[#CBAB5B] bg-[color:var(--loombus-surface)]"
                    : "border-[color:var(--loombus-border)] bg-transparent hover:border-[color:var(--loombus-text-muted)]"
                }`}
              >
                <div className="flex items-center justify-between gap-3 text-[0.68rem] font-bold uppercase tracking-[0.12em]">
                  <span className={question.isCurrent ? "text-[#CBAB5B]" : "text-[color:var(--loombus-text-muted)]"}>
                    {label}
                  </span>
                  <span className="truncate text-[color:var(--loombus-text-muted)]">
                    {question.category}
                  </span>
                </div>
                <p className="mt-2 text-xs font-medium text-[color:var(--loombus-text-muted)]">
                  {formatWindow(question.weekStart, question.weekEnd)}
                </p>
                <h3 className="mt-3 text-[1.05rem] font-semibold leading-6 tracking-[-0.015em] text-[color:var(--loombus-text)]">
                  {question.title}
                </h3>

                <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-[color:var(--loombus-text)] group-hover:text-[#CBAB5B]">
                  {memberState?.joined ? (
                    <CheckCircle2 className="h-4 w-4 text-[#CBAB5B]" aria-hidden="true" />
                  ) : null}
                  <span>{memberState?.joined ? "Return to the discussion" : "Join the discussion"}</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  {question.isCurrent && memberState?.joined && memberState.repliesSinceContribution > 0 ? (
                    <span className="ml-auto text-xs font-medium text-[color:var(--loombus-text-muted)]">
                      {memberState.repliesSinceContribution} new
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3 text-sm text-[color:var(--loombus-text-muted)]">
                    <span className="inline-flex items-center gap-1.5" aria-label={`${cardMetrics.replies} replies`}>
                      <MessageCircle aria-hidden="true" className="h-4 w-4" />
                      {cardMetrics.replies}
                    </span>
                    <span className="inline-flex items-center gap-1.5" aria-label={`${cardMetrics.views} views`}>
                      <Eye aria-hidden="true" className="h-4 w-4" />
                      {cardMetrics.views}
                    </span>
                    <span className="inline-flex items-center gap-1.5" aria-label={`${cardMetrics.saved} saves`}>
                      <Bookmark aria-hidden="true" className="h-4 w-4" />
                      {cardMetrics.saved}
                    </span>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-[color:var(--loombus-text)]">
                    <Sparkles aria-hidden="true" className="h-4 w-4 text-[#CBAB5B]" />
                    {cardMetrics.signal}
                    <span className="text-[color:var(--loombus-text-muted)]">Signal</span>
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
