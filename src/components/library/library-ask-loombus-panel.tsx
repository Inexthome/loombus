"use client";

import Link from "next/link";
import { ArrowLeft, BookOpen, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

const ASK_LOOMBUS_STORAGE_KEY = "loombus:library:ask-loombus:v1";
const MAX_QUESTION_CHARS = 600;

type AskMode = "explain" | "key_claims" | "counterarguments" | "evidence_questions" | "study_help";

type PassageContext = {
  publicationId: string;
  publicationTitle: string;
  authorName: string | null;
  locator: string;
  sectionTitle: string | null;
  selectedText: string;
  startOffset: number;
  endOffset: number;
  textSha256: string;
  capturedAt: string;
};

type AskResult = {
  answer: string;
  mode: AskMode;
  grounding: "selected_passage_and_nearby_chapter";
};

const MODES: Array<{ key: AskMode; label: string; help: string }> = [
  { key: "explain", label: "Explain", help: "Clarify what the passage says and what requires interpretation." },
  { key: "key_claims", label: "Key claims", help: "Separate explicit claims from inferred ones." },
  { key: "counterarguments", label: "Counterarguments", help: "Stress-test the passage without pretending the source made those objections." },
  { key: "evidence_questions", label: "Evidence questions", help: "Identify what evidence a careful reader should look for." },
  { key: "study_help", label: "Study help", help: "Turn the passage into concise review material and self-check questions." },
];

function readPassageContext(): PassageContext | null {
  try {
    const raw = window.sessionStorage.getItem(ASK_LOOMBUS_STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<PassageContext>;
    if (
      typeof value.publicationId !== "string" ||
      typeof value.publicationTitle !== "string" ||
      typeof value.locator !== "string" ||
      typeof value.selectedText !== "string" ||
      typeof value.startOffset !== "number" ||
      typeof value.endOffset !== "number" ||
      typeof value.textSha256 !== "string"
    ) return null;
    return value as PassageContext;
  } catch {
    return null;
  }
}

function renderInlineMarkdown(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={`strong-${index}`} className="font-black">{part.slice(2, -2)}</strong>;
    }
    return <span key={`text-${index}`}>{part}</span>;
  });
}

function renderAskAnswer(answer: string) {
  const lines = answer.split(/\r?\n/);

  return (
    <div className="space-y-3 text-[15px] leading-7 text-[var(--loombus-text)]">
      {lines.map((rawLine, index) => {
        const line = rawLine.trim();
        if (!line) return <div key={`space-${index}`} className="h-1" aria-hidden="true" />;

        const bullet = line.match(/^[-*]\s+(.+)$/);
        if (bullet) {
          return (
            <div key={`bullet-${index}`} className="flex items-start gap-3">
              <span aria-hidden="true" className="mt-[0.72rem] size-1.5 shrink-0 rounded-full bg-[var(--loombus-gold)]" />
              <p className="min-w-0">{renderInlineMarkdown(bullet[1])}</p>
            </div>
          );
        }

        const numbered = line.match(/^(\d+)\.\s+(.+)$/);
        if (numbered) {
          return (
            <div key={`number-${index}`} className="flex items-start gap-3">
              <span className="min-w-5 shrink-0 font-black text-[var(--loombus-gold)]">{numbered[1]}.</span>
              <p className="min-w-0">{renderInlineMarkdown(numbered[2])}</p>
            </div>
          );
        }

        const heading = line.match(/^#{1,3}\s+(.+)$/);
        if (heading) {
          return <h3 key={`heading-${index}`} className="pt-1 text-base font-black">{renderInlineMarkdown(heading[1])}</h3>;
        }

        return <p key={`paragraph-${index}`}>{renderInlineMarkdown(line)}</p>;
      })}
    </div>
  );
}

export function LibraryAskLoombusPanel() {
  const [ready, setReady] = useState(false);
  const [passage, setPassage] = useState<PassageContext | null>(null);
  const [mode, setMode] = useState<AskMode>("explain");
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<AskResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedMode = useMemo(() => MODES.find((item) => item.key === mode) ?? MODES[0], [mode]);

  useEffect(() => {
    setPassage(readPassageContext());
    setReady(true);
  }, []);

  async function askLoombus() {
    if (!passage || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) {
      window.location.href = "/login";
      return;
    }

    try {
      const response = await fetch("/api/library/ask-loombus", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          mode,
          question: question.trim(),
          passage: {
            publicationId: passage.publicationId,
            locator: passage.locator,
            selectedText: passage.selectedText,
            startOffset: passage.startOffset,
            endOffset: passage.endOffset,
            textSha256: passage.textSha256,
          },
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? "Ask Loombus could not answer this passage right now.");
        return;
      }
      setResult(payload as AskResult);
    } catch {
      setError("Ask Loombus could not answer this passage right now.");
    } finally {
      setLoading(false);
    }
  }

  if (!ready) {
    return <main className="grid min-h-screen place-items-center bg-[var(--loombus-page-bg)] text-[var(--loombus-text)]"><Loader2 className="size-6 animate-spin text-[var(--loombus-gold)]" /></main>;
  }

  if (!passage) {
    return (
      <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 py-16 text-[var(--loombus-text)]">
        <section className="mx-auto max-w-xl rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-8 text-center">
          <BookOpen className="mx-auto size-8 text-[var(--loombus-gold)]" />
          <h1 className="mt-4 text-2xl font-black">Select a passage first</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--loombus-text-muted)]">Open a Library publication, select text in the Reader, then choose Ask Loombus.</p>
          <Link href="/library" className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--loombus-gold)] px-5 py-3 text-sm font-black text-black"><ArrowLeft className="size-4" /> Back to Library</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-6 text-[var(--loombus-text)] sm:px-6 md:pt-20">
      <div className="mx-auto max-w-4xl">
        <Link href={`/library/read/${passage.publicationId}`} className="inline-flex items-center gap-2 text-sm font-bold text-[var(--loombus-gold)]"><ArrowLeft className="size-4" /> Back to Reader</Link>

        <header className="mt-6">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--loombus-gold)]">Library · Ask Loombus</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Reason over this passage</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--loombus-text-muted)]">Ask Loombus is grounded only in your selected passage and nearby normalized chapter text. It does not browse the web in this Reader tool.</p>
        </header>

        <section className="mt-6 rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 sm:p-7">
          <div className="flex items-center gap-2 text-[var(--loombus-gold)]"><BookOpen className="size-4" /><span className="text-sm font-black">{passage.publicationTitle}</span></div>
          <p className="mt-1 text-xs text-[var(--loombus-text-subtle)]">{passage.authorName ? `${passage.authorName} · ` : ""}{passage.sectionTitle ?? "Current chapter"}</p>
          <blockquote className="mt-4 border-l-2 border-[var(--loombus-gold)] pl-4 text-sm leading-7 text-[var(--loombus-text-muted)]">“{passage.selectedText}”</blockquote>
        </section>

        <section className="mt-5 rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 sm:p-7">
          <div className="flex items-center gap-2"><Sparkles className="size-5 text-[var(--loombus-gold)]" /><h2 className="text-lg font-black">Choose how to examine it</h2></div>
          <div className="mt-4 flex flex-wrap gap-2">
            {MODES.map((item) => (
              <button key={item.key} type="button" aria-pressed={mode === item.key} onClick={() => { setMode(item.key); setResult(null); setError(null); }} className={`rounded-full border px-4 py-2 text-sm font-black transition ${mode === item.key ? "border-[var(--loombus-gold)] bg-[var(--loombus-gold)] text-black" : "border-[var(--loombus-border)] text-[var(--loombus-text-muted)]"}`}>{item.label}</button>
            ))}
          </div>
          <p className="mt-3 text-sm leading-6 text-[var(--loombus-text-muted)]">{selectedMode.help}</p>

          <label className="mt-5 block">
            <div className="flex items-center justify-between gap-3"><span className="text-sm font-black">Optional question</span><span className="text-xs text-[var(--loombus-text-subtle)]">{question.length}/{MAX_QUESTION_CHARS}</span></div>
            <textarea value={question} onChange={(event) => setQuestion(event.target.value.slice(0, MAX_QUESTION_CHARS))} rows={3} placeholder="Add a specific question about this passage." className="mt-2 w-full resize-y rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3 leading-6 text-[var(--loombus-text)] outline-none focus:border-[var(--loombus-gold)]" />
          </label>

          <div className="mt-5 flex justify-end">
            <button type="button" disabled={loading} onClick={() => void askLoombus()} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--loombus-gold)] px-5 text-sm font-black text-black disabled:opacity-50">{loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{loading ? "Thinking…" : "Ask Loombus"}</button>
          </div>

          {error ? <div role="alert" className="mt-5 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] p-4 text-sm leading-6">{error}</div> : null}
        </section>

        {result ? (
          <section className="mt-5 rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--loombus-gold)]">Ask Loombus answer</p><p className="mt-1 text-xs text-[var(--loombus-text-subtle)]">Grounded in selected passage + nearby chapter context</p></div>
              <button type="button" onClick={() => void askLoombus()} disabled={loading} className="inline-flex items-center gap-2 text-sm font-black text-[var(--loombus-gold)]"><RefreshCw className="size-4" /> Ask again</button>
            </div>
            <div className="mt-5">{renderAskAnswer(result.answer)}</div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
