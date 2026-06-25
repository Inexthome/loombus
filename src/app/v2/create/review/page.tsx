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
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

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

  if (Number.isNaN(date.getTime())) {
    return "Saved recently";
  }

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

function FlagPill({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
        enabled
          ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
          : "border-white/10 bg-white/5 text-slate-300"
      }`}
    >
      {label}: {enabled ? "on" : "off"}
    </span>
  );
}

function GateCard({
  title,
  message,
  loading = false,
  payload,
}: {
  title: string;
  message: string;
  loading?: boolean;
  payload?: ShellPayload | null;
}) {
  return (
    <main
      className="fixed inset-0 z-[80] flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white"
      style={{ colorScheme: "dark", backgroundColor: "#020617" }}
    >
      <section className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-slate-900/90 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-blue-500/15 text-blue-200 ring-1 ring-blue-300/20">
            {loading ? <Loader2 className="size-5 animate-spin" /> : <Lock className="size-5" />}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-200">Loombus V2</p>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h1>
          </div>
        </div>

        <p className="text-sm leading-6 text-slate-300 sm:text-base">{message}</p>

        {payload && (
          <div className="mt-5 flex flex-wrap gap-2">
            <FlagPill label="v2_shell" enabled={payload.flags.v2_shell} />
            <FlagPill label="v2_signal_brief" enabled={payload.flags.v2_signal_brief} />
            <FlagPill label="v2_rooms" enabled={payload.flags.v2_rooms} />
          </div>
        )}

        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href="/v2/create"
            className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-slate-200"
          >
            Back to V2 Create
          </Link>
          <Link
            href="/create"
            className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:text-white"
          >
            Open V1 Create
          </Link>
        </div>
      </section>
    </main>
  );
}

export default function V2CreateReviewPage() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [draft, setDraft] = useState<V2CreateDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [copyMessage, setCopyMessage] = useState("");

  const tags = useMemo(() => getTags(draft?.tags ?? null), [draft?.tags]);
  const hasDraftContent = Boolean(
    draft?.title?.trim() || draft?.topic?.trim() || draft?.body?.trim() || tags.length > 0
  );

  async function copyReviewDraft() {
    if (!draft) return;

    const reviewText = [
      `Title: ${draft.title?.trim() || "Untitled signal"}`,
      `Topic: ${draft.topic?.trim() || "Not selected"}`,
      `Mode: ${getModeLabel(draft.mode)}`,
      tags.length > 0 ? `Tags: ${tags.join(", ")}` : null,
      "",
      draft.body?.trim() || "No body text yet.",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await navigator.clipboard.writeText(reviewText);
      setCopyMessage("Review draft copied. Paste it into V1 Create when you are ready to publish.");
    } catch {
      setCopyMessage("Unable to copy from this browser. You can manually copy the review text.");
    }
  }

  async function loadReview() {
    setLoading(true);
    setMessage("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const userId = sessionData.session?.user.id;
      const response = await fetch("/api/v2/shell", {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      const nextPayload = (await response.json().catch(() => getDefaultShellPayload())) as ShellPayload;

      setPayload(nextPayload);

      if (!userId || !accessToken) {
        return;
      }

      if (!nextPayload.configured || !nextPayload.flags.v2_shell || nextPayload.version !== "v2") {
        return;
      }

      const { data: draftRow, error } = await supabase
        .from("loombus_v2_create_drafts")
        .select("id, title, topic, body, tags, mode, updated_at")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        setMessage("Draft storage is not available. Confirm the V2 draft migration is applied before reviewing drafts.");
        return;
      }

      setDraft((draftRow as V2CreateDraft | null) ?? null);
    } catch {
      setPayload(getDefaultShellPayload());
      setMessage("Unable to load the V2 review preview. V1 Create remains available.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReview();

    const { data } = supabase.auth.onAuthStateChange(() => {
      loadReview();
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <GateCard
        title="Checking V2 review access"
        message="Loombus is loading your private V2 draft review preview."
        loading
      />
    );
  }

  if (!payload?.authenticated) {
    return (
      <GateCard
        title="Sign in required"
        message="The V2 Create review preview is internal-only right now. Sign in first so Loombus can check your v2_shell access."
        payload={payload}
      />
    );
  }

  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") {
    return (
      <GateCard
        title="V2 Create review is not enabled"
        message="This account is not currently allowed through the v2_shell flag. Public users remain on the V1 Create experience."
        payload={payload}
      />
    );
  }

  return (
    <main
      className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#07111f] text-white"
      style={{ colorScheme: "dark", backgroundColor: "#07111f" }}
    >
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.26),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(212,175,55,0.18),_transparent_32%)]" />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-6 text-white sm:px-6 lg:px-8">
        <header className="mb-6 rounded-[2rem] border border-white/10 bg-slate-950/75 p-5 text-white shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-6">
          <Link href="/v2/create" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-200 transition hover:text-white">
            <ArrowLeft className="size-4" />
            Back to V2 Create
          </Link>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-200">Loombus V2 Review Preview</p>
              <h1 className="mt-2 text-4xl font-bold tracking-tight text-white sm:text-5xl">Review before publishing.</h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
                This screen reviews your private V2 draft only. It does not publish to the live discussions table.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <FlagPill label="v2_shell" enabled={payload.flags.v2_shell} />
              <FlagPill label="v2_signal_brief" enabled={payload.flags.v2_signal_brief} />
              <FlagPill label="v2_rooms" enabled={payload.flags.v2_rooms} />
            </div>
          </div>
        </header>

        {message && (
          <div className="mb-5 rounded-2xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm font-medium text-amber-100">
            {message}
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <article className="rounded-[2rem] border border-white/10 bg-slate-950/75 p-5 text-white shadow-xl shadow-black/20 backdrop-blur-xl sm:p-6">
            {!draft || !hasDraftContent ? (
              <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-6 text-slate-300">
                No private V2 draft is ready to review yet. Return to V2 Create and start a draft first.
              </div>
            ) : (
              <>
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <span className="rounded-full border border-blue-300/20 bg-blue-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-blue-100">
                    {draft.topic?.trim() || "No topic selected"}
                  </span>
                  <span className="text-xs text-slate-400">Saved {formatDraftTime(draft.updated_at)}</span>
                </div>

                <h2 className="text-3xl font-bold tracking-tight text-white">
                  {draft.title?.trim() || "Untitled signal"}
                </h2>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-300">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    {getModeLabel(draft.mode)}
                  </span>
                  {tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                      #{tag}
                    </span>
                  ))}
                </div>

                <div className="mt-6 whitespace-pre-wrap rounded-3xl border border-white/10 bg-slate-950/80 p-5 text-base leading-8 text-slate-200">
                  {draft.body?.trim() || "No body text yet."}
                </div>
              </>
            )}
          </article>

          <aside className="space-y-4">
            <section className="rounded-[2rem] border border-emerald-400/25 bg-emerald-400/10 p-5 text-white shadow-xl shadow-black/20 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <ShieldCheck className="size-5 text-emerald-200" />
                <h2 className="font-bold text-emerald-100">Review only</h2>
              </div>
              <p className="mt-4 text-sm leading-6 text-emerald-50/80">
                This page does not publish, submit, or write to the live discussions table. It only reads your private V2 draft.
              </p>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-slate-950/75 p-5 text-white shadow-xl shadow-black/20 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="size-5 text-blue-200" />
                <h2 className="font-bold text-white">Before publishing later</h2>
              </div>
              <div className="mt-4 space-y-2 text-sm text-slate-300">
                <p>Title: {draft?.title?.trim() ? "Ready" : "Needed"}</p>
                <p>Topic: {draft?.topic?.trim() ? "Ready" : "Needed"}</p>
                <p>Body: {(draft?.body?.trim().length ?? 0) >= 40 ? "Ready" : "Needs more context"}</p>
                <p>Mode: {getModeLabel(draft?.mode ?? null)}</p>
              </div>
            </section>

            <section className="rounded-[2rem] border border-[#d4af37]/25 bg-[#d4af37]/10 p-5 text-white shadow-xl shadow-black/20 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <Sparkles className="size-5 text-[#f7d56d]" />
                <h2 className="font-bold text-[#f7d56d]">Next step later</h2>
              </div>
              <p className="mt-4 text-sm leading-6 text-[#fff3c4]">
                A future PR can add a guarded V2 publish action after this review step is fully validated.
              </p>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-slate-950/75 p-5 text-white shadow-xl shadow-black/20 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <FileText className="size-5 text-blue-200" />
                <h2 className="font-bold text-white">Actions</h2>
              </div>
              <div className="mt-4 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={copyReviewDraft}
                  disabled={!draft || !hasDraftContent}
                  className="inline-flex appearance-none items-center justify-center gap-2 rounded-2xl border border-blue-300/40 bg-blue-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:border-blue-300/20 disabled:bg-blue-500/50 disabled:text-white/70"
                >
                  <ClipboardCopy className="size-4" />
                  Copy review draft
                </button>
                <Link
                  href="/v2/create"
                  className="rounded-2xl border border-white/10 px-4 py-2 text-center text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:text-white"
                >
                  Edit V2 draft
                </Link>
                <Link
                  href="/create"
                  className="rounded-2xl border border-white/10 px-4 py-2 text-center text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:text-white"
                >
                  Open V1 Create
                </Link>
              </div>
              {copyMessage && <p className="mt-3 text-xs leading-5 text-slate-300">{copyMessage}</p>}
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
