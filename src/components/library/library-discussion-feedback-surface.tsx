"use client";

import Link from "next/link";
import { ArrowLeft, Check, FlaskConical, Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Discussion = {
  id: string;
  title: string;
  topic: string;
  body: string;
};

type SelectionState = {
  text: string;
  start: number;
  end: number;
};

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function LibraryDiscussionFeedbackSurface() {
  const searchParams = useSearchParams();
  const discussionId = searchParams.get("discussionId") ?? "";
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [bodyHash, setBodyHash] = useState("");
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [mode, setMode] = useState<"claim" | "knowledge">("claim");
  const [claimType, setClaimType] = useState("claim");
  const [claimStatus, setClaimStatus] = useState("draft");
  const [statement, setStatement] = useState("");
  const [rationale, setRationale] = useState("");
  const [knowledgeType, setKnowledgeType] = useState("synthesis");
  const [knowledgeStatus, setKnowledgeStatus] = useState("draft");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedKind, setSavedKind] = useState<"claim" | "knowledge" | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      if (!discussionId) {
        setError("Choose a discussion before building Library knowledge.");
        setLoading(false);
        return;
      }

      const { data, error: loadError } = await supabase
        .from("discussions")
        .select("id, title, topic, body")
        .eq("id", discussionId)
        .single();

      if (cancelled) return;
      if (loadError || !data) {
        setError("This discussion is unavailable.");
        setLoading(false);
        return;
      }

      const row = data as Discussion;
      setDiscussion(row);
      setBodyHash(await sha256(row.body ?? ""));
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [discussionId]);

  const selectionValid = useMemo(
    () => Boolean(selection && selection.text.length >= 20 && selection.text.length <= 4000),
    [selection]
  );

  function captureSelection() {
    const element = textareaRef.current;
    if (!element) return;
    const start = element.selectionStart;
    const end = element.selectionEnd;
    const text = element.value.slice(start, end);
    setSelection(text ? { text, start, end } : null);
    setSavedKind(null);
    if (text && !statement.trim()) setStatement(text.slice(0, 2000));
    if (text && !summary.trim()) setSummary(text);
  }

  async function save() {
    if (!discussion || !selection || !selectionValid || !bodyHash) return;
    setSaving(true);
    setError(null);
    setSavedKind(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setError("Sign in to save private Library knowledge.");
      setSaving(false);
      return;
    }

    const payload =
      mode === "claim"
        ? {
            kind: "claim",
            discussionId: discussion.id,
            selectedText: selection.text,
            startOffset: selection.start,
            endOffset: selection.end,
            bodySha256: bodyHash,
            statement,
            claimType,
            status: claimStatus,
            rationale,
          }
        : {
            kind: "knowledge",
            discussionId: discussion.id,
            selectedText: selection.text,
            startOffset: selection.start,
            endOffset: selection.end,
            bodySha256: bodyHash,
            title,
            summary,
            knowledgeType,
            status: knowledgeStatus,
          };

    const response = await fetch("/api/library/discussion-feedback/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(result.error ?? "Unable to save this discussion selection to Library Research.");
      setSaving(false);
      return;
    }

    setSavedKind(mode);
    setSaving(false);
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--loombus-page-bg)] text-[var(--loombus-text)]">
        <Loader2 className="size-6 animate-spin text-[var(--loombus-gold)]" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-6 text-[var(--loombus-text)] sm:px-6 md:pt-20">
      <div className="mx-auto max-w-5xl">
        <header className="border-b border-[var(--loombus-border)] pb-6">
          <Link href={discussion ? `/discussions/${discussion.id}` : "/discussions"} className="inline-flex items-center gap-2 text-sm font-bold text-[var(--loombus-gold)]">
            <ArrowLeft className="size-4" /> Discussion
          </Link>
          <div className="mt-5 flex items-start gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-[var(--loombus-gold-surface)] text-[var(--loombus-gold)]">
              <FlaskConical className="size-5" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight">Discussion → Knowledge</h1>
              <p className="mt-1 max-w-2xl text-sm text-[var(--loombus-text-muted)]">
                Select an exact part of the opening post and turn it into a new private claim or knowledge object. The public discussion is not changed.
              </p>
            </div>
          </div>
        </header>

        {error ? <div role="alert" className="mt-5 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 text-sm">{error}</div> : null}

        {discussion ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
            <section className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
              <p className="text-xs font-black uppercase tracking-[0.15em] text-[var(--loombus-gold)]">{discussion.topic}</p>
              <h2 className="mt-2 text-xl font-black">{discussion.title}</h2>
              <p className="mt-2 text-xs text-[var(--loombus-text-muted)]">Select 20–4000 characters from the canonical opening post below.</p>
              <textarea
                ref={textareaRef}
                readOnly
                value={discussion.body}
                onSelect={captureSelection}
                rows={22}
                className="mt-4 w-full resize-y rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4 text-sm leading-7 outline-none selection:bg-[var(--loombus-gold)] selection:text-black"
                aria-label="Discussion opening post text"
              />
              <div className="mt-3 rounded-2xl bg-[var(--loombus-surface-strong)] p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--loombus-text-subtle)]">Selected passage</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{selection?.text || "Select text above to begin."}</p>
                {selection ? <p className="mt-2 text-[11px] text-[var(--loombus-text-subtle)]">UTF-16 offsets {selection.start}–{selection.end} · {selection.text.length} characters</p> : null}
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
              <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[var(--loombus-surface-strong)] p-1.5">
                <button type="button" onClick={() => setMode("claim")} data-active={mode === "claim"} className="rounded-xl px-3 py-2 text-sm font-black data-[active=true]:bg-[var(--loombus-gold)] data-[active=true]:text-black">Claim</button>
                <button type="button" onClick={() => setMode("knowledge")} data-active={mode === "knowledge"} className="rounded-xl px-3 py-2 text-sm font-black data-[active=true]:bg-[var(--loombus-gold)] data-[active=true]:text-black">Knowledge</button>
              </div>

              {mode === "claim" ? (
                <div className="mt-5 space-y-4">
                  <label className="block text-xs font-black">Statement<textarea value={statement} onChange={(e) => setStatement(e.target.value)} maxLength={2000} rows={5} className="mt-1.5 w-full rounded-2xl border border-[var(--loombus-border)] bg-transparent p-3 text-sm font-normal outline-none" /></label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-xs font-black">Type<select value={claimType} onChange={(e) => setClaimType(e.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-2.5 text-sm font-normal"><option value="claim">Claim</option><option value="question">Question</option><option value="conclusion">Conclusion</option></select></label>
                    <label className="text-xs font-black">Status<select value={claimStatus} onChange={(e) => setClaimStatus(e.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-2.5 text-sm font-normal"><option value="draft">Draft</option><option value="working">Working</option><option value="supported">Supported</option><option value="contested">Contested</option></select></label>
                  </div>
                  <label className="block text-xs font-black">Private rationale<textarea value={rationale} onChange={(e) => setRationale(e.target.value)} maxLength={5000} rows={4} className="mt-1.5 w-full rounded-2xl border border-[var(--loombus-border)] bg-transparent p-3 text-sm font-normal outline-none" /></label>
                </div>
              ) : (
                <div className="mt-5 space-y-4">
                  <label className="block text-xs font-black">Title<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} className="mt-1.5 w-full rounded-xl border border-[var(--loombus-border)] bg-transparent p-2.5 text-sm font-normal outline-none" /></label>
                  <label className="block text-xs font-black">Private summary<textarea value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={10000} rows={6} className="mt-1.5 w-full rounded-2xl border border-[var(--loombus-border)] bg-transparent p-3 text-sm font-normal outline-none" /></label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-xs font-black">Type<select value={knowledgeType} onChange={(e) => setKnowledgeType(e.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-2.5 text-sm font-normal"><option value="synthesis">Synthesis</option><option value="finding">Finding</option><option value="open_question">Open question</option></select></label>
                    <label className="text-xs font-black">Status<select value={knowledgeStatus} onChange={(e) => setKnowledgeStatus(e.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-2.5 text-sm font-normal"><option value="draft">Draft</option><option value="working">Working</option><option value="synthesized">Synthesized</option></select></label>
                  </div>
                </div>
              )}

              <button
                type="button"
                disabled={!selectionValid || saving || (mode === "claim" ? !statement.trim() : !title.trim())}
                onClick={() => void save()}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--loombus-gold)] px-4 py-3 text-sm font-black text-black disabled:opacity-40"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <FlaskConical className="size-4" />}
                Save private {mode}
              </button>

              {savedKind ? (
                <div className="mt-4 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-gold-surface)] p-4 text-sm">
                  <div className="flex items-center gap-2 font-black text-[var(--loombus-gold)]"><Check className="size-4" /> Saved to private Library Research</div>
                  <Link href="/library/research/evidence" className="mt-2 inline-block text-xs font-black text-[var(--loombus-gold)]">Open Evidence & Knowledge →</Link>
                </div>
              ) : null}
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}
