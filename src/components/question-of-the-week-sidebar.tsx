"use client";

import Link from "next/link";
import { ArrowRight, Bookmark, Eye, MessageCircle, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
        deleted_at: string | null;
      }
    | {
        id: string;
        title: string;
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

type FeaturedMetrics = {
  replies: number;
  views: number;
  saved: number;
  signal: number;
};

const EMPTY_METRICS: FeaturedMetrics = {
  replies: 0,
  views: 0,
  saved: 0,
  signal: 0,
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

function unwrapDiscussion(row: QuestionOfWeekRow) {
  if (Array.isArray(row.discussions)) return row.discussions[0] ?? null;
  return row.discussions;
}

function QuestionOfTheWeekTooltip() {
  return (
    <button
      type="button"
      className={styles.headingHelp}
      aria-label="About Question of the Week"
      aria-describedby="question-of-the-week-sidebar-tooltip"
    >
      <span className={styles.headingHelpMark} aria-hidden="true">
        i
      </span>
      <span
        id="question-of-the-week-sidebar-tooltip"
        className={styles.headingTooltip}
        role="tooltip"
      >
        real-world question worth thinking through together
      </span>
    </button>
  );
}

export function QuestionOfTheWeekSidebar() {
  const [questions, setQuestions] = useState<QuestionCard[]>([]);
  const [metrics, setMetrics] = useState<FeaturedMetrics>(EMPTY_METRICS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const today = dateOnly(new Date());
      const { data, error } = await supabase
        .from("questions_of_the_week")
        .select(
          "id, discussion_id, week_start, week_end, category, published_at, discussions!inner(id, title, deleted_at)"
        )
        .lte("published_at", new Date().toISOString())
        .order("week_start", { ascending: false })
        .limit(4);

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
      const featured = cards.find((card) => card.isCurrent) ?? cards[0];

      if (featured) {
        const [replyResult, bookmarkResult, viewResult] = await Promise.all([
          supabase
            .from("replies")
            .select("discussion_id")
            .eq("discussion_id", featured.discussionId)
            .is("deleted_at", null),
          supabase
            .from("bookmarks")
            .select("discussion_id")
            .eq("discussion_id", featured.discussionId),
          supabase
            .from("discussion_views")
            .select("discussion_id")
            .eq("discussion_id", featured.discussionId),
        ]);

        if (mounted) {
          const replies = replyResult.data?.length ?? 0;
          const saved = bookmarkResult.data?.length ?? 0;
          setMetrics({
            replies,
            views: viewResult.data?.length ?? 0,
            saved,
            signal: replies + saved,
          });
        }
      }

      if (mounted) setLoading(false);
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const featured = useMemo(
    () => questions.find((question) => question.isCurrent) ?? questions[0] ?? null,
    [questions]
  );
  const history = useMemo(
    () => questions.filter((question) => question.id !== featured?.id).slice(0, 3),
    [featured?.id, questions]
  );

  return (
    <section className="sticky top-28 border-y border-[color:var(--loombus-border)] py-5">
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[#CBAB5B]">
        Loombus Editorial
      </p>
      <h2 className="mt-1 flex items-center text-base font-semibold tracking-[-0.02em] text-[color:var(--loombus-text)]">
        Question of the Week
        <QuestionOfTheWeekTooltip />
      </h2>

      {loading ? (
        <p className="mt-5 border-t border-[color:var(--loombus-border-muted)] pt-4 text-sm text-[color:var(--loombus-text-muted)]">
          Loading the weekly question…
        </p>
      ) : featured ? (
        <>
          <Link
            href={`/discussions/${featured.discussionId}`}
            className="group mt-5 block border border-[#CBAB5B] bg-[color:var(--loombus-surface)] p-4 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CBAB5B]"
          >
            <div className="flex items-center justify-between gap-2 text-[0.65rem] font-bold uppercase tracking-[0.11em]">
              <span className="text-[#CBAB5B]">{featured.isCurrent ? "This week" : "Latest"}</span>
              <span className="truncate text-[color:var(--loombus-text-muted)]">{featured.category}</span>
            </div>
            <p className="mt-2 text-[0.72rem] font-medium text-[color:var(--loombus-text-muted)]">
              {formatWindow(featured.weekStart, featured.weekEnd)}
            </p>
            <h3 className="mt-3 text-sm font-semibold leading-5 tracking-[-0.01em] text-[color:var(--loombus-text)]">
              {featured.title}
            </h3>
            <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[color:var(--loombus-text)] group-hover:text-[#CBAB5B]">
              Join the discussion
              <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
            </span>

            <div className="mt-4 flex items-center justify-between gap-2 border-t border-[color:var(--loombus-border-muted)] pt-3">
              <div className="flex items-center gap-2.5 text-xs text-[color:var(--loombus-text-muted)]">
                <span className="inline-flex items-center gap-1" aria-label={`${metrics.replies} replies`}>
                  <MessageCircle aria-hidden="true" className="h-3.5 w-3.5" />
                  {metrics.replies}
                </span>
                <span className="inline-flex items-center gap-1" aria-label={`${metrics.views} views`}>
                  <Eye aria-hidden="true" className="h-3.5 w-3.5" />
                  {metrics.views}
                </span>
                <span className="inline-flex items-center gap-1" aria-label={`${metrics.saved} saves`}>
                  <Bookmark aria-hidden="true" className="h-3.5 w-3.5" />
                  {metrics.saved}
                </span>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[color:var(--loombus-text)]">
                <Sparkles aria-hidden="true" className="h-3.5 w-3.5 text-[#CBAB5B]" />
                {metrics.signal}
              </span>
            </div>
          </Link>

          {history.length > 0 ? (
            <div className="mt-5 border-t border-[color:var(--loombus-border-muted)] pt-4">
              <p className="text-[0.66rem] font-bold uppercase tracking-[0.14em] text-[color:var(--loombus-text-muted)]">
                Previous questions
              </p>
              <div className="mt-3 divide-y divide-[color:var(--loombus-border-muted)]">
                {history.map((question) => (
                  <Link
                    key={question.id}
                    href={`/discussions/${question.discussionId}`}
                    className="block py-3 text-xs font-semibold leading-5 text-[color:var(--loombus-text)] transition hover:text-[#CBAB5B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CBAB5B]"
                  >
                    <span className="mb-1 block text-[0.65rem] uppercase tracking-[0.1em] text-[color:var(--loombus-text-muted)]">
                      {formatWindow(question.weekStart, question.weekEnd)}
                    </span>
                    {question.title}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <p className="mt-5 border-t border-[color:var(--loombus-border-muted)] pt-4 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
          The first Question of the Week is being prepared.
        </p>
      )}
    </section>
  );
}
