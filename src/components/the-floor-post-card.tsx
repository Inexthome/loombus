"use client";

import { FLOOR_REPLY_BODY_MAX } from "@/lib/floor-shared";
import { normalizePublicText } from "@/lib/public-text";
import { supabase } from "@/lib/supabase/client";
import { Loader2, MessageCircle, Send } from "lucide-react";
import { type FormEvent, useState } from "react";

export type FloorReplyCardData = {
  id: string;
  author_name: string;
  body: string;
  created_at: string;
};

export type FloorPostCardData = {
  id: string;
  author_name: string;
  title: string | null;
  body: string;
  reply_count: number;
  last_activity_at: string;
  created_at: string;
  replies: FloorReplyCardData[];
};

const inputClass =
  "w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3 text-sm leading-6 text-[var(--loombus-text)] outline-none placeholder:text-[var(--loombus-text-subtle)] focus:border-amber-400 focus:ring-4 focus:ring-amber-100/20";

export function FloorPostCard({
  post,
  onReplyPosted,
}: {
  post: FloorPostCardData;
  onReplyPosted: () => void | Promise<void>;
}) {
  const [threadOpen, setThreadOpen] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !replyBody.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sign in again before continuing.");
      const response = await fetch(`/api/floor/posts/${post.id}/replies`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body: replyBody }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to post your reply.");
      setReplyBody("");
      await onReplyPosted();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to post your reply.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <article className="rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-xl shadow-black/10 transition hover:border-[color:color-mix(in_srgb,var(--loombus-gold)_45%,var(--loombus-border))]">
      {post.title ? (
        <h3 className="text-base font-black text-[var(--loombus-text)]">
          {normalizePublicText(post.title)}
        </h3>
      ) : null}
      <p className="mt-1 whitespace-pre-line text-sm leading-6 text-[var(--loombus-text)]">
        {normalizePublicText(post.body)}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-bold text-[var(--loombus-text-muted)]">
        <span>{post.author_name}</span>
        <span aria-hidden="true">·</span>
        <span>{new Date(post.created_at).toLocaleDateString()}</span>
        <button
          type="button"
          onClick={() => setThreadOpen((open) => !open)}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-[var(--loombus-border)] px-3 py-1 text-xs font-black text-[var(--loombus-text-muted)] hover:border-amber-300"
        >
          <MessageCircle className="size-3.5" aria-hidden="true" />
          {post.reply_count} {post.reply_count === 1 ? "reply" : "replies"}
        </button>
      </div>

      {threadOpen ? (
        <div className="mt-4 border-t border-[var(--loombus-border-muted)] pt-4">
          {post.replies.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {post.replies.map((reply) => (
                <li key={reply.id} className="rounded-2xl bg-[var(--loombus-page-bg)] p-3">
                  <p className="whitespace-pre-line text-sm leading-6 text-[var(--loombus-text)]">
                    {normalizePublicText(reply.body)}
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-xs font-bold text-[var(--loombus-text-muted)]">
                    <span>{reply.author_name}</span>
                    <span aria-hidden="true">·</span>
                    <span>{new Date(reply.created_at).toLocaleDateString()}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--loombus-text-subtle)]">No replies yet.</p>
          )}

          {error ? (
            <p className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-400">
              {error}
            </p>
          ) : null}

          <form onSubmit={submitReply} className="mt-3 flex flex-col gap-2 sm:flex-row">
            <textarea
              value={replyBody}
              onChange={(event) => setReplyBody(event.target.value.slice(0, FLOOR_REPLY_BODY_MAX))}
              rows={2}
              maxLength={FLOOR_REPLY_BODY_MAX}
              placeholder="Add a reply..."
              className={`${inputClass} sm:flex-1`}
            />
            <button
              type="submit"
              disabled={submitting || !replyBody.trim()}
              className="inline-flex min-h-11 items-center justify-center gap-2 self-end rounded-full bg-[#cbab5b] px-4 text-xs font-black text-[#17120a] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="size-3.5" aria-hidden="true" />
              )}
              Reply
            </button>
          </form>
        </div>
      ) : null}
    </article>
  );
}
