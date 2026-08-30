"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type QuestionOfWeekRow = {
  id: string;
  discussion_id: string;
  week_start: string;
  week_end: string;
  category: string;
  why_now: string | null;
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
  whyNow: string | null;
  isCurrent: boolean;
};

function dateOnly(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function HeadingTooltip() {
  return (
    <button
      type="button"
      className="discussion-editorial-heading-help"
      aria-label="About Question of the Week"
      aria-describedby="question-of-the-week-heading-help"
    >
      <span className="discussion-editorial-heading-help-mark" aria-hidden="true">
        i
      </span>
      <span
        id="question-of-the-week-heading-help"
        className="discussion-editorial-heading-tooltip"
        role="tooltip"
      >
        real-world question worth thinking through together
      </span>
    </button>
  );
}

export function QuestionOfTheWeekRail() {
  const [questions, setQuestions] = useState<QuestionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const railRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const today = dateOnly(new Date());
      const { data, error } = await supabase
        .from("questions_of_the_week")
        .select(
          "id, discussion_id, week_start, week_end, category, why_now, published_at, discussions!inner(id, title, discussion_status, deleted_at)"
        )
        .lte("published_at", new Date().toISOString())
        .order("week_start", { ascending: false })
        .limit(12);

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
            whyNow: row.why_now,
            isCurrent: row.week_start <= today && row.week_end >= today,
          },
        ];
      });

      setQuestions(cards);
      setLoading(false);
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
          <h2
            id="question-of-the-week-heading"
            className="flex items-center text-lg font-semibold tracking-[-0.02em] text-[#CBAB5B]"
          >
            Question of the Week
            <HeadingTooltip />
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
            return (
              <Link
                key={question.id}
                role="listitem"
                href={`/discussions/${question.discussionId}`}
                aria-label={`${label}: ${question.title}`}
                className={`group flex min-h-36 min-w-[84%] snap-start items-center border p-5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CBAB5B] sm:min-w-[58%] lg:min-w-[42%] ${
                  question.isCurrent
                    ? "border-[#CBAB5B] bg-[color:var(--loombus-surface)]"
                    : "border-[color:var(--loombus-border)] bg-transparent hover:border-[color:var(--loombus-text-muted)]"
                }`}
              >
                <h3 className="text-[1.05rem] font-semibold leading-6 tracking-[-0.015em] text-[color:var(--loombus-text)] group-hover:text-[#CBAB5B]">
                  {question.title}
                </h3>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
