"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Loader2,
  Lock,
  MessageCircle,
  PenLine,
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

type DiscussionMode = "open_discussion" | "debate" | "research_question" | "problem_solving";

const DEFAULT_FLAGS: FeatureFlags = {
  v2_shell: false,
  v2_signal_brief: false,
  v2_rooms: false,
};

const DISCUSSION_MODES: Array<{
  key: DiscussionMode;
  label: string;
  description: string;
}> = [
  {
    key: "open_discussion",
    label: "Open discussion",
    description: "Start a broad but focused discussion around a clear topic.",
  },
  {
    key: "debate",
    label: "Debate",
    description: "Frame opposing positions so replies can compare reasoning directly.",
  },
  {
    key: "research_question",
    label: "Research question",
    description: "Ask for evidence, sources, patterns, and careful uncertainty.",
  },
  {
    key: "problem_solving",
    label: "Problem solving",
    description: "Define a practical problem and invite solution-oriented replies.",
  },
];

function getDefaultShellPayload(): ShellPayload {
  return {
    version: "v1",
    configured: false,
    authenticated: false,
    flags: DEFAULT_FLAGS,
  };
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
    <main className="fixed inset-0 z-[80] flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white">
      <section className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-blue-500/15 text-blue-200 ring-1 ring-blue-300/20">
            {loading ? <Loader2 className="size-5 animate-spin" /> : <Lock className="size-5" />}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-200">Loombus V2</p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
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
            href="/v2"
            className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-slate-200"
          >
            Return to V2 Home
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

export default function V2CreatePage() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [mode, setMode] = useState<DiscussionMode>("open_discussion");
  const [copyMessage, setCopyMessage] = useState("");

  const selectedMode = DISCUSSION_MODES.find((option) => option.key === mode) ?? DISCUSSION_MODES[0];

  const readiness = useMemo(() => {
    const checks = [
      {
        label: "Clear title",
        done: title.trim().length >= 8,
      },
      {
        label: "Topic selected",
        done: topic.trim().length >= 2,
      },
      {
        label: "Body has context",
        done: body.trim().length >= 40,
      },
      {
        label: "Mode selected",
        done: Boolean(mode),
      },
    ];

    const completed = checks.filter((check) => check.done).length;

    return {
      checks,
      completed,
      total: checks.length,
      percent: Math.round((completed / checks.length) * 100),
    };
  }, [body, mode, title, topic]);

  async function copyPreviewDraft() {
    setCopyMessage("");

    const draft = [
      `Title: ${title.trim() || "Untitled signal"}`,
      `Topic: ${topic.trim() || "Not selected"}`,
      `Mode: ${selectedMode?.label ?? "Open discussion"}`,
      tags.trim() ? `Tags: ${tags.trim()}` : null,
      "",
      body.trim() || "No body text yet.",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await navigator.clipboard.writeText(draft);
      setCopyMessage("Draft copied. Paste it into the current V1 composer when ready.");
    } catch {
      setCopyMessage("Unable to copy this draft from the browser. You can still manually copy the fields.");
    }
  }

  async function loadShell() {
    setLoading(true);
    setMessage("");

    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const response = await fetch("/api/v2/shell", {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      const nextPayload = (await response.json().catch(() => getDefaultShellPayload())) as ShellPayload;

      setPayload(nextPayload);
    } catch {
      setPayload(getDefaultShellPayload());
      setMessage("Unable to verify V2 create preview access. Current Loombus remains on V1.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadShell();

    const { data } = supabase.auth.onAuthStateChange(() => {
      loadShell();
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <GateCard
        title="Checking V2 access"
        message="Loombus is verifying whether this account can use the V2 Create preview."
        loading
      />
    );
  }

  if (message) {
    return (
      <GateCard
        title="V2 Create preview check failed safely"
        message={message}
        payload={payload}
      />
    );
  }

  if (!payload?.authenticated) {
    return (
      <GateCard
        title="Sign in required"
        message="The V2 Create preview is internal-only right now. Sign in first so Loombus can check your v2_shell access."
        payload={payload}
      />
    );
  }

  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") {
    return (
      <GateCard
        title="V2 Create preview is not enabled"
        message="This account is not currently allowed through the v2_shell flag. Public users remain on the V1 Create experience."
        payload={payload}
      />
    );
  }

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#07111f] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.26),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(212,175,55,0.18),_transparent_32%)]" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-white/[0.05] p-5 shadow-2xl shadow-black/30 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link href="/v2" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-200 transition hover:text-white">
              <ArrowLeft className="size-4" />
              Back to V2 Home
            </Link>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-200">Loombus V2 Preview</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">Create a signal with structure.</h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
              This is a gated V2 Create preview. It lets you test the structure and flow, but it does not submit posts yet. Use the V1 composer for live posting.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <FlagPill label="v2_shell" enabled={payload.flags.v2_shell} />
            <FlagPill label="v2_signal_brief" enabled={payload.flags.v2_signal_brief} />
            <FlagPill label="v2_rooms" enabled={payload.flags.v2_rooms} />
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center gap-3">
                <PenLine className="size-5 text-blue-200" />
                <h2 className="text-xl font-bold">Signal draft</h2>
              </div>

              <div className="mt-5 grid gap-4">
                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Title</span>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Ask a clear question or frame a useful discussion"
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-300/50"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Topic</span>
                  <input
                    value={topic}
                    onChange={(event) => setTopic(event.target.value)}
                    placeholder="Technology, community, business, health, education..."
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-300/50"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Body</span>
                  <textarea
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    placeholder="Add context, what you are trying to understand, and what kind of replies would be useful."
                    rows={9}
                    className="w-full resize-y rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-300/50"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Optional tags</span>
                  <input
                    value={tags}
                    onChange={(event) => setTags(event.target.value)}
                    placeholder="clarity, ai, jacksonville, policy"
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-300/50"
                  />
                </label>
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center gap-3">
                <MessageCircle className="size-5 text-blue-200" />
                <h2 className="text-xl font-bold">Discussion mode</h2>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {DISCUSSION_MODES.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setMode(option.key)}
                    className={`rounded-3xl border p-4 text-left transition ${
                      mode === option.key
                        ? "border-blue-300/45 bg-blue-500/15 text-white"
                        : "border-white/10 bg-slate-950/45 text-slate-300 hover:border-blue-300/25 hover:bg-blue-500/10"
                    }`}
                  >
                    <span className="text-sm font-bold">{option.label}</span>
                    <span className="mt-2 block text-xs leading-5 text-slate-400">{option.description}</span>
                  </button>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="size-5 text-emerald-200" />
                <h2 className="font-bold">Draft readiness</h2>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-blue-400" style={{ width: `${readiness.percent}%` }} />
              </div>
              <p className="mt-3 text-sm text-slate-300">
                {readiness.completed} of {readiness.total} structure checks complete.
              </p>

              <div className="mt-4 space-y-2">
                {readiness.checks.map((check) => (
                  <div key={check.label} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/45 px-3 py-2 text-sm">
                    <span className="text-slate-300">{check.label}</span>
                    <span className={check.done ? "text-emerald-200" : "text-slate-500"}>{check.done ? "Ready" : "Needed"}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[2rem] border border-[#d4af37]/25 bg-[#d4af37]/10 p-5">
              <div className="flex items-center gap-3">
                <Sparkles className="size-5 text-[#f7d56d]" />
                <h2 className="font-bold text-[#f7d56d]">Preview only</h2>
              </div>
              <p className="mt-4 text-sm leading-6 text-[#fff3c4]">
                This screen does not write to Supabase. Live posting stays on V1 until V2 submission is reviewed and approved.
              </p>
            </section>

            <section className="rounded-[2rem] border border-emerald-400/25 bg-emerald-400/10 p-5">
              <div className="flex items-center gap-3">
                <ShieldCheck className="size-5 text-emerald-200" />
                <h2 className="font-bold text-emerald-100">Safe handoff</h2>
              </div>
              <p className="mt-4 text-sm leading-6 text-emerald-50/80">
                Copy your preview draft, then open the current V1 composer when you are ready to publish.
              </p>
              <div className="mt-4 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={copyPreviewDraft}
                  className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-slate-200"
                >
                  Copy draft
                </button>
                <Link
                  href="/create"
                  className="rounded-2xl border border-white/10 px-4 py-2 text-center text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:text-white"
                >
                  Open V1 Create
                </Link>
              </div>
              {copyMessage && <p className="mt-3 text-xs leading-5 text-emerald-50/80">{copyMessage}</p>}
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center gap-3">
                <FileText className="size-5 text-blue-200" />
                <h2 className="font-bold">Selected mode</h2>
              </div>
              <p className="mt-3 text-sm font-semibold text-white">{selectedMode?.label}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{selectedMode?.description}</p>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
