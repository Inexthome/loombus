"use client";

import Link from "next/link";
import { ExternalLink, RefreshCw, RotateCcw, Search, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type SourceCandidate = {
  title: string;
  publisher: string;
  url: string;
  publishedAt: string | null;
};

type Candidate = {
  title: string;
  topic: string;
  whyNow: string;
  context: string;
  discussionPrompt: string;
  sources: SourceCandidate[];
};

type WeeklyQuestion = {
  id: string;
  discussion_id: string;
  week_start: string;
  week_end: string;
  category: string;
  why_now: string | null;
  source_context: { sources?: SourceCandidate[]; selection_method?: string; generated_at?: string } | null;
  published_at: string;
  discussions:
    | { id: string; title: string; topic: string; body: string; discussion_status: string; deleted_at: string | null; audience_type: string }
    | Array<{ id: string; title: string; topic: string; body: string; discussion_status: string; deleted_at: string | null; audience_type: string }>
    | null;
};

type LoadPayload = {
  week: { start: string; end: string };
  questions: WeeklyQuestion[];
  model: string;
};

function unwrapDiscussion(question: WeeklyQuestion | undefined) {
  if (!question?.discussions) return null;
  return Array.isArray(question.discussions) ? question.discussions[0] ?? null : question.discussions;
}

async function adminFetch(path: string, init?: RequestInit) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in again to use Admin controls.");
  const response = await fetch(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || "Admin request failed.");
  return payload;
}

export default function QuestionOfWeekAdminClient() {
  const [data, setData] = useState<LoadPayload | null>(null);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<"generate" | "publish" | "manual" | "restore" | null>(null);
  const [message, setMessage] = useState("");
  const [manualDiscussionId, setManualDiscussionId] = useState("");
  const [manualWhyNow, setManualWhyNow] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      setData((await adminFetch("/api/admin/question-of-the-week")) as LoadPayload);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load Question of the Week controls.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const current = useMemo(() => data?.questions.find((question) => question.week_start === data.week.start), [data]);
  const currentDiscussion = unwrapDiscussion(current);
  const currentSources = current?.source_context?.sources ?? [];

  async function generate() {
    setWorking("generate");
    setMessage("");
    try {
      const payload = await adminFetch("/api/admin/question-of-the-week", {
        method: "POST",
        body: JSON.stringify({ action: "generate" }),
      });
      setCandidate(payload.candidate as Candidate);
      setMessage("New candidate generated. Review the framing and every source before publishing.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to generate a candidate.");
    } finally {
      setWorking(null);
    }
  }

  async function publishCandidate() {
    if (!candidate) return;
    setWorking("publish");
    setMessage("");
    try {
      await adminFetch("/api/admin/question-of-the-week", {
        method: "POST",
        body: JSON.stringify({ action: "publish_candidate", candidate }),
      });
      setCandidate(null);
      await load();
      setMessage(current ? "Question of the Week replaced. The previous discussion remains available as a normal discussion." : "Question of the Week published.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to publish the candidate.");
    } finally {
      setWorking(null);
    }
  }

  async function selectExisting() {
    setWorking("manual");
    setMessage("");
    try {
      await adminFetch("/api/admin/question-of-the-week", {
        method: "POST",
        body: JSON.stringify({ action: "select_existing", discussionId: manualDiscussionId.trim(), whyNow: manualWhyNow.trim() }),
      });
      setManualDiscussionId("");
      setManualWhyNow("");
      await load();
      setMessage("Existing public discussion selected as Question of the Week.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to select that discussion.");
    } finally {
      setWorking(null);
    }
  }

  async function restoreCurrentDiscussion() {
    if (!currentDiscussion?.deleted_at) return;
    setWorking("restore");
    setMessage("");
    try {
      await adminFetch("/api/admin/question-of-the-week/restore", {
        method: "POST",
        body: JSON.stringify({ discussionId: currentDiscussion.id }),
      });
      await load();
      setMessage("Question of the Week discussion restored to Discussions with its original thread intact.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to restore this discussion.");
    } finally {
      setWorking(null);
    }
  }

  if (loading && !data) {
    return <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 py-10 text-[color:var(--loombus-text-muted)]">Loading editorial controls…</main>;
  }

  return (
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-8 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="border-b border-[color:var(--loombus-border)] pb-7">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.17em] text-[#CBAB5B]">Loombus Editorial</p>
          <div className="mt-2 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">Question of the Week</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">Review the live weekly question, inspect its provenance, generate a replacement candidate, or manually designate an existing public discussion.</p>
            </div>
            <Link href="/admin" className="text-sm font-semibold text-[#CBAB5B] hover:underline">Back to Admin</Link>
          </div>
        </header>

        {message ? <div className="border-b border-[color:var(--loombus-border)] py-4 text-sm text-[color:var(--loombus-text-muted)]" role="status">{message}</div> : null}

        <section className="border-b border-[color:var(--loombus-border)] py-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--loombus-text-subtle)]">Current editorial window</p>
              <h2 className="mt-1 text-2xl font-semibold">{data ? `${data.week.start} → ${data.week.end}` : "Current week"}</h2>
            </div>
            <button type="button" onClick={() => void load()} className="inline-flex min-h-11 items-center gap-2 border border-[color:var(--loombus-border)] px-4 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CBAB5B]">
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> Refresh
            </button>
          </div>

          {current && currentDiscussion ? (
            <article className="mt-6 border-t border-[color:var(--loombus-border-muted)] pt-6">
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[#CBAB5B]"><span>Current</span><span>·</span><span>{current.category}</span></div>
              <h3 className="mt-3 max-w-4xl text-3xl font-semibold leading-tight tracking-[-0.035em]">{currentDiscussion.title}</h3>
              {current.why_now ? <div className="mt-6"><h4 className="text-sm font-semibold">Why this question now</h4><p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">{current.why_now}</p></div> : null}

              {currentDiscussion.deleted_at ? (
                <div className="mt-6 border border-[#CBAB5B] p-4">
                  <p className="text-sm font-semibold">This Question of the Week is currently removed from the public Discussions feed.</p>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">Restore it to bring back the same discussion UUID, content, replies, views, saves, and weekly designation. No new question is generated.</p>
                  <button
                    type="button"
                    disabled={working !== null}
                    onClick={() => void restoreCurrentDiscussion()}
                    className="mt-4 inline-flex min-h-11 items-center gap-2 border border-[#CBAB5B] px-4 text-sm font-bold text-[#CBAB5B] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CBAB5B]"
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    {working === "restore" ? "Restoring…" : "Restore to Discussions"}
                  </button>
                </div>
              ) : null}

              <div className="mt-6 flex flex-wrap gap-4 text-sm">
                {!currentDiscussion.deleted_at ? <Link href={`/discussions/${current.discussion_id}`} className="inline-flex items-center gap-2 font-semibold text-[#CBAB5B] hover:underline">Open discussion <ExternalLink className="h-4 w-4" aria-hidden="true" /></Link> : null}
                <span className="text-[color:var(--loombus-text-subtle)]">Published {new Date(current.published_at).toLocaleString()}</span>
              </div>
              <div className="mt-7 border-t border-[color:var(--loombus-border-muted)] pt-5">
                <h4 className="text-sm font-semibold">Source provenance</h4>
                {currentSources.length ? <div className="mt-3 divide-y divide-[color:var(--loombus-border-muted)]">{currentSources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="flex items-start justify-between gap-4 py-3 text-sm hover:text-[#CBAB5B]"><span><strong className="block">{source.title || source.publisher}</strong><span className="mt-1 block text-xs text-[color:var(--loombus-text-subtle)]">{source.publisher}{source.publishedAt ? ` · ${source.publishedAt}` : ""}</span></span><ExternalLink className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" /></a>)}</div> : <p className="mt-2 text-sm text-[color:var(--loombus-text-muted)]">This question was manually selected and has no stored AI source set.</p>}
              </div>
            </article>
          ) : <p className="mt-6 text-sm text-[color:var(--loombus-text-muted)]">No Question of the Week has been published for this window yet.</p>}
        </section>

        <section className="border-b border-[color:var(--loombus-border)] py-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--loombus-text-subtle)]">AI editorial candidate</p>
              <h2 className="mt-1 text-2xl font-semibold">Research and review before publishing</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">Generation uses live web search and the same sourcing requirements as the scheduled publisher. Nothing is published until you approve the candidate here.</p>
            </div>
            <button type="button" disabled={working !== null} onClick={() => void generate()} className="inline-flex min-h-11 items-center justify-center gap-2 bg-[#CBAB5B] px-5 text-sm font-bold text-black disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CBAB5B]"><Sparkles className="h-4 w-4" aria-hidden="true" />{working === "generate" ? "Researching…" : candidate ? "Regenerate candidate" : "Generate candidate"}</button>
          </div>

          {candidate ? <article className="mt-7 border-t border-[color:var(--loombus-border-muted)] pt-6">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#CBAB5B]">{candidate.topic}</p>
            <h3 className="mt-2 text-3xl font-semibold leading-tight tracking-[-0.035em]">{candidate.title}</h3>
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div><h4 className="text-sm font-semibold">Why now</h4><p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">{candidate.whyNow}</p></div>
              <div><h4 className="text-sm font-semibold">Discussion direction</h4><p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">{candidate.discussionPrompt}</p></div>
            </div>
            <div className="mt-6"><h4 className="text-sm font-semibold">Context</h4><p className="mt-2 max-w-4xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">{candidate.context}</p></div>
            <div className="mt-6"><h4 className="text-sm font-semibold">Sources to inspect</h4><div className="mt-2 divide-y divide-[color:var(--loombus-border-muted)]">{candidate.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="flex items-start justify-between gap-4 py-3 text-sm hover:text-[#CBAB5B]"><span><strong className="block">{source.title}</strong><span className="mt-1 block text-xs text-[color:var(--loombus-text-subtle)]">{source.publisher}{source.publishedAt ? ` · ${source.publishedAt}` : ""}</span></span><ExternalLink className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" /></a>)}</div></div>
            <div className="mt-7 flex flex-wrap items-center gap-3"><button type="button" disabled={working !== null} onClick={() => void publishCandidate()} className="min-h-11 bg-[#CBAB5B] px-5 text-sm font-bold text-black disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CBAB5B]">{working === "publish" ? "Publishing…" : current ? "Replace current question" : "Publish question"}</button><button type="button" onClick={() => setCandidate(null)} className="min-h-11 border border-[color:var(--loombus-border)] px-5 text-sm font-semibold">Discard candidate</button></div>
          </article> : null}
        </section>

        <section className="border-b border-[color:var(--loombus-border)] py-8">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--loombus-text-subtle)]">Manual editorial override</p>
          <h2 className="mt-1 text-2xl font-semibold">Use an existing public discussion</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">This changes only the weekly designation. The previous weekly discussion remains intact and the selected discussion keeps its existing content and replies.</p>
          <div className="mt-5 grid gap-4">
            <label className="grid gap-2 text-sm font-semibold"><span>Discussion UUID</span><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--loombus-text-subtle)]" aria-hidden="true" /><input value={manualDiscussionId} onChange={(event) => setManualDiscussionId(event.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" className="min-h-12 w-full border border-[color:var(--loombus-border)] bg-transparent pl-10 pr-3 font-mono text-sm outline-none focus:border-[#CBAB5B]" /></div></label>
            <label className="grid gap-2 text-sm font-semibold"><span>Why this question now</span><textarea value={manualWhyNow} onChange={(event) => setManualWhyNow(event.target.value)} rows={4} maxLength={700} placeholder="Explain why this existing discussion should be the current Question of the Week." className="w-full resize-y border border-[color:var(--loombus-border)] bg-transparent p-3 text-sm font-normal leading-6 outline-none focus:border-[#CBAB5B]" /></label>
            <div><button type="button" disabled={working !== null || !manualDiscussionId.trim() || manualWhyNow.trim().length < 40} onClick={() => void selectExisting()} className="min-h-11 border border-[#CBAB5B] px-5 text-sm font-bold text-[#CBAB5B] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CBAB5B]">{working === "manual" ? "Applying…" : current ? "Replace with this discussion" : "Select this discussion"}</button></div>
          </div>
        </section>

        <section className="py-8">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--loombus-text-subtle)]">Recent history</p>
          <div className="mt-3 divide-y divide-[color:var(--loombus-border-muted)] border-t border-[color:var(--loombus-border-muted)]">{(data?.questions ?? []).map((question) => { const discussion = unwrapDiscussion(question); return <div key={question.id} className="grid gap-2 py-4 sm:grid-cols-[9rem_minmax(0,1fr)_auto] sm:items-center"><span className="text-xs text-[color:var(--loombus-text-subtle)]">{question.week_start}</span><span className="text-sm font-semibold">{discussion?.title ?? "Unavailable discussion"}</span>{discussion && !discussion.deleted_at ? <Link href={`/discussions/${question.discussion_id}`} className="text-xs font-semibold text-[#CBAB5B] hover:underline">Open</Link> : <span className="text-xs font-semibold text-[color:var(--loombus-text-subtle)]">Removed</span>}</div>; })}</div>
        </section>
      </div>
    </main>
  );
}
