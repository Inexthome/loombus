"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCopy,
  FileText,
  Loader2,
  Send,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { DISCUSSION_TOPICS, type DiscussionTopic } from "@/lib/discussion-topics";

type DraftRow = {
  id: string;
  title: string | null;
  topic: string | null;
  reality_lens: string | null;
  purpose_lane: string | null;
  body: string | null;
  updated_at: string | null;
};

type ParsedDraft = {
  body: string;
  purpose: string;
  mode: string;
  tags: string;
};

const LOOMBUS_GOLD = "#d6a84f";
const LOCAL_CREATE_DRAFT_KEY = "loombus:create:v2-local-draft";

const MODE_LABELS: Record<string, string> = {
  open_discussion: "Open discussion",
  debate: "Debate",
  research_question: "Research question",
  problem_solving: "Problem solving",
};

function readLocalDraft(): DraftRow | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(LOCAL_CREATE_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftRow;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      id: parsed.id || "local-create-draft",
      title: parsed.title ?? "",
      topic: parsed.topic ?? "",
      reality_lens: parsed.reality_lens ?? "",
      purpose_lane: parsed.purpose_lane ?? "",
      body: parsed.body ?? "",
      updated_at: parsed.updated_at ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function clearLocalDraft() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(LOCAL_CREATE_DRAFT_KEY);
  }
}

function formatDraftTime(value: string | null) {
  if (!value) return "Not saved yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Saved recently";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getModeLabel(mode: string) {
  return MODE_LABELS[mode] ?? "Open discussion";
}

function getTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function isValidDiscussionTopic(value: string | null | undefined): value is DiscussionTopic {
  return DISCUSSION_TOPICS.includes((value ?? "").trim() as DiscussionTopic);
}

function parseDraftBody(value: string | null | undefined): ParsedDraft {
  const raw = value ?? "";
  const parts = raw.split(/\n\n/);
  const firstBlock = parts[0] ?? "";
  const rest = parts.slice(1).join("\n\n");
  const metadataLines = firstBlock.split("\n").filter((line) => line.trim().length > 0);
  const hasMetadata = metadataLines.length > 0 && metadataLines.every((line) => /^(Purpose|Mode|Tags):\s*/.test(line));

  if (!hasMetadata) {
    return { body: raw, purpose: "", mode: "open_discussion", tags: "" };
  }

  const metadata: Record<string, string> = {};
  for (const line of metadataLines) {
    const [key, ...valueParts] = line.split(":");
    metadata[key.trim()] = valueParts.join(":").trim();
  }

  return {
    body: rest,
    purpose: metadata.Purpose ?? "",
    mode: metadata.Mode ?? "open_discussion",
    tags: metadata.Tags ?? "",
  };
}

function getReadiness(draft: DraftRow | null, parsed: ParsedDraft, tags: string[]) {
  const checks = [
    { label: "Title is clear", done: (draft?.title?.trim().length ?? 0) >= 8, helper: "Use a title long enough to frame the signal." },
    { label: "Topic is valid", done: isValidDiscussionTopic(draft?.topic), helper: "Choose a valid Loombus topic before publishing." },
    { label: "Body has context", done: parsed.body.trim().length >= 40, helper: "Add enough context for useful replies." },
    { label: "Mode is selected", done: Boolean(parsed.mode), helper: "Choose how the discussion should be structured." },
    { label: "Framing reviewed", done: Boolean(parsed.purpose.trim() || draft?.reality_lens?.trim() || draft?.purpose_lane?.trim()), helper: "Add a purpose, reality lens, or purpose lane before publishing." },
    { label: "Tags reviewed", done: tags.length <= 6, helper: "Keep tags focused. Six or fewer is recommended." },
  ];
  const completed = checks.filter((check) => check.done).length;
  return { checks, completed, total: checks.length, ready: completed === checks.length };
}

export default function CreateReviewClientPage() {
  const [draft, setDraft] = useState<DraftRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [publishMessage, setPublishMessage] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const parsed = useMemo(() => parseDraftBody(draft?.body), [draft?.body]);
  const tags = useMemo(() => getTags(parsed.tags), [parsed.tags]);
  const readiness = useMemo(() => getReadiness(draft, parsed, tags), [draft, parsed, tags]);
  const hasDraftContent = Boolean(draft?.title?.trim() || parsed.body.trim() || tags.length > 0);
  const publishPrepared = readiness.ready && acknowledged && hasDraftContent;
  const isLocalDraft = draft?.id === "local-create-draft";

  useEffect(() => {
    async function loadDraft() {
      setLoading(true);
      setMessage("");
      const localDraft = readLocalDraft();
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        if (localDraft) {
          setDraft(localDraft);
          setMessage("Using a local draft. Sign in again before publishing.");
        } else {
          window.location.href = "/login";
        }
        setLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/discussion-drafts", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const result = await response.json().catch(() => ({}));

        if (response.ok && result.draft) {
          setDraft(result.draft as DraftRow);
          setAcknowledged(false);
          return;
        }

        if (localDraft) {
          setDraft(localDraft);
          setMessage(response.ok ? "Using your local draft." : "Server draft storage is unavailable. Using your local draft.");
          setAcknowledged(false);
          return;
        }

        if (!response.ok) {
          setMessage(result.error ?? "Unable to load this draft.");
        }
        setDraft(null);
      } catch {
        if (localDraft) {
          setDraft(localDraft);
          setMessage("Server draft storage is unavailable. Using your local draft.");
        } else {
          setMessage("Unable to load the review page.");
        }
      } finally {
        setLoading(false);
      }
    }

    void loadDraft();
  }, []);

  async function copyReviewDraft() {
    if (!draft) return;
    const reviewText = [
      `Title: ${draft.title?.trim() || "Untitled discussion"}`,
      `Topic: ${draft.topic?.trim() || "Not selected"}`,
      draft.reality_lens ? `Reality Lens: ${draft.reality_lens}` : null,
      draft.purpose_lane ? `Purpose Lane: ${draft.purpose_lane}` : null,
      `Mode: ${getModeLabel(parsed.mode)}`,
      parsed.purpose ? `Purpose: ${parsed.purpose}` : null,
      tags.length > 0 ? `Tags: ${tags.join(", ")}` : null,
      "",
      parsed.body.trim() || "No body text yet.",
    ].filter(Boolean).join("\n");

    await navigator.clipboard.writeText(reviewText);
    setCopyMessage("Draft copied.");
  }

  async function publishDraft() {
    setPublishMessage("");
    if (!draft || !hasDraftContent) {
      setPublishMessage("No draft is ready to publish.");
      return;
    }
    if (!publishPrepared) {
      setPublishMessage("Review the checks and confirm the acknowledgment before publishing.");
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) {
      window.location.href = "/login";
      return;
    }

    setPublishing(true);
    try {
      const response = await fetch("/api/discussions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          title: draft.title ?? "",
          topic: draft.topic ?? "",
          realityLens: draft.reality_lens ?? "",
          purposeLane: draft.purpose_lane ?? "",
          discussionType: parsed.mode || "open_discussion",
          discussionMetadata: parsed.purpose ? { purpose: parsed.purpose } : {},
          body: parsed.body,
          tags: parsed.tags,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setPublishMessage(result.error ?? "Unable to publish this draft.");
        return;
      }

      clearLocalDraft();
      if (!isLocalDraft) {
        await fetch("/api/discussion-drafts", {
          method: "DELETE",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ draftId: draft.id }),
        }).catch(() => null);
      }

      const discussionId = result.discussion?.id;
      window.location.href = discussionId ? `/discussions/${discussionId}` : "/discussions";
    } catch {
      setPublishMessage("Unable to publish this draft safely. Your draft was not cleared.");
    } finally {
      setPublishing(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 py-10 text-[var(--loombus-text)]">
        <section className="mx-auto max-w-3xl rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6">
          <p className="text-sm font-semibold text-[var(--loombus-text-muted)]">Loading draft review...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[var(--loombus-text)] sm:px-6 lg:px-8">
      <section className="mx-auto max-w-6xl">
        <header className="mb-6 rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-sm sm:p-6">
          <Link href="/create" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--loombus-text-muted)] transition hover:text-[var(--loombus-text)]">
            <ArrowLeft className="size-4" />
            Back to Create
          </Link>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--loombus-text-subtle)]">Loombus Review</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-[var(--loombus-text)] sm:text-5xl">Review before publishing.</h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--loombus-text-muted)] sm:text-base">Review your autosaved draft, confirm the checks, and publish it to the discussion feed.</p>
        </header>

        {message && <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">{message}</div>}
        {publishMessage && <div className="mb-5 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 text-sm font-medium text-[var(--loombus-text-muted)]">{publishMessage}</div>}

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <article className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-sm sm:p-6">
            {!draft || !hasDraftContent ? (
              <div className="rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] p-6 text-[var(--loombus-text-muted)]">No draft is ready to review yet. Return to Create and start a draft first.</div>
            ) : (
              <>
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-amber-800">{draft.topic?.trim() || "No topic selected"}</span>
                  <span className="text-xs text-[var(--loombus-text-subtle)]">Saved {formatDraftTime(draft.updated_at)}</span>
                </div>
                <h2 className="text-3xl font-black tracking-tight text-[var(--loombus-text)]">{draft.title?.trim() || "Untitled discussion"}</h2>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-[var(--loombus-text-muted)]">
                  <span className="rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-3 py-1">{getModeLabel(parsed.mode)}</span>
                  {draft.reality_lens && <span className="rounded-full bg-violet-50 px-3 py-1 text-violet-700">Reality Lens: {draft.reality_lens}</span>}
                  {draft.purpose_lane && <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">Purpose Lane: {draft.purpose_lane}</span>}
                  {tags.map((tag) => <span key={tag} className="rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-3 py-1">#{tag}</span>)}
                </div>
                {parsed.purpose && <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><span className="font-bold">Purpose: </span>{parsed.purpose}</div>}
                <div className="mt-6 whitespace-pre-wrap rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] p-5 text-base leading-8 text-[var(--loombus-text-muted)]">{parsed.body.trim() || "No body text yet."}</div>
              </>
            )}
          </article>

          <aside className="space-y-4">
            <section className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-sm">
              <div className="flex items-center gap-3"><Send className="size-5 text-amber-700" /><h2 className="font-black text-[var(--loombus-text)]">Publish preparation</h2></div>
              <div className="mt-4 space-y-2">
                {readiness.checks.map((check) => <div key={check.label} className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-3 py-2 text-sm"><div className="flex items-center justify-between gap-3"><span className="font-semibold text-[var(--loombus-text)]">{check.label}</span><span className={check.done ? "text-emerald-600" : "text-amber-700"}>{check.done ? "Ready" : "Needed"}</span></div>{!check.done && <p className="mt-1 text-xs leading-5 text-[var(--loombus-text-muted)]">{check.helper}</p>}</div>)}
              </div>
              <label className="mt-4 flex items-start gap-3 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] p-3 text-sm text-[var(--loombus-text-muted)]"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} className="mt-1 size-4 accent-amber-500" /><span>I reviewed this draft and understand it will publish to the live discussion feed.</span></label>
              <button type="button" onClick={publishDraft} disabled={!publishPrepared || publishing} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-[var(--loombus-surface-muted)] disabled:text-[var(--loombus-text-subtle)] disabled:opacity-80">
                {publishing ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                {publishing ? "Publishing..." : publishPrepared ? "Publish live discussion" : "Complete review to publish"}
              </button>
            </section>

            <section className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-sm">
              <div className="flex items-center gap-3"><CheckCircle2 className="size-5 text-amber-700" /><h2 className="font-black text-[var(--loombus-text)]">Readiness summary</h2></div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--loombus-surface-muted)]"><div className="h-full rounded-full" style={{ width: `${Math.round((readiness.completed / readiness.total) * 100)}%`, backgroundColor: LOOMBUS_GOLD }} /></div>
              <p className="mt-3 text-sm text-[var(--loombus-text-muted)]">{readiness.completed} of {readiness.total} checks ready.</p>
            </section>

            <section className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-sm">
              <div className="flex items-center gap-3"><FileText className="size-5 text-amber-700" /><h2 className="font-black text-[var(--loombus-text)]">Actions</h2></div>
              <div className="mt-4 flex flex-col gap-3">
                <button type="button" onClick={copyReviewDraft} disabled={!draft || !hasDraftContent} className="inline-flex appearance-none items-center justify-center gap-2 rounded-2xl border border-amber-300 bg-amber-500 px-4 py-2 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"><ClipboardCopy className="size-4" />Copy review draft</button>
                <Link href="/create" className="rounded-2xl border border-[var(--loombus-border)] px-4 py-2 text-center text-sm font-semibold text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)]">Edit draft</Link>
              </div>
              {copyMessage && <p className="mt-3 text-xs leading-5 text-[var(--loombus-text-muted)]">{copyMessage}</p>}
            </section>
          </aside>
        </section>
      </section>
    </main>
  );
}
