"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCopy,
  FileText,
  Loader2,
  Lock,
  Send,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { DISCUSSION_TOPICS, type DiscussionTopic } from "@/lib/discussion-topics";

type FeatureFlags = {
  v2_shell: boolean;
  v2_signal_brief: boolean;
  v2_rooms: boolean;
};

type ShellPayload = {
  version: "v1" | "v2";
  configured: boolean;
  authenticated: boolean;
  flags: FeatureFlags;
};

type V2CreateDraft = {
  id: string;
  title: string | null;
  topic: string | null;
  body: string | null;
  tags: string | null;
  mode: string | null;
  updated_at: string | null;
};

type ParsedDraftBody = {
  body: string;
  purpose: string;
  realityLens: string;
  purposeLane: string;
};

const DEFAULT_FLAGS: FeatureFlags = {
  v2_shell: false,
  v2_signal_brief: false,
  v2_rooms: false,
};

const MODE_LABELS: Record<string, string> = {
  open_discussion: "Open discussion",
  debate: "Debate",
  research_question: "Research question",
  problem_solving: "Problem solving",
};

const LOOMBUS_GOLD = "#d6a84f";

function getDefaultShellPayload(): ShellPayload {
  return {
    version: "v1",
    configured: false,
    authenticated: false,
    flags: DEFAULT_FLAGS,
  };
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

function getModeLabel(mode: string | null) {
  return MODE_LABELS[mode ?? ""] ?? "Open discussion";
}

function getTags(tags: string | null) {
  return (tags ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function isValidDiscussionTopic(value: string | null | undefined): value is DiscussionTopic {
  return DISCUSSION_TOPICS.includes((value ?? "").trim() as DiscussionTopic) && (value ?? "").trim().toLowerCase() !== "other";
}

function parseDraftBody(value: string | null): ParsedDraftBody {
  const raw = value ?? "";
  const parts = raw.split(/\n\n/);
  const firstBlock = parts[0] ?? "";
  const rest = parts.slice(1).join("\n\n");
  const metadataLines = firstBlock.split("\n").filter((line) => line.trim().length > 0);
  const hasMetadata = metadataLines.length > 0 && metadataLines.every((line) => /^(Purpose|Reality Lens|Purpose Lane):\s*/.test(line));

  if (!hasMetadata) {
    return { body: raw, purpose: "", realityLens: "", purposeLane: "" };
  }

  const metadata: Record<string, string> = {};
  for (const line of metadataLines) {
    const [key, ...valueParts] = line.split(":");
    metadata[key.trim()] = valueParts.join(":").trim();
  }

  return {
    body: rest,
    purpose: metadata.Purpose ?? "",
    realityLens: metadata["Reality Lens"] ?? "",
    purposeLane: metadata["Purpose Lane"] ?? "",
  };
}

function getDraftReadiness(draft: V2CreateDraft | null, tags: string[], parsedBody: ParsedDraftBody) {
  const checks = [
    { label: "Title is clear", done: (draft?.title?.trim().length ?? 0) >= 8, helper: "Use a title long enough to frame the signal." },
    { label: "Topic is valid", done: isValidDiscussionTopic(draft?.topic), helper: "Choose a valid Loombus topic before publishing." },
    { label: "Body has context", done: parsedBody.body.trim().length >= 40, helper: "Add enough context for useful replies." },
    { label: "Mode is selected", done: Boolean(draft?.mode), helper: "Choose how the discussion should be structured." },
    { label: "Framing reviewed", done: Boolean(parsedBody.purpose.trim() || parsedBody.realityLens.trim() || parsedBody.purposeLane.trim()), helper: "Add a purpose, reality lens, or purpose lane before publishing." },
    { label: "Tags reviewed", done: tags.length <= 6, helper: "Keep tags focused. Six or fewer is recommended." },
  ];
  const completed = checks.filter((check) => check.done).length;
  return { checks, completed, total: checks.length, ready: completed === checks.length };
}

function GateCard({ title, message, loading = false }: { title: string; message: string; loading?: boolean }) {
  return (
    <main className="fixed inset-0 z-[80] flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white" style={{ colorScheme: "dark", backgroundColor: "#020617" }}>
      <section className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-slate-900/90 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-amber-500/15 text-amber-200 ring-1 ring-amber-300/20">
            {loading ? <Loader2 className="size-5 animate-spin" /> : <Lock className="size-5" />}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-200">Loombus</p>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h1>
          </div>
        </div>
        <p className="text-sm leading-6 text-slate-300 sm:text-base">{message}</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/v2/create" className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-slate-200">
            Back to Create
          </Link>
        </div>
      </section>
    </main>
  );
}

export default function CreateReviewClientPage() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [draft, setDraft] = useState<V2CreateDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [publishMessage, setPublishMessage] = useState("");
  const [reviewAcknowledged, setReviewAcknowledged] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const tags = useMemo(() => getTags(draft?.tags ?? null), [draft?.tags]);
  const parsedBody = useMemo(() => parseDraftBody(draft?.body ?? null), [draft?.body]);
  const readiness = useMemo(() => getDraftReadiness(draft, tags, parsedBody), [draft, parsedBody, tags]);
  const hasDraftContent = Boolean(draft?.title?.trim() || draft?.topic?.trim() || parsedBody.body.trim() || tags.length > 0);
  const publishPrepared = readiness.ready && reviewAcknowledged && hasDraftContent;

  async function copyReviewDraft() {
    if (!draft) return;
    const reviewText = [
      `Title: ${draft.title?.trim() || "Untitled signal"}`,
      `Topic: ${draft.topic?.trim() || "Not selected"}`,
      parsedBody.realityLens ? `Reality Lens: ${parsedBody.realityLens}` : null,
      parsedBody.purposeLane ? `Purpose Lane: ${parsedBody.purposeLane}` : null,
      `Mode: ${getModeLabel(draft.mode)}`,
      parsedBody.purpose ? `Purpose: ${parsedBody.purpose}` : null,
      tags.length > 0 ? `Tags: ${tags.join(", ")}` : null,
      "",
      parsedBody.body.trim() || "No body text yet.",
    ].filter(Boolean).join("\n");
    try {
      await navigator.clipboard.writeText(reviewText);
      setCopyMessage("Draft copied.");
    } catch {
      setCopyMessage("Unable to copy from this browser. You can manually copy the review text.");
    }
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
          realityLens: parsedBody.realityLens,
          purposeLane: parsedBody.purposeLane,
          discussionType: draft.mode ?? "open_discussion",
          discussionMetadata: parsedBody.purpose ? { purpose: parsedBody.purpose } : {},
          body: parsedBody.body,
          tags: draft.tags ?? "",
          pastedCharacterCount: 0,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setPublishMessage(result.error ?? "Unable to publish this draft.");
        return;
      }
      if (draft.id) {
        await supabase.from("loombus_v2_create_drafts").delete().eq("id", draft.id).eq("user_id", session.user.id);
      }
      const discussionId = result.discussion?.id;
      window.location.href = discussionId ? `/v2/discussions/${discussionId}` : "/v2/discussions";
    } catch {
      setPublishMessage("Unable to publish this draft safely. Your draft was not cleared.");
    } finally {
      setPublishing(false);
    }
  }

  async function loadReview() {
    setLoading(true);
    setMessage("");
    setPublishMessage("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const userId = sessionData.session?.user.id;
      const response = await fetch("/api/v2/shell", { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined });
      const nextPayload = (await response.json().catch(() => getDefaultShellPayload())) as ShellPayload;
      setPayload(nextPayload);
      if (!userId || !accessToken) return;
      if (!nextPayload.configured || !nextPayload.flags.v2_shell || nextPayload.version !== "v2") return;
      const { data: draftRow, error } = await supabase
        .from("loombus_v2_create_drafts")
        .select("id, title, topic, body, tags, mode, updated_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) {
        setMessage("Draft storage is not available. Confirm draft storage before reviewing drafts.");
        return;
      }
      setDraft((draftRow as V2CreateDraft | null) ?? null);
      setReviewAcknowledged(false);
    } catch {
      setPayload(getDefaultShellPayload());
      setMessage("Unable to load the review page.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReview();
    const { data } = supabase.auth.onAuthStateChange(() => loadReview());
    return () => data.subscription.unsubscribe();
  }, []);

  if (loading) return <GateCard title="Checking review access" message="Loombus is loading your draft review." loading />;
  if (!payload?.authenticated) return <GateCard title="Sign in required" message="Sign in to review and publish your draft." />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") return <GateCard title="Review is unavailable" message="This account cannot access the review flow yet." />;

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#07111f] text-white" style={{ colorScheme: "dark", backgroundColor: "#07111f" }}>
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.2),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(212,175,55,0.2),_transparent_32%)]" />
      <div className="relative z-10 mx-auto max-w-6xl px-4 py-6 text-white sm:px-6 lg:px-8">
        <header className="mb-6 rounded-[2rem] border border-white/10 bg-slate-950/75 p-5 text-white shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-6">
          <Link href="/v2/create" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-200 transition hover:text-white">
            <ArrowLeft className="size-4" />
            Back to Create
          </Link>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-200">Loombus Review</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-white sm:text-5xl">Review before publishing.</h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">Review your draft, confirm the checks, and publish it to the discussion feed.</p>
        </header>

        {message && <div className="mb-5 rounded-2xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm font-medium text-amber-100">{message}</div>}
        {publishMessage && <div className="mb-5 rounded-2xl border border-blue-300/30 bg-blue-300/10 px-4 py-3 text-sm font-medium text-blue-100">{publishMessage}</div>}

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <article className="rounded-[2rem] border border-white/10 bg-slate-950/75 p-5 text-white shadow-xl shadow-black/20 backdrop-blur-xl sm:p-6">
            {!draft || !hasDraftContent ? (
              <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-6 text-slate-300">No draft is ready to review yet. Return to Create and start a draft first.</div>
            ) : (
              <>
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-amber-100">{draft.topic?.trim() || "No topic selected"}</span>
                  <span className="text-xs text-slate-400">Saved {formatDraftTime(draft.updated_at)}</span>
                </div>
                <h2 className="text-3xl font-bold tracking-tight text-white">{draft.title?.trim() || "Untitled signal"}</h2>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-300">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{getModeLabel(draft.mode)}</span>
                  {parsedBody.realityLens && <span className="rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-1 text-violet-100">Reality Lens: {parsedBody.realityLens}</span>}
                  {parsedBody.purposeLane && <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-emerald-100">Purpose Lane: {parsedBody.purposeLane}</span>}
                  {tags.map((tag) => <span key={tag} className="rounded-full border border-white/10 bg-white/5 px-3 py-1">#{tag}</span>)}
                </div>
                {parsedBody.purpose && <div className="mt-5 rounded-3xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-50"><span className="font-bold text-amber-100">Purpose: </span>{parsedBody.purpose}</div>}
                <div className="mt-6 whitespace-pre-wrap rounded-3xl border border-white/10 bg-slate-950/80 p-5 text-base leading-8 text-slate-200">{parsedBody.body.trim() || "No body text yet."}</div>
              </>
            )}
          </article>

          <aside className="space-y-4">
            <section className="rounded-[2rem] border border-amber-300/25 bg-amber-400/10 p-5 text-white shadow-xl shadow-black/20 backdrop-blur-xl">
              <div className="flex items-center gap-3"><Send className="size-5 text-amber-200" /><h2 className="font-bold text-amber-100">Publish preparation</h2></div>
              <div className="mt-4 space-y-2">
                {readiness.checks.map((check) => <div key={check.label} className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm"><div className="flex items-center justify-between gap-3"><span className="font-semibold text-slate-200">{check.label}</span><span className={check.done ? "text-emerald-200" : "text-amber-200"}>{check.done ? "Ready" : "Needed"}</span></div>{!check.done && <p className="mt-1 text-xs leading-5 text-slate-400">{check.helper}</p>}</div>)}
              </div>
              <label className="mt-4 flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/70 p-3 text-sm text-slate-200"><input type="checkbox" checked={reviewAcknowledged} onChange={(event) => setReviewAcknowledged(event.target.checked)} className="mt-1 size-4 accent-amber-500" /><span>I reviewed this draft and understand it will publish to the live discussion feed.</span></label>
              <button type="button" onClick={publishDraft} disabled={!publishPrepared || publishing} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-300/20 bg-amber-500 px-4 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-black/30 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300 disabled:opacity-80">
                {publishing ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                {publishing ? "Publishing..." : publishPrepared ? "Publish live discussion" : "Complete review to publish"}
              </button>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-slate-950/75 p-5 text-white shadow-xl shadow-black/20 backdrop-blur-xl">
              <div className="flex items-center gap-3"><CheckCircle2 className="size-5 text-amber-200" /><h2 className="font-bold text-white">Readiness summary</h2></div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${Math.round((readiness.completed / readiness.total) * 100)}%`, backgroundColor: LOOMBUS_GOLD }} /></div>
              <p className="mt-3 text-sm text-slate-300">{readiness.completed} of {readiness.total} checks ready.</p>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-slate-950/75 p-5 text-white shadow-xl shadow-black/20 backdrop-blur-xl">
              <div className="flex items-center gap-3"><FileText className="size-5 text-amber-200" /><h2 className="font-bold text-white">Actions</h2></div>
              <div className="mt-4 flex flex-col gap-3">
                <button type="button" onClick={copyReviewDraft} disabled={!draft || !hasDraftContent} className="inline-flex appearance-none items-center justify-center gap-2 rounded-2xl border border-amber-300/40 bg-amber-500 px-4 py-2 text-sm font-bold text-slate-950 shadow-lg shadow-black/30 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:border-amber-300/20 disabled:bg-amber-500/50 disabled:text-white/70"><ClipboardCopy className="size-4" />Copy review draft</button>
                <Link href="/v2/create" className="rounded-2xl border border-white/10 px-4 py-2 text-center text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:text-white">Edit draft</Link>
              </div>
              {copyMessage && <p className="mt-3 text-xs leading-5 text-slate-300">{copyMessage}</p>}
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
