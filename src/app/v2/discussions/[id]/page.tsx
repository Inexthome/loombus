"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Lock, ShieldCheck } from "lucide-react";
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

type V2Discussion = {
  id: string;
  title: string;
  topic: string;
  original_topic: string | null;
  body: string;
  mode: string;
  tags: string[];
  discussion_metadata: Record<string, unknown> | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type DiscussionPayload = {
  ok?: boolean;
  reason?: string;
  discussion?: V2Discussion | null;
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

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Saved recently";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getModeLabel(mode: string | null | undefined) {
  return MODE_LABELS[mode ?? ""] ?? "Open discussion";
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
          <Link href="/v2/discussions" className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-slate-200">
            Back to V2 Previews
          </Link>
          <Link href="/discussions" className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:text-white">
            Open V1 Discussions
          </Link>
        </div>
      </section>
    </main>
  );
}

export default function V2DiscussionDetailPage() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [discussion, setDiscussion] = useState<V2Discussion | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const discussionId = useMemo(() => {
    if (typeof window === "undefined") return "";
    const segments = window.location.pathname.split("/").filter(Boolean);
    return segments[segments.length - 1] ?? "";
  }, []);

  async function loadDiscussion() {
    setLoading(true);
    setMessage("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      const shellResponse = await fetch("/api/v2/shell", {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      const nextPayload = (await shellResponse.json().catch(() => getDefaultShellPayload())) as ShellPayload;
      setPayload(nextPayload);

      if (!accessToken) {
        return;
      }

      if (!nextPayload.configured || !nextPayload.flags.v2_shell || nextPayload.version !== "v2") {
        return;
      }

      if (!discussionId) {
        setMessage("V2 preview discussion id is missing.");
        return;
      }

      const response = await fetch(`/api/v2/discussions?id=${encodeURIComponent(discussionId)}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const result = (await response.json().catch(() => null)) as DiscussionPayload | null;

      if (!response.ok || !result?.ok || !result.discussion) {
        setMessage(result?.reason ?? "V2 preview discussion could not be loaded.");
        return;
      }

      setDiscussion(result.discussion);
    } catch {
      setPayload(getDefaultShellPayload());
      setMessage("Unable to load this V2 preview discussion safely.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDiscussion();

    const { data } = supabase.auth.onAuthStateChange(() => {
      loadDiscussion();
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return <GateCard title="Loading V2 preview" message="Loombus is checking your private V2 access and preview record." loading />;
  }

  if (!payload?.authenticated) {
    return <GateCard title="Sign in required" message="V2 preview discussions are internal-only. Sign in first so Loombus can verify access." payload={payload} />;
  }

  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") {
    return <GateCard title="V2 preview is not enabled" message="This account is not currently allowed through the v2_shell flag. Public users remain on V1." payload={payload} />;
  }

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#07111f] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.26),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(212,175,55,0.18),_transparent_32%)]" />

      <div className="relative z-10 mx-auto max-w-5xl px-4 py-6 text-white sm:px-6 lg:px-8">
        <header className="mb-6 rounded-[2rem] border border-white/10 bg-slate-950/75 p-5 text-white shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-6">
          <Link href="/v2/discussions" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-200 transition hover:text-white">
            <ArrowLeft className="size-4" />
            Back to V2 Preview Store
          </Link>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-200">Loombus V2 Preview Detail</p>
              <h1 className="mt-2 text-4xl font-bold tracking-tight text-white sm:text-5xl">
                {discussion?.title ?? "V2 preview discussion"}
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
                This page reads a V2 preview record only. It does not route into the live V1 discussion detail page.
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

        {!discussion ? (
          <section className="rounded-[2rem] border border-white/10 bg-slate-950/75 p-6 text-slate-300 shadow-xl shadow-black/20 backdrop-blur-xl">
            No V2 preview discussion is available for this route.
          </section>
        ) : (
          <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <article className="rounded-[2rem] border border-white/10 bg-slate-950/75 p-5 text-white shadow-xl shadow-black/20 backdrop-blur-xl sm:p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <span className="rounded-full border border-blue-300/25 bg-blue-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-blue-100">
                  {discussion.status.replace(/_/g, " ")}
                </span>
                <span className="text-xs text-slate-400">Stored {formatDate(discussion.created_at)}</span>
              </div>

              <h2 className="text-3xl font-bold tracking-tight text-white">{discussion.title}</h2>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-300">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{discussion.topic}</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{getModeLabel(discussion.mode)}</span>
                {discussion.tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    #{tag}
                  </span>
                ))}
              </div>

              <div className="mt-6 whitespace-pre-wrap rounded-3xl border border-white/10 bg-slate-950/80 p-5 text-base leading-8 text-slate-200">
                {discussion.body}
              </div>
            </article>

            <aside className="space-y-4">
              <section className="rounded-[2rem] border border-emerald-400/25 bg-emerald-400/10 p-5 text-white shadow-xl shadow-black/20 backdrop-blur-xl">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="size-5 text-emerald-200" />
                  <h2 className="font-bold text-emerald-100">Private V2 record</h2>
                </div>
                <p className="mt-4 text-sm leading-6 text-emerald-50/80">
                  This record belongs to the V2 preview store and remains separate from the live V1 discussion system.
                </p>
              </section>

              <section className="rounded-[2rem] border border-white/10 bg-slate-950/75 p-5 text-white shadow-xl shadow-black/20 backdrop-blur-xl">
                <h2 className="font-bold text-white">Record details</h2>
                <dl className="mt-4 space-y-3 text-sm text-slate-300">
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Status</dt>
                    <dd className="mt-1">{discussion.status}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Created</dt>
                    <dd className="mt-1">{formatDate(discussion.created_at)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Updated</dt>
                    <dd className="mt-1">{formatDate(discussion.updated_at)}</dd>
                  </div>
                  {discussion.original_topic && discussion.original_topic !== discussion.topic && (
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Original topic</dt>
                      <dd className="mt-1">{discussion.original_topic}</dd>
                    </div>
                  )}
                </dl>
              </section>
            </aside>
          </section>
        )}
      </div>
    </main>
  );
}
