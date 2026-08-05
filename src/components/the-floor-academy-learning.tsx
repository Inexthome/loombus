"use client";

import { supabase } from "@/lib/supabase/client";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  GraduationCap,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Lesson = {
  id: string;
  title: string;
  duration: string;
  purpose: string;
  outcomes: string[];
  sections: Array<{ heading: string; body: string }>;
  exercise: string;
  question: string;
  answers: string[];
  correctAnswer: number;
  explanation: string;
};

type Progress = {
  completed: string[];
  answers: Record<string, number>;
};

const PROGRESS_ID = "academy-core-v1";
const EMPTY_PROGRESS: Progress = { completed: [], answers: {} };
const card =
  "rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5";

const lessons: Lesson[] = [
  {
    id: "falsifiable-thesis",
    title: "Build a falsifiable thesis",
    duration: "18 min",
    purpose:
      "Turn a market opinion into a claim that can be tested, challenged, and resolved without moving the goalposts.",
    outcomes: [
      "Separate a thesis from a prediction",
      "Define a time horizon and observable conditions",
      "Write invalidation criteria before publishing",
    ],
    sections: [
      {
        heading: "A thesis is an argument, not a ticker opinion",
        body: "A useful thesis explains why the market may be mispricing a company, what evidence supports that view, and what would prove the reasoning wrong. ‘I like NVDA’ is sentiment. ‘Data-center revenue will exceed a stated threshold by a stated date because of disclosed demand indicators’ is testable research.",
      },
      {
        heading: "Define the boundary before the outcome",
        body: "Record the stance, horizon, measurable conditions, and invalidation criteria at publication time. A later revision may update the thesis, but it must never erase the original record. This protects the research from hindsight bias.",
      },
      {
        heading: "Use claims the evidence can actually resolve",
        body: "Prefer observable measures such as reported revenue, margins, unit volume, regulatory decisions, customer concentration, or a price threshold on a specific date. Avoid vague claims such as ‘the company will dominate’ unless dominance is defined in advance.",
      },
    ],
    exercise:
      "Choose one company and write a one-sentence thesis containing the claimed change, the evidence expected, the horizon, and one condition that would invalidate it.",
    question: "Which statement is a falsifiable investment thesis?",
    answers: [
      "The company has a strong brand and should do well.",
      "Revenue growth will exceed 20% in the next two reported quarters, and the thesis fails if growth falls below 10% in either quarter.",
      "This stock is undervalued and will eventually recover.",
    ],
    correctAnswer: 1,
    explanation:
      "The second statement defines a measurable result, time horizon, and invalidation condition before the outcome is known.",
  },
  {
    id: "evidence-discipline",
    title: "Separate evidence from narrative",
    duration: "20 min",
    purpose:
      "Build an evidence chain that distinguishes verified facts, management claims, analyst interpretation, and unresolved assumptions.",
    outcomes: [
      "Prioritize primary sources",
      "Label facts, inferences, and assumptions",
      "Recognize stale or circular evidence",
    ],
    sections: [
      {
        heading: "Start as close to the source as possible",
        body: "Company filings, earnings materials, regulator records, exchange data, and official economic releases generally provide stronger foundations than summaries. Secondary reporting can add context, but it should not silently replace the underlying source.",
      },
      {
        heading: "Facts and interpretations are different objects",
        body: "‘Gross margin declined 240 basis points’ can be verified. ‘The decline is temporary’ is an interpretation. Good research shows the reader which is which and explains the reasoning connecting them.",
      },
      {
        heading: "Disclose what the evidence cannot answer",
        body: "Missing information is not a reason to fill the gap with confidence. State the unresolved question, the evidence needed, and how the answer could alter the thesis. Transparent uncertainty is a research strength.",
      },
    ],
    exercise:
      "Take three claims from a current thesis. Label each as verified fact, inference, management claim, or assumption, then attach the strongest available source.",
    question:
      "A filing reports lower unit volume, and an analyst says demand will rebound next quarter. What is the rebound statement?",
    answers: [
      "A verified fact",
      "An interpretation or forecast",
      "A primary source",
    ],
    correctAnswer: 1,
    explanation:
      "The filing establishes the historical volume. A future rebound remains an interpretation or forecast until observable evidence confirms it.",
  },
  {
    id: "counter-case",
    title: "Steelman the counter-case",
    duration: "17 min",
    purpose:
      "Challenge conviction by constructing the strongest evidence-based argument against your preferred conclusion.",
    outcomes: [
      "Distinguish a steelman from a weak objection",
      "Map risks to observable indicators",
      "Update conviction without abandoning discipline",
    ],
    sections: [
      {
        heading: "Argue against yourself at full strength",
        body: "A steelman is the version of the opposing case that a careful, informed analyst would defend. It uses the best contrary data and does not depend on caricaturing the other side.",
      },
      {
        heading: "Convert risks into monitoring signals",
        body: "Name the evidence that would show each risk is becoming real. Pricing pressure may appear in margins, competitive filings, customer commentary, or promotional intensity. A monitored risk is more useful than a generic disclaimer.",
      },
      {
        heading: "Conviction should respond to evidence",
        body: "Changing conviction after material evidence is not inconsistency. Quietly rewriting the original thesis is. Preserve the record, explain what changed, and document why the new evidence deserves weight.",
      },
    ],
    exercise:
      "Write the strongest opposing case to one of your theses using at least two contrary facts. Identify the single indicator most likely to prove that case is gaining strength.",
    question: "What makes a counter-case useful?",
    answers: [
      "It lists every possible risk, regardless of evidence.",
      "It makes the opposing position sound unreasonable.",
      "It uses the strongest contrary evidence and defines indicators to monitor.",
    ],
    correctAnswer: 2,
    explanation:
      "A useful counter-case confronts the best contrary evidence and makes the risk observable rather than rhetorical.",
  },
  {
    id: "accountable-calls",
    title: "Make accountable calls",
    duration: "22 min",
    purpose:
      "Translate part of a thesis into a measurable prediction that can resolve as correct, incorrect, or partial.",
    outcomes: [
      "Choose a valid comparator and target",
      "Set an honest resolution date",
      "Interpret track records using sample size",
    ],
    sections: [
      {
        heading: "A call is narrower than the full thesis",
        body: "A thesis may contain several linked claims. A call selects one measurable prediction, such as revenue exceeding a threshold, a margin entering a range, or a security reaching a defined value by a defined date.",
      },
      {
        heading: "Resolution rules belong at the beginning",
        body: "Record the comparator, target or range, deadline, and evidence source before publishing. The result must remain attached to the original call, including when it is incorrect.",
      },
      {
        heading: "Accuracy without context can mislead",
        body: "A perfect result from one resolved call is not the same as a durable record. Evaluate the number of resolved calls, time horizons, difficulty, partial outcomes, and whether calls were genuinely falsifiable.",
      },
    ],
    exercise:
      "Convert one thesis claim into a call with a comparator, numeric target or range, resolution date, and named evidence source.",
    question: "Why must a resolution rule be recorded when a call is created?",
    answers: [
      "So the analyst cannot redefine success after seeing the outcome.",
      "So every call resolves as correct.",
      "So the call can replace the full thesis.",
    ],
    correctAnswer: 0,
    explanation:
      "Precommitted resolution rules prevent hindsight from changing the meaning of success after the result is known.",
  },
  {
    id: "research-revisions",
    title: "Revise without rewriting history",
    duration: "16 min",
    purpose:
      "Maintain a transparent research timeline when new evidence changes the thesis, risks, or conviction.",
    outcomes: [
      "Know when a revision is material",
      "Preserve the original research record",
      "Explain evidence-driven conviction changes",
    ],
    sections: [
      {
        heading: "New evidence should create a new dated record",
        body: "A revision states what changed, which evidence caused the change, and how the thesis is affected. The original remains visible so readers can evaluate the full reasoning path.",
      },
      {
        heading: "Separate refinement from reversal",
        body: "A refinement may adjust timing while preserving the core mechanism. A reversal changes the central stance or admits the original mechanism failed. Name the difference clearly rather than minimizing it.",
      },
      {
        heading: "Close the learning loop",
        body: "When a call resolves, compare the result with the original assumptions. Identify which evidence was predictive, which was noise, and what process change should carry into future work.",
      },
    ],
    exercise:
      "Draft a dated revision for a thesis. Include the new evidence, the previous assumption it affects, the updated conviction, and whether the core thesis is refined or reversed.",
    question: "What is the correct way to revise a published thesis?",
    answers: [
      "Edit the original so it matches the newest evidence.",
      "Add a dated revision and preserve the original record.",
      "Delete the thesis whenever conviction changes.",
    ],
    correctAnswer: 1,
    explanation:
      "A dated revision preserves accountability while allowing the research to respond honestly to new evidence.",
  },
];

function validProgress(value: unknown): Progress {
  if (!value || typeof value !== "object") return EMPTY_PROGRESS;
  const data = value as { completed?: unknown; answers?: unknown };
  return {
    completed: Array.isArray(data.completed)
      ? data.completed.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
    answers:
      data.answers && typeof data.answers === "object"
        ? (data.answers as Record<string, number>)
        : {},
  };
}

export default function TheFloorAcademyLearning() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ownerId, setOwnerId] = useState("");
  const [activeId, setActiveId] = useState(lessons[0].id);
  const [progress, setProgress] = useState<Progress>(EMPTY_PROGRESS);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const activeIndex = lessons.findIndex((lesson) => lesson.id === activeId);
  const lesson = lessons[Math.max(0, activeIndex)];
  const selectedAnswer = progress.answers[lesson.id];
  const answerIsCorrect = selectedAnswer === lesson.correctAnswer;
  const percent = Math.round(
    (progress.completed.length / lessons.length) * 100,
  );

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const auth = await supabase.auth.getUser();
      if (!auth.data.user || !mounted) return;
      setOwnerId(auth.data.user.id);
      const result = await supabase
        .from("floor_cloud_items")
        .select("data")
        .eq("owner_id", auth.data.user.id)
        .eq("kind", "academy_progress")
        .eq("client_id", PROGRESS_ID)
        .maybeSingle();
      if (!mounted) return;
      if (result.error) setError("Academy progress could not be loaded.");
      if (result.data?.data) setProgress(validProgress(result.data.data));
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const save = useCallback(
    async (next: Progress, successMessage?: string) => {
      if (!ownerId) return;
      setSaving(true);
      setError("");
      setProgress(next);
      const result = await supabase.from("floor_cloud_items").upsert(
        {
          owner_id: ownerId,
          kind: "academy_progress",
          client_id: PROGRESS_ID,
          data: next,
        },
        { onConflict: "owner_id,kind,client_id" },
      );
      setSaving(false);
      if (result.error) {
        setError("Your progress could not be saved. Please try again.");
        return;
      }
      if (successMessage) setNotice(successMessage);
    },
    [ownerId],
  );

  const answered = useMemo(
    () => Object.keys(progress.answers).length,
    [progress.answers],
  );

  if (loading) {
    return (
      <div className={`${card} flex min-h-64 items-center justify-center`}>
        <Loader2 className="size-6 animate-spin text-[var(--loombus-gold)]" />
      </div>
    );
  }

  return (
    <section className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <div className={card}>
          <GraduationCap className="size-6 text-[var(--loombus-gold)]" />
          <p className="mt-3 text-3xl font-black">{percent}%</p>
          <p className="text-xs font-bold text-[var(--loombus-text-muted)]">
            Core curriculum complete
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--loombus-surface-muted)]">
            <div
              className="h-full bg-[var(--loombus-gold)] transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
        <div className={card}>
          <BookOpenCheck className="size-6 text-[var(--loombus-gold)]" />
          <p className="mt-3 text-3xl font-black">
            {progress.completed.length}/{lessons.length}
          </p>
          <p className="text-xs font-bold text-[var(--loombus-text-muted)]">
            Lessons passed
          </p>
        </div>
        <div className={card}>
          <ClipboardCheck className="size-6 text-[var(--loombus-gold)]" />
          <p className="mt-3 text-3xl font-black">{answered}</p>
          <p className="text-xs font-bold text-[var(--loombus-text-muted)]">
            Knowledge checks attempted
          </p>
        </div>
      </div>

      {error ? (
        <p className="rounded-2xl border border-rose-400/40 bg-rose-400/10 p-3 text-sm font-bold text-rose-400">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-2xl border border-emerald-400/40 bg-emerald-400/10 p-3 text-sm font-bold text-emerald-400">
          {notice}
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[290px_1fr]">
        <aside className={`${card} h-fit lg:sticky lg:top-5`}>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--loombus-gold)]">
            Core curriculum
          </p>
          <div className="mt-4 space-y-2">
            {lessons.map((item, index) => {
              const complete = progress.completed.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveId(item.id);
                    setNotice("");
                  }}
                  className={`flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition ${
                    item.id === lesson.id
                      ? "border-[var(--loombus-gold)] bg-[var(--loombus-gold-surface)]"
                      : "border-[var(--loombus-border)] hover:border-[var(--loombus-gold)]"
                  }`}
                >
                  {complete ? (
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-400" />
                  ) : (
                    <Circle className="mt-0.5 size-5 shrink-0 text-[var(--loombus-text-subtle)]" />
                  )}
                  <span>
                    <span className="block text-[10px] font-black uppercase text-[var(--loombus-text-subtle)]">
                      Lesson {index + 1} · {item.duration}
                    </span>
                    <span className="mt-1 block text-sm font-black">
                      {item.title}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <article className={card}>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--loombus-gold)]">
            Lesson {activeIndex + 1} of {lessons.length} · {lesson.duration}
          </p>
          <h2 className="mt-2 text-2xl font-black sm:text-3xl">
            {lesson.title}
          </h2>
          <p className="mt-3 text-sm leading-7 text-[var(--loombus-text-muted)]">
            {lesson.purpose}
          </p>

          <section className="mt-6 rounded-2xl bg-[var(--loombus-surface-muted)] p-4">
            <h3 className="font-black">What you will learn</h3>
            <ul className="mt-3 space-y-2">
              {lesson.outcomes.map((outcome) => (
                <li key={outcome} className="flex gap-2 text-sm leading-6">
                  <CheckCircle2 className="mt-1 size-4 shrink-0 text-[var(--loombus-gold)]" />
                  {outcome}
                </li>
              ))}
            </ul>
          </section>

          <div className="mt-7 space-y-7">
            {lesson.sections.map((section) => (
              <section key={section.heading}>
                <h3 className="text-lg font-black">{section.heading}</h3>
                <p className="mt-2 text-sm leading-7 text-[var(--loombus-text-muted)]">
                  {section.body}
                </p>
              </section>
            ))}
          </div>

          <section className="mt-7 rounded-2xl border border-[var(--loombus-gold)]/40 bg-[var(--loombus-gold-surface)] p-4">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--loombus-gold)]">
              Practical exercise
            </p>
            <p className="mt-2 text-sm leading-7">{lesson.exercise}</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <Link
                href="/the-floor/workspace"
                className="text-xs font-black text-[var(--loombus-gold)]"
              >
                Practice in Workspace →
              </Link>
              <Link
                href="/the-floor/research-assistant"
                className="text-xs font-black"
              >
                Challenge the work with AI →
              </Link>
            </div>
          </section>

          <section className="mt-7 border-t border-[var(--loombus-border)] pt-6">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--loombus-gold)]">
              Knowledge check
            </p>
            <h3 className="mt-2 text-lg font-black">{lesson.question}</h3>
            <div className="mt-4 space-y-2">
              {lesson.answers.map((answer, index) => {
                const selected = selectedAnswer === index;
                return (
                  <button
                    key={answer}
                    type="button"
                    onClick={() =>
                      void save({
                        ...progress,
                        answers: { ...progress.answers, [lesson.id]: index },
                      })
                    }
                    className={`flex w-full gap-3 rounded-2xl border p-3 text-left text-sm font-bold ${
                      selected
                        ? "border-[var(--loombus-gold)] bg-[var(--loombus-gold-surface)]"
                        : "border-[var(--loombus-border)]"
                    }`}
                  >
                    <span className="grid size-6 shrink-0 place-items-center rounded-full border border-current text-xs">
                      {String.fromCharCode(65 + index)}
                    </span>
                    {answer}
                  </button>
                );
              })}
            </div>
            {selectedAnswer !== undefined ? (
              <div
                className={`mt-4 rounded-2xl p-4 text-sm leading-6 ${
                  answerIsCorrect
                    ? "bg-emerald-400/10 text-emerald-400"
                    : "bg-amber-400/10 text-amber-500"
                }`}
              >
                <p className="font-black">
                  {answerIsCorrect
                    ? "Correct"
                    : "Review the lesson and try again"}
                </p>
                <p className="mt-1">{lesson.explanation}</p>
              </div>
            ) : null}
          </section>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              disabled={activeIndex === 0}
              onClick={() => setActiveId(lessons[activeIndex - 1].id)}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm font-black disabled:opacity-40"
            >
              <ArrowLeft className="size-4" /> Previous
            </button>
            {answerIsCorrect ? (
              <button
                type="button"
                disabled={saving || progress.completed.includes(lesson.id)}
                onClick={() =>
                  void save(
                    {
                      ...progress,
                      completed: [
                        ...new Set([...progress.completed, lesson.id]),
                      ],
                    },
                    activeIndex === lessons.length - 1
                      ? "Core Academy curriculum completed."
                      : "Lesson completed and saved.",
                  )
                }
                className="inline-flex items-center gap-2 rounded-full bg-[var(--loombus-gold)] px-4 py-2 text-sm font-black text-black disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                {progress.completed.includes(lesson.id)
                  ? "Lesson completed"
                  : "Complete lesson"}
              </button>
            ) : null}
            <button
              type="button"
              disabled={activeIndex === lessons.length - 1}
              onClick={() => setActiveId(lessons[activeIndex + 1].id)}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm font-black disabled:opacity-40"
            >
              Next <ArrowRight className="size-4" />
            </button>
          </div>
        </article>
      </div>

      <div className={card}>
        <p className="flex gap-2 text-xs leading-5 text-[var(--loombus-text-muted)]">
          <ShieldCheck className="size-4 shrink-0 text-[var(--loombus-gold)]" />
          Completing the curriculum documents learning progress. It is not an
          investment credential, professional license, performance guarantee, or
          certification of investment skill.
        </p>
      </div>
    </section>
  );
}
