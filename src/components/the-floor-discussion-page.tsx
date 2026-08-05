"use client";

import { LoombusLoadingScreen } from "@/components/loombus-loading-screen";
import { FloorPostCard, type FloorPostCardData } from "@/components/the-floor-post-card";
import TheFloorPulse, { type PulseEvent } from "@/components/the-floor-pulse";
import {
  FLOOR_POST_BODY_MAX,
  FLOOR_POST_TITLE_MAX,
  floorDisplayName,
} from "@/lib/floor-shared";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";
import { ArrowLeft, Loader2, MessagesSquare, Plus, Send, X } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";

type FloorAuthorEmbed = { username: string | null; full_name: string | null } | null;

type FloorPostReplyRow = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  author: FloorAuthorEmbed | FloorAuthorEmbed[] | null;
};

type FloorPostRow = {
  id: string;
  author_id: string;
  title: string | null;
  body: string;
  reply_count: number;
  last_activity_at: string;
  created_at: string;
  author: FloorAuthorEmbed | FloorAuthorEmbed[] | null;
  floor_post_replies: FloorPostReplyRow[] | null;
};

function authorName(author: FloorAuthorEmbed | FloorAuthorEmbed[] | null) {
  const profile = Array.isArray(author) ? author[0] ?? null : author;
  return floorDisplayName(profile?.full_name, profile?.username);
}

function toPostCardData(row: FloorPostRow): FloorPostCardData {
  return {
    id: row.id,
    author_name: authorName(row.author),
    title: row.title,
    body: row.body,
    reply_count: row.reply_count,
    last_activity_at: row.last_activity_at,
    created_at: row.created_at,
    replies: (row.floor_post_replies ?? []).map((reply) => ({
      id: reply.id,
      author_name: authorName(reply.author),
      body: reply.body,
      created_at: reply.created_at,
    })),
  };
}

const inputClass =
  "min-h-12 w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 text-sm text-[var(--loombus-text)] outline-none placeholder:text-[var(--loombus-text-subtle)] focus:border-amber-400 focus:ring-4 focus:ring-amber-100/20";
const textareaClass =
  "w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3 text-sm leading-6 text-[var(--loombus-text)] outline-none placeholder:text-[var(--loombus-text-subtle)] focus:border-amber-400 focus:ring-4 focus:ring-amber-100/20";
const labelClass = "mb-2 block text-sm font-black text-[var(--loombus-text)]";

export default function TheFloorDiscussionPage() {
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<FloorPostRow[]>([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pulseEventId, setPulseEventId] = useState<string | null>(null);
  const [pulseContext, setPulseContext] = useState("");

  const reloadTimer = useRef<number | null>(null);

  const loadPosts = useCallback(async () => {
    const { data, error } = await supabase
      .from("floor_posts")
      .select(
        "id, author_id, title, body, reply_count, last_activity_at, created_at, author:profiles!floor_posts_author_id_fkey(username, full_name), floor_post_replies(id, author_id, body, created_at, author:profiles!floor_post_replies_author_id_fkey(username, full_name))"
      )
      .order("last_activity_at", { ascending: false })
      .order("created_at", { ascending: true, foreignTable: "floor_post_replies" })
      .limit(50);
    if (!error && data) {
      setPosts(data as unknown as FloorPostRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let mounted = true;
    async function guardAndLoad() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        window.location.replace("/login?next=%2Fthe-floor%2Fdiscussion");
        return;
      }
      if (mounted) await loadPosts();
    }
    void guardAndLoad();
    return () => {
      mounted = false;
    };
  }, [loadPosts]);

  useEffect(() => {
    const scheduleReload = () => {
      if (reloadTimer.current !== null) window.clearTimeout(reloadTimer.current);
      reloadTimer.current = window.setTimeout(() => {
        reloadTimer.current = null;
        void loadPosts();
      }, 180);
    };
    const channel = supabase
      .channel("the-floor:discussion")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "floor_posts" },
        scheduleReload
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "floor_post_replies" },
        scheduleReload
      )
      .subscribe();
    const fallback = window.setInterval(() => void loadPosts(), 30_000);
    return () => {
      if (reloadTimer.current !== null) window.clearTimeout(reloadTimer.current);
      window.clearInterval(fallback);
      void supabase.removeChannel(channel);
    };
  }, [loadPosts]);

  async function submitPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !body.trim()) return;
    setSubmitting(true);
    setMessage("");
    setMessageIsError(false);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sign in again before continuing.");
      const response = await fetch("/api/floor/posts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title, body, pulse_event_id: pulseEventId }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        discussion_id?: string | null;
      };
      if (response.status === 409 && result.discussion_id) {
        window.location.assign(`/the-floor/discussion#post-${result.discussion_id}`);
        return;
      }
      if (!response.ok) throw new Error(result.error ?? "Unable to post your discussion.");
      setTitle("");
      setBody("");
      setPulseEventId(null);
      setPulseContext("");
      setComposerOpen(false);
      setMessage("Your discussion is live on The Floor.");
      await loadPosts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to post your discussion.");
      setMessageIsError(true);
    } finally {
      setSubmitting(false);
    }
  }

  function discussPulseEvent(event: PulseEvent) {
    setPulseEventId(event.id);
    setPulseContext(event.title);
    setTitle(event.title.replace(/^(New research|New thesis|Live now|Replay available|Upcoming on The Floor):\s*/i, ""));
    setBody("");
    setComposerOpen(true);
    window.setTimeout(() => {
      document.getElementById("floor-discussion-composer")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  if (loading) {
    return (
      <LoombusLoadingScreen
        title="Loading the discussion..."
        message="Gathering what members are saying on The Floor."
      />
    );
  }

  return (
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-5">
        <header className="rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-xl shadow-black/10">
          <Link
            href="/the-floor/overview"
            className="inline-flex items-center gap-1.5 text-xs font-black text-[var(--loombus-text-muted)] hover:text-[var(--loombus-text)]"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Open Floor overview
          </Link>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <MessagesSquare className="size-7 text-[var(--loombus-gold)]" aria-hidden="true" />
              <div>
                <h1 className="text-2xl font-black sm:text-3xl">Discussion</h1>
                <p className="mt-1 max-w-xl text-sm leading-6 text-[var(--loombus-text-muted)]">
                  Where members talk through reasoning &mdash; not just post theses.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setComposerOpen((open) => !open)}
              aria-expanded={composerOpen}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#cbab5b] px-5 text-sm font-black text-[#17120a]"
            >
              {composerOpen ? <X className="size-4" /> : <Plus className="size-4" />}
              {composerOpen ? "Close composer" : "Start a discussion"}
            </button>
          </div>
        </header>

        {message ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm font-bold ${
              messageIsError
                ? "border-rose-500/30 bg-rose-500/10 text-rose-400"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
            }`}
          >
            {message}
          </div>
        ) : null}

        <TheFloorPulse onDiscuss={discussPulseEvent} />

        {composerOpen ? (
          <form
            id="floor-discussion-composer"
            onSubmit={submitPost}
            className="scroll-mt-24 space-y-4 rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 shadow-sm sm:p-5"
          >
            {pulseContext ? (
              <div className="flex items-start justify-between gap-3 rounded-2xl bg-[var(--loombus-gold-surface)] px-4 py-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.12em] text-[var(--loombus-gold)]">Discussing a Floor update</p>
                  <p className="mt-1 text-xs font-bold text-[var(--loombus-text-muted)]">{pulseContext}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPulseEventId(null);
                    setPulseContext("");
                  }}
                  aria-label="Remove Floor update from discussion"
                  className="grid size-7 shrink-0 place-items-center rounded-full border border-[var(--loombus-border)]"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : null}
            <label className="block">
              <span className={labelClass}>Title (optional)</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value.slice(0, FLOOR_POST_TITLE_MAX))}
                maxLength={FLOOR_POST_TITLE_MAX}
                placeholder="What's this about?"
                className={inputClass}
              />
            </label>

            <label className="block">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-sm font-black text-[var(--loombus-text)]">Body</span>
                <span className="text-xs font-bold text-[var(--loombus-text-subtle)]">
                  {body.length}/{FLOOR_POST_BODY_MAX}
                </span>
              </div>
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value.slice(0, FLOOR_POST_BODY_MAX))}
                rows={5}
                required
                maxLength={FLOOR_POST_BODY_MAX}
                placeholder={pulseContext ? "What stands out to you about this update?" : "Start the conversation..."}
                className={textareaClass}
              />
            </label>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting || !body.trim()}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#cbab5b] px-5 text-sm font-black text-[#17120a] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="size-4" aria-hidden="true" />
                )}
                Post
              </button>
            </div>
          </form>
        ) : null}

        {posts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-[1.75rem] border border-dashed border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-10 text-center">
            <MessagesSquare className="size-8 text-[var(--loombus-text-subtle)]" aria-hidden="true" />
            <p className="text-sm font-bold text-[var(--loombus-text-muted)]">
              No discussions yet. Be the first to say something.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {posts.map((row) => (
              <FloorPostCard key={row.id} post={toPostCardData(row)} onReplyPosted={loadPosts} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
