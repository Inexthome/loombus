"use client";

import Link from "next/link";
import { ArrowLeft, BookOpen, Loader2, MessageSquareText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DISCUSSION_TOPICS } from "@/lib/discussion-topics";
import { supabase } from "@/lib/supabase/client";

const PASSAGE_STORAGE_KEY = "loombus:library:discuss-passage:v1";
const MAX_COMMENTARY_CHARS = 2500;

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

function readPassageContext(): PassageContext | null {
  try {
    const raw = window.sessionStorage.getItem(PASSAGE_STORAGE_KEY);
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
    ) {
      return null;
    }
    return value as PassageContext;
  } catch {
    return null;
  }
}

export function LibraryDiscussPassageComposer() {
  const [passage, setPassage] = useState<PassageContext | null>(null);
  const [ready, setReady] = useState(false);
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [commentary, setCommentary] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectableTopics = useMemo(
    () => DISCUSSION_TOPICS.filter((item) => item.trim().toLowerCase() !== "other"),
    []
  );

  useEffect(() => {
    setPassage(readPassageContext());
    setReady(true);
  }, []);

  async function publish() {
    if (!passage || publishing) return;
    setError(null);
    if (title.trim().length < 8) {
      setError("Use a discussion title with at least 8 characters.");
      return;
    }
    if (!topic) {
      setError("Choose a topic before publishing.");
      return;
    }
    if (!commentary.trim()) {
      setError("Add your framing or question for the community.");
      return;
    }

    setPublishing(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) {
      window.location.href = "/login";
      return;
    }

    try {
      const response = await fetch("/api/library/discuss-passage/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          topic,
          commentary: commentary.trim(),
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
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (result.code === "library_passage_link_failed" && result.discussionId) {
          setError("The discussion was created, but its Library passage link failed. Open the discussion from Discussions rather than publishing again.");
        } else {
          setError(result.error ?? "Unable to publish this passage discussion.");
        }
        return;
      }

      const discussionId = result.discussion?.id as string | undefined;
      if (!discussionId) {
        setError("Discussion was created, but Loombus could not open it automatically.");
        return;
      }

      window.sessionStorage.removeItem(PASSAGE_STORAGE_KEY);
      window.location.href = `/discussions/${discussionId}`;
    } catch {
      setError("Unable to publish this passage discussion right now.");
    } finally {
      setPublishing(false);
    }
  }

  if (!ready) {
    return <main className="min-h-screen bg-[var(--loombus-page-bg)] grid place-items-center text-[var(--loombus-text)]"><Loader2 className="size-6 animate-spin text-[var(--loombus-gold)]" /></main>;
  }

  if (!passage) {
    return (
      <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 py-16 text-[var(--loombus-text)]">
        <section className="mx-auto max-w-xl rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-8 text-center">
          <BookOpen className="mx-auto size-8 text-[var(--loombus-gold)]" />
          <h1 className="mt-4 text-2xl font-black">Select a passage first</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--loombus-text-muted)]">Open a Library publication, select text in the Reader, then choose Discuss passage.</p>
          <Link href="/library" className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--loombus-gold)] px-5 py-3 text-sm font-black text-black"><ArrowLeft className="size-4" /> Back to Library</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-6 text-[var(--loombus-text)] sm:px-6 md:pt-20">
      <div className="mx-auto max-w-3xl">
        <Link href={`/library/read/${passage.publicationId}`} className="inline-flex items-center gap-2 text-sm font-bold text-[var(--loombus-gold)]"><ArrowLeft className="size-4" /> Back to Reader</Link>
        <header className="mt-6">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--loombus-gold)]">Library · Discuss passage</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Start a discussion from this passage</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--loombus-text-muted)]">The selected passage is verified again on the server before the discussion is created and permanently linked to its Library source.</p>
        </header>

        <section className="mt-6 rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 sm:p-7">
          <div className="flex items-center gap-2 text-[var(--loombus-gold)]"><BookOpen className="size-4" /><span className="text-sm font-black">{passage.publicationTitle}</span></div>
          <p className="mt-1 text-xs text-[var(--loombus-text-subtle)]">{passage.authorName ? `${passage.authorName} · ` : ""}{passage.sectionTitle ?? "Current chapter"}</p>
          <blockquote className="mt-4 border-l-2 border-[var(--loombus-gold)] pl-4 text-sm leading-7 text-[var(--loombus-text-muted)]">“{passage.selectedText}”</blockquote>
        </section>

        <section className="mt-5 space-y-5 rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 sm:p-7">
          <label className="block">
            <span className="text-sm font-black">Discussion title</span>
            <input value={title} onChange={(event) => setTitle(event.target.value.slice(0, 180))} placeholder="What should the community examine about this passage?" className="mt-2 min-h-12 w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 text-[var(--loombus-text)] outline-none focus:border-[var(--loombus-gold)]" />
          </label>

          <label className="block">
            <span className="text-sm font-black">Topic</span>
            <select value={topic} onChange={(event) => setTopic(event.target.value)} className="mt-2 min-h-12 w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 text-[var(--loombus-text)] outline-none focus:border-[var(--loombus-gold)]">
              <option value="">Choose a topic</option>
              {selectableTopics.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>

          <label className="block">
            <div className="flex items-center justify-between gap-3"><span className="text-sm font-black">Your framing or question</span><span className="text-xs text-[var(--loombus-text-subtle)]">{commentary.length}/{MAX_COMMENTARY_CHARS}</span></div>
            <textarea value={commentary} onChange={(event) => setCommentary(event.target.value.slice(0, MAX_COMMENTARY_CHARS))} rows={8} placeholder="Explain why this passage matters, what you want members to examine, or the question you want the community to answer." className="mt-2 w-full resize-y rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-4 leading-7 text-[var(--loombus-text)] outline-none focus:border-[var(--loombus-gold)]" />
          </label>

          {error ? <div role="alert" className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] p-4 text-sm leading-6">{error}</div> : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--loombus-border)] pt-5">
            <p className="text-xs leading-5 text-[var(--loombus-text-subtle)]">Publishing still passes through Loombus discussion safety, profile, cooldown, and notification controls.</p>
            <button type="button" onClick={() => void publish()} disabled={publishing} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--loombus-gold)] px-5 text-sm font-black text-black disabled:opacity-50">{publishing ? <Loader2 className="size-4 animate-spin" /> : <MessageSquareText className="size-4" />}{publishing ? "Publishing…" : "Publish discussion"}</button>
          </div>
        </section>
      </div>
    </main>
  );
}
