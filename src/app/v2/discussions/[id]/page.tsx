"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Clock3,
  FileText,
  Loader2,
  Lock,
  MessageCircle,
  Reply,
  ShieldCheck,
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

type V2DiscussionDetail = {
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

type V2ReplyPreview = {
  id: string;
  body: string | null;
  created_at: string;
  user_id: string;
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

function getAgeLabel(value: string) {
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

function getAuthorLabel(item: { authorName?: string | null; authorUsername?: string | null }) {
  return item.authorName?.trim() || item.authorUsername?.trim() || "Loombus member";
}

function formatBody(body: string | null) {
  return body?.trim() || "No body text is available for this preview.";
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
            href="/v2/discussions"
            className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-slate-200"
          >
            Back to V2 Discussions
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

function ReplyPreviewCard({ reply }: { reply: V2ReplyPreview }) {
  return (
    <article className="rounded-[1.5rem] border border-white/10 bg-slate-950/45 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
        <span className="inline-flex items-center gap-2">
          <UserCircle className="size-4" />
          {getAuthorLabel(reply)}
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock3 className="size-3.5" />
          {getAgeLabel(reply.created_at)}
        </span>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">{formatBody(reply.body)}</p>
    </article>
  );
}

export default function V2DiscussionDetailPage() {
  const params = useParams<{ id?: string | string[] }>();
  const discussionId = useMemo(() => {
    const rawId = params?.id;
    return Array.isArray(rawId) ? rawId[0] : rawId;
  }, [params]);

  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [discussion, setDiscussion] = useState<V2DiscussionDetail | null>(null);
  const [replies, setReplies] = useState<V2ReplyPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [replyMessage, setReplyMessage] = useState("");

  async function hydrateAuthors<TRow extends { user_id: string; authorName?: string | null; authorUsername?: string | null }>(
    rows: TRow[]
  ) {
    const authorIds = [
      ...new Set(rows.map((row) => row.user_id).filter((userId): userId is string => Boolean(userId))),
    ];

    if (authorIds.length === 0) {
      return rows;
    }

    const { data: authorRows } = await supabase
      .from("profiles")
      .select("id, full_name, username")
      .in("id", authorIds);

    const authorMap = Object.fromEntries(
      ((authorRows ?? []) as Array<{
        id: string;
        full_name: string | null;
        username: string | null;
      }>).map((profile) => [profile.id, profile])
    );

    return rows.map((row) => ({
      ...row,
      authorName: authorMap[row.user_id]?.full_name ?? null,
      authorUsername: authorMap[row.user_id]?.username ?? null,
    }));
  }

  async function loadDetail() {
    if (!discussionId) {
      setMessage("Missing discussion ID. Return to the V2 Discussions preview and select a discussion.");
      return;
    }

    setDetailLoading(true);
    setMessage("");
    setReplyMessage("");

    try {
      const { data: discussionRow, error } = await supabase
        .from("discussions")
        .select("id, title, topic, body, created_at, user_id, reality_lens, purpose_lane")
        .eq("id", discussionId)
        .is("deleted_at", null)
        .maybeSingle();

      if (error || !discussionRow) {
        setDiscussion(null);
        setMessage("Unable to load this V2 discussion preview. The V1 detail page remains available.");
        return;
      }

      const [hydratedDiscussion] = await hydrateAuthors([discussionRow as V2DiscussionDetail]);
      setDiscussion(hydratedDiscussion ?? null);

      const { data: replyRows, error: replyError } = await supabase
        .from("replies")
        .select("id, body, created_at, user_id")
        .eq("discussion_id", discussionId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(5);

      if (replyError) {
        setReplies([]);
        setReplyMessage("Replies could not be loaded in the V2 preview. Use the V1 page for the full discussion.");
        return;
      }

      const hydratedReplies = await hydrateAuthors((replyRows ?? []) as V2ReplyPreview[]);
      setReplies(hydratedReplies as V2ReplyPreview[]);
    } catch {
      setDiscussion(null);
      setReplies([]);
      setMessage("Unable to load this V2 discussion preview. The V1 detail page remains available.");
    } finally {
      setDetailLoading(false);
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
        await loadDetail();
      }
    } catch {
      setPayload(getDefaultShellPayload());
      setMessage("Unable to verify V2 detail preview access. Current Loombus remains on V1.");
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
  }, [discussionId]);

  if (loading) {
    return (
      <GateCard
        title="Checking V2 access"
        message="Loombus is verifying whether this account can use the V2 discussion detail preview."
        loading
      />
    );
  }

  if (!payload?.authenticated) {
    return (
      <GateCard
        title="Sign in required"
        message="The V2 discussion detail preview is internal-only right now. Sign in first so Loombus can check your v2_shell access."
        payload={payload}
      />
    );
  }

  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") {
    return (
      <GateCard
        title="V2 detail preview is not enabled"
        message="This account is not currently allowed through the v2_shell flag. Public users remain on the V1 discussion detail experience."
        payload={payload}
      />
    );
  }

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#07111f] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.26),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(212,175,55,0.18),_transparent_32%)]" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 rounded-[2rem] border border-white/10 bg-white/[0.05] p-5 shadow-2xl shadow-black/30 sm:p-6">
          <Link href="/v2/discussions" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-200 transition hover:text-white">
            <ArrowLeft className="size-4" />
            Back to V2 Discussions
          </Link>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-200">Loombus V2 Detail Preview</p>
              <h1 className="mt-2 max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl">
                {discussion?.title ?? "Discussion preview"}
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
                This is a read-only V2 preview. Use the current V1 page for live replies, moderation, editing, or full interaction.
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
          <div className="mb-5 rounded-2xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
            {message}
          </div>
        )}

        {detailLoading && (
          <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-300">
            Loading V2 detail preview...
          </div>
        )}

        {!detailLoading && discussion && (
          <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <article className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/30 sm:p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <span className="rounded-full border border-blue-300/20 bg-blue-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-blue-100">
                  {discussion.topic || "Discussion"}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                  <Clock3 className="size-3.5" />
                  {getAgeLabel(discussion.created_at)}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
                <span className="inline-flex items-center gap-2">
                  <UserCircle className="size-4" />
                  {getAuthorLabel(discussion)}
                </span>
                <span>
                  {[discussion.purpose_lane, discussion.reality_lens].filter(Boolean).join(" · ") || "Open discussion"}
                </span>
              </div>

              <div className="mt-6 whitespace-pre-wrap text-base leading-8 text-slate-200">
                {formatBody(discussion.body)}
              </div>
            </article>

            <aside className="space-y-4">
              <section className="rounded-[2rem] border border-emerald-400/25 bg-emerald-400/10 p-5">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="size-5 text-emerald-200" />
                  <h2 className="font-bold text-emerald-100">Read-only preview</h2>
                </div>
                <p className="mt-4 text-sm leading-6 text-emerald-50/80">
                  No replies, edits, reports, deletes, or moderation actions happen from this V2 page.
                </p>
                <Link
                  href={`/discussions/${discussion.id}`}
                  className="mt-4 inline-flex rounded-2xl bg-white px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-slate-200"
                >
                  Open V1 detail page
                </Link>
              </section>

              <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
                <div className="flex items-center gap-3">
                  <FileText className="size-5 text-blue-200" />
                  <h2 className="font-bold">Preview metadata</h2>
                </div>
                <div className="mt-4 space-y-2 text-sm text-slate-300">
                  <p>Topic: {discussion.topic || "None"}</p>
                  <p>Mode: {discussion.purpose_lane || "Open"}</p>
                  <p>Lens: {discussion.reality_lens || "None"}</p>
                </div>
              </section>
            </aside>
          </section>
        )}

        {!detailLoading && discussion && (
          <section className="mt-6 rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-xl shadow-black/20 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Reply className="size-5 text-blue-200" />
                <h2 className="text-xl font-bold">Reply preview</h2>
              </div>
              <Link href={`/discussions/${discussion.id}`} className="text-sm font-semibold text-blue-200 transition hover:text-white">
                Reply on V1
              </Link>
            </div>

            {replyMessage && (
              <div className="mt-4 rounded-2xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
                {replyMessage}
              </div>
            )}

            {!replyMessage && replies.length === 0 && (
              <p className="mt-4 rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-slate-400">
                No replies are available in this preview yet.
              </p>
            )}

            <div className="mt-4 space-y-3">
              {replies.map((reply) => (
                <ReplyPreviewCard key={reply.id} reply={reply} />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
