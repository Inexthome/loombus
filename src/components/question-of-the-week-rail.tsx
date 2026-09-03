"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bookmark,
  CheckCircle2,
  MessageCircle,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import styles from "./question-of-the-week-rail.module.css";

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
  status: "open" | "resolved" | null;
  isCurrent: boolean;
};

type ReplyRow = {
  discussion_id: string;
  user_id: string;
  created_at: string;
};

type CardMetrics = {
  replies: number;
  contributors: number;
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
        One real-world question each week, selected by Loombus Editorial for the community to think through together.
      </span>
    </button>
  );
}

function Metric({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-[color:var(--loombus-text-muted)]">
      {icon}
      <strong className="font-semibold text-[color:var(--loombus-text)]">{value}</strong>
      {label}
    </span>
  );
}

export function QuestionOfTheWeekRail() {
  const [questions, setQuestions] = useState<QuestionCard[]>([]);
  const [metrics, setMetrics] = useState<Record<string, CardMetrics>>({});
  const [participation, setParticipation] = useState<Record<string, ParticipationState>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const today = dateOnly(new Date());
      const [{ data, error }, viewerResult] = await Promise.all([
        supabase
          .from("questions_of_the_week")
          .select(
            "id, discussion_id, week_start, week_end, category, why_now, published_at, discussions!inner(id, title, discussion_status, deleted_at)"
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
            whyNow: row.why_now,
            status: discussion.discussion_status,
            isCurrent: row.week_start <= today && row.week_end >= today,
          },
        ];
      });

      setQuestions(cards);

      const discussionIds = cards.map((card) => card.discussionId);
      if (discussionIds.length > 0) {
        const [replyResult, bookmarkResult] = await Promise.all([
          supabase
            .from("replies")
            .select("discussion_id, user_id, created_at")
            .in("discussion_id", discussionIds)
            .is("deleted_at", null),
          supabase
            .from("bookmarks")
            .select("discussion_id")
            .in("discussion_id", discussionIds),
        ]);

        if (mounted) {
          const replies = (replyResult.data ?? []) as ReplyRow[];
          const savedCounts = countByDiscussion(
            (bookmarkResult.data ?? []) as Array<{ discussion_id: string }>
          );
          const nextMetrics: Record<string, CardMetrics> = {};
          const nextParticipation: Record<string, ParticipationState> = {};
          const viewerId = viewerResult.data.user?.id ?? null;

          for (const discussionId of discussionIds) {
            const discussionReplies = replies.filter(
              (reply) => reply.discussion_id === discussionId
            );
            const contributorCount = new Set(
              discussionReplies.map((reply) => reply.user_id).filter(Boolean)
            ).size;
            const saved = savedCounts[discussionId] ?? 0;

            nextMetrics[discussionId] = {
              replies: discussionReplies.length,
              contributors: contributorCount,
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

  const currentQuestion = useMemo(
    () => questions.find((question) => question.isCurrent) ?? questions[0] ?? null,
    [questions]
  );
  const history = useMemo(
    () => questions.filter((question) => question.id !== currentQuestion?.id).slice(0, 5),
    [questions, currentQuestion]
  );

  return (
    <section
      aria-labelledby="question-of-the-week-heading"
      className="border-y border-[color:var(--loombus-border)] py-5"
    >
      <div className="mb-4 min-w-0">
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
        <p className="mt-1 max-w-2xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">
          One question, one week, and a clearer record of what the community surfaces together.
        </p>
      </div>

      {loading ? (
        <div className="border-t border-[color:var(--loombus-border-muted)] py-6 text-sm text-[color:var(--loombus-text-muted)]">
          Loading this week&apos;s question…
        </div>
      ) : !currentQuestion ? (
        <div className="border-t border-[color:var(--loombus-border-muted)] py-6">
          <p className="text-sm font-semibold text-[color:var(--loombus-text)]">
            The next Question of the Week is being prepared.
          </p>
          <p className="mt-1 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
            Loombus Editorial will place it here when the weekly discussion opens.
          </p>
        </div>
      ) : (
        <>
          {(() => {
            const cardMetrics = metrics[currentQuestion.discussionId] ?? {
              replies: 0,
              contributors: 0,
              saved: 0,
              signal: 0,
            };
            const memberState = participation[currentQuestion.discussionId];

            return (
              <article className="border border-[#CBAB5B] bg-[color:var(--loombus-surface)] p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[0.68rem] font-bold uppercase tracking-[0.12em]">
                  <span className="text-[#CBAB5B]">This week</span>
                  <span className="text-[color:var(--loombus-text-muted)]">
                    {currentQuestion.category} · {formatWindow(currentQuestion.weekStart, currentQuestion.weekEnd)}
                  </span>
                </div>

                <h3 className="mt-4 max-w-4xl text-xl font-semibold leading-7 tracking-[-0.02em] text-[color:var(--loombus-text)] sm:text-2xl sm:leading-8">
                  {currentQuestion.title}
                </h3>

                {currentQuestion.whyNow ? (
                  <div className="mt-4 border-l-2 border-[#CBAB5B] pl-4">
                    <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[color:var(--loombus-text-muted)]">
                      Why this question now
                    </p>
                    <p className="mt-1 max-w-3xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                      {currentQuestion.whyNow}
                    </p>
                  </div>
                ) : null}

                <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-y border-[color:var(--loombus-border-muted)] py-3">
                  <Metric
                    icon={<UsersRound aria-hidden="true" className="h-4 w-4" />}
                    value={cardMetrics.contributors}
                    label={cardMetrics.contributors === 1 ? "contributor" : "contributors"}
                  />
                  <Metric
                    icon={<MessageCircle aria-hidden="true" className="h-4 w-4" />}
                    value={cardMetrics.replies}
                    label={cardMetrics.replies === 1 ? "reply" : "replies"}
                  />
                  <Metric
                    icon={<Bookmark aria-hidden="true" className="h-4 w-4" />}
                    value={cardMetrics.saved}
                    label={cardMetrics.saved === 1 ? "save" : "saves"}
                  />
                  <Metric
                    icon={<Sparkles aria-hidden="true" className="h-4 w-4 text-[#CBAB5B]" />}
                    value={cardMetrics.signal}
                    label="signal"
                  />
                </div>

                {memberState?.joined ? (
                  <div className="mt-5 flex flex-col gap-3 border-l-2 border-[#CBAB5B] pl-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--loombus-text)]">
                        <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-[#CBAB5B]" />
                        You joined this week&apos;s Question.
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                        {memberState.repliesSinceContribution > 0
                          ? `${memberState.repliesSinceContribution} ${memberState.repliesSinceContribution === 1 ? "reply has" : "replies have"} been added since your latest contribution.`
                          : "You are caught up with the discussion since your latest contribution."}
                      </p>
                    </div>
                    <Link
                      href={`/discussions/${currentQuestion.discussionId}`}
                      className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-[color:var(--loombus-text)] transition hover:text-[#CBAB5B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CBAB5B]"
                    >
                      Return to the discussion
                      <ArrowRight aria-hidden="true" className="h-4 w-4" />
                    </Link>
                  </div>
                ) : (
                  <Link
                    href={`/discussions/${currentQuestion.discussionId}`}
                    className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--loombus-text)] transition hover:text-[#CBAB5B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CBAB5B]"
                  >
                    Join this week&apos;s discussion
                    <ArrowRight aria-hidden="true" className="h-4 w-4" />
                  </Link>
                )}
              </article>
            );
          })()}

          {history.length > 0 ? (
            <div className="mt-6 border-t border-[color:var(--loombus-border-muted)] pt-5">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[color:var(--loombus-text-muted)]">
                    Previous questions
                  </p>
                  <h3 className="mt-1 text-base font-semibold text-[color:var(--loombus-text)]">
                    What the community surfaced
                  </h3>
                </div>
                <span className="hidden text-xs font-medium text-[color:var(--loombus-text-muted)] sm:block">
                  Return to the record, evidence, and discussion intelligence.
                </span>
              </div>

              <div className="mt-3 divide-y divide-[color:var(--loombus-border-muted)] border-y border-[color:var(--loombus-border-muted)]">
                {history.map((question) => {
                  const cardMetrics = metrics[question.discussionId] ?? {
                    replies: 0,
                    contributors: 0,
                    saved: 0,
                    signal: 0,
                  };

                  return (
                    <Link
                      key={question.id}
                      href={`/discussions/${question.discussionId}#discussion-intelligence`}
                      className="group grid gap-3 py-4 transition sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CBAB5B]"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-[0.66rem] font-bold uppercase tracking-[0.11em] text-[color:var(--loombus-text-muted)]">
                          <span>{formatWindow(question.weekStart, question.weekEnd)}</span>
                          <span aria-hidden="true">·</span>
                          <span>{question.category}</span>
                          {question.status === "resolved" ? (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>Resolved</span>
                            </>
                          ) : null}
                        </div>
                        <p className="mt-1.5 font-semibold leading-6 text-[color:var(--loombus-text)] group-hover:text-[#CBAB5B]">
                          {question.title}
                        </p>
                        <p className="mt-1 text-sm text-[color:var(--loombus-text-muted)]">
                          {cardMetrics.contributors} {cardMetrics.contributors === 1 ? "contributor" : "contributors"} · {cardMetrics.replies} {cardMetrics.replies === 1 ? "reply" : "replies"}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--loombus-text)] group-hover:text-[#CBAB5B]">
                        Review what emerged
                        <ArrowRight aria-hidden="true" className="h-4 w-4" />
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
