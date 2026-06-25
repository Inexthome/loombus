"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Clock3,
  Loader2,
  Lock,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
  UserCircle,
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

type V2Discussion = {
  id: string;
  title: string;
  topic: string | null;
  body: string | null;
  created_at: string;
  user_id: string;
  reality_lens: string | null;
  purpose_lane: string | null;
  authorName?: string | null;
  authorUsername?: string | null;
};

const DEFAULT_FLAGS: FeatureFlags = {
  v2_shell: false,
  v2_signal_brief: false,
  v2_rooms: false,
};

function getDefaultShellPayload(): ShellPayload {
  return {
    version: "v1",
    configured: false,
    authenticated: false,
    flags: DEFAULT_FLAGS,
  };
}

function getDiscussionAge(value: string) {
  const createdAt = new Date(value).getTime();

  if (!Number.isFinite(createdAt)) {
    return "Recently";
  }

  const diffMs = Date.now() - createdAt;
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);

  if (diffDays < 7) return `${diffDays}d ago`;

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function getAuthorLabel(discussion: V2Discussion) {
  return (
    discussion.authorName?.trim() ||
    discussion.authorUsername?.trim() ||
    "Loombus member"
  );
}

function getDiscussionPreview(body: string | null) {
  const cleanBody = (body ?? "").replace(/\s+/g, " ").trim();

  if (!cleanBody) {
    return "Open this discussion to review the full signal.";
  }

  return cleanBody.length > 180 ? `${cleanBody.slice(0, 180)}...` : cleanBody;
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
            href="/discussions"
            className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:text-white"
          >
            Open V1 Discussions
          </Link>
        </div>
      </section>
    </main>
  );
}

function DiscussionCard({ discussion }: { discussion: V2Discussion }) {
  return (
    <Link
      href={`/discussions/${discussion.id}`}
      className="block rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 shadow-xl shadow-black/20 transition hover:border-blue-300/35 hover:bg-blue-500/10"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full border border-blue-300/20 bg-blue-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-blue-100">
          {discussion.topic || "Discussion"}
        </span>
        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
          <Clock3 className="size-3.5" />
          {getDiscussionAge(discussion.created_at)}
        </span>
      </div>

      <h2 className="text-2xl font-bold tracking-tight text-white">{discussion.title}</h2>
      <p className="mt-3 text-sm leading-6 text-slate-300">{getDiscussionPreview(discussion.body)}</p>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
        <span className="inline-flex items-center gap-2">
          <UserCircle className="size-4" />
          {getAuthorLabel(discussion)}
        </span>
        <span className="text-xs">
          {[discussion.purpose_lane, discussion.reality_lens].filter(Boolean).join(" · ") || "Open discussion"}
        </span>
      </div>
    </Link>
  );
}

export default function V2DiscussionsPage() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [discussions, setDiscussions] = useState<V2Discussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [discussionLoading, setDiscussionLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");

  const filteredDiscussions = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    if (!cleanQuery) {
      return discussions;
    }

    return discussions.filter((discussion) =>
      [
        discussion.title,
        discussion.topic,
        discussion.body,
        discussion.authorName,
        discussion.authorUsername,
        discussion.purpose_lane,
        discussion.reality_lens,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(cleanQuery)
    );
  }, [discussions, query]);

  async function loadDiscussions() {
    setDiscussionLoading(true);
    setMessage("");

    try {
      const { data: discussionRows, error } = await supabase
        .from("discussions")
        .select("id, title, topic, body, created_at, user_id, reality_lens, purpose_lane")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        setMessage("Unable to load V2 discussion preview. V1 remains available.");
        setDiscussions([]);
        return;
      }

      const baseRows = (discussionRows ?? []) as V2Discussion[];
      const authorIds = [
        ...new Set(
          baseRows
            .map((discussion) => discussion.user_id)
            .filter((userId): userId is string => Boolean(userId))
        ),
      ];

      let authorMap: Record<string, { full_name: string | null; username: string | null }> = {};

      if (authorIds.length > 0) {
        const { data: authorRows } = await supabase
          .from("profiles")
          .select("id, full_name, username")
          .in("id", authorIds);

        authorMap = Object.fromEntries(
          ((authorRows ?? []) as Array<{
            id: string;
            full_name: string | null;
            username: string | null;
          }>).map((profile) => [profile.id, profile])
        );
      }

      setDiscussions(
        baseRows.map((discussion) => ({
          ...discussion,
          authorName: authorMap[discussion.user_id]?.full_name ?? null,
          authorUsername: authorMap[discussion.user_id]?.username ?? null,
        }))
      );
    } catch {
      setMessage("Unable to load V2 discussion preview. V1 remains available.");
      setDiscussions([]);
    } finally {
      setDiscussionLoading(false);
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

      if (
        accessToken &&
        nextPayload.configured &&
        nextPayload.flags.v2_shell &&
        nextPayload.version === "v2"
      ) {
        await loadDiscussions();
      }
    } catch {
      setPayload(getDefaultShellPayload());
      setMessage("Unable to verify V2 shell access. Current Loombus remains on V1.");
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
        message="Loombus is verifying whether this account can use the V2 Discussions preview."
        loading
      />
    );
  }

  if (!payload?.authenticated) {
    return (
      <GateCard
        title="Sign in required"
        message="The V2 Discussions preview is internal-only right now. Sign in first so Loombus can check your v2_shell access."
        payload={payload}
      />
    );
  }

  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") {
    return (
      <GateCard
        title="V2 Discussions preview is not enabled"
        message="This account is not currently allowed through the v2_shell flag. Public users remain on the V1 Discussions experience."
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
            <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">Discussions with signal first.</h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
              This is a gated V2 discussion preview. It reads live discussions, keeps detail pages on V1, and does not replace the public `/discussions` route.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <FlagPill label="v2_shell" enabled={payload.flags.v2_shell} />
            <FlagPill label="v2_signal_brief" enabled={payload.flags.v2_signal_brief} />
            <FlagPill label="v2_rooms" enabled={payload.flags.v2_rooms} />
          </div>
        </header>

        <section className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-4">
            <label htmlFor="v2-discussion-search" className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
              Filter preview
            </label>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3">
              <Search className="size-5 text-slate-400" />
              <input
                id="v2-discussion-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search titles, topics, authors, or body text"
                className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
              />
            </div>
          </div>

          <aside className="rounded-[1.75rem] border border-emerald-400/25 bg-emerald-400/10 p-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className="size-5 text-emerald-200" />
              <h2 className="font-bold text-emerald-100">Safe preview</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-emerald-50/80">
              This page is reachable only by allowlisted V2 users. Every card opens the current V1 discussion detail page.
            </p>
          </aside>
        </section>

        {message && (
          <div className="mb-5 rounded-2xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
            {message}
          </div>
        )}

        <section className="space-y-4 pb-12">
          {discussionLoading && (
            <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-300">
              Loading V2 discussion preview...
            </div>
          )}

          {!discussionLoading && filteredDiscussions.length === 0 && (
            <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-300">
              No discussions match this preview filter.
            </div>
          )}

          {!discussionLoading && filteredDiscussions.map((discussion) => (
            <DiscussionCard key={discussion.id} discussion={discussion} />
          ))}
        </section>
      </div>
    </main>
  );
}
