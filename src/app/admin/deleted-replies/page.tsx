"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Reply = {
  id: string;
  body: string;
  user_id: string;
  discussion_id: string;
  created_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
};

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
};

type Discussion = {
  id: string;
  title: string;
  topic: string;
};

export default function DeletedRepliesPage() {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [discussions, setDiscussions] = useState<Record<string, Discussion>>({});
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadDeletedReplies() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        window.location.href = "/login";
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", userData.user.id)
        .single();

      if (!profile?.is_admin) {
        setAuthorized(false);
        setLoading(false);
        return;
      }

      setAuthorized(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch("/api/admin/deleted-replies", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(`Unable to load deleted replies: ${result.error ?? "Unknown error."}`);
        setLoading(false);
        return;
      }

      setReplies((result.replies ?? []) as Reply[]);

      const profileMap: Record<string, Profile> = {};

      for (const item of (result.profiles ?? []) as Profile[]) {
        profileMap[item.id] = item;
      }

      setProfiles(profileMap);

      const discussionMap: Record<string, Discussion> = {};

      for (const item of (result.discussions ?? []) as Discussion[]) {
        discussionMap[item.id] = item;
      }

      setDiscussions(discussionMap);

      setLoading(false);
    }

    loadDeletedReplies();
  }, []);

  async function restoreReply(replyId: string) {
    setMessage("");
    setRestoringId(replyId);

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      window.location.href = "/login";
      return;
    }

    const response = await fetch("/api/admin/moderation/actions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        action: "restore_reply",
        replyId,
      }),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(result.error ?? "Unable to restore reply.");
      setRestoringId(null);
      return;
    }

    setReplies((current) => current.filter((reply) => reply.id !== replyId));
    setMessage("Reply restored.");
    setRestoringId(null);
  }

  function getAuthorLabel(reply: Reply) {
    const profile = profiles[reply.user_id];

    return profile?.full_name || profile?.username || "Loombus member";
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-6xl text-zinc-400">
          Loading deleted replies...
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-6xl">
          <h1 className="mb-4 text-5xl font-semibold tracking-tight">
            Access denied.
          </h1>

          <p className="text-zinc-400">
            Admin access required.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex items-center justify-between">
          <div>
            <p className="mb-3 text-sm uppercase tracking-[0.3em] text-zinc-500">
              Administration
            </p>

            <h1 className="text-5xl font-semibold tracking-tight">
              Deleted Replies
            </h1>
          </div>

          <Link
            href="/admin"
            className="rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
          >
            Back to Admin
          </Link>
        </div>

        <section className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="mb-2 text-sm uppercase tracking-[0.25em] text-zinc-500">
            Reply restore review
          </p>

          <h2 className="mb-4 text-2xl font-medium">
            Restore replies only when the moderation reversal is clear.
          </h2>

          <p className="mb-5 max-w-3xl text-sm leading-relaxed text-zinc-500">
            Restoring a deleted reply makes it visible again inside its discussion.
            Review the reply body, author, parent discussion, deletion time, and
            surrounding context before reversing the action.
          </p>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-zinc-900 bg-black p-4">
              <p className="mb-2 text-sm font-medium text-zinc-300">
                Check the thread
              </p>

              <p className="text-sm leading-relaxed text-zinc-600">
                Open the parent discussion to understand the reply in context.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-900 bg-black p-4">
              <p className="mb-2 text-sm font-medium text-zinc-300">
                Review the author
              </p>

              <p className="text-sm leading-relaxed text-zinc-600">
                Look for patterns when the same account appears in multiple moderation events.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-900 bg-black p-4">
              <p className="mb-2 text-sm font-medium text-zinc-300">
                Restore carefully
              </p>

              <p className="text-sm leading-relaxed text-zinc-600">
                Restore only when the reply should return to the public conversation.
              </p>
            </div>
          </div>
        </section>

        {message && (
          <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
            {message}
          </div>
        )}

        <div className="space-y-6">
          {replies.map((reply) => {
            const discussion = discussions[reply.discussion_id];

            return (
              <div
                key={reply.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6"
              >
                <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="mb-2 text-xs uppercase tracking-[0.25em] text-zinc-500">
                      {discussion?.topic ?? "Discussion"}
                    </p>

                    <h2 className="text-2xl font-semibold">
                      {discussion?.title ?? "Discussion unavailable"}
                    </h2>

                    <p className="mt-2 text-sm text-zinc-500">
                      Author: {getAuthorLabel(reply)}
                    </p>
                  </div>

                  <button
                    onClick={() => restoreReply(reply.id)}
                    disabled={restoringId === reply.id}
                    className="rounded-full border border-emerald-800 px-4 py-2 text-sm text-emerald-400 transition hover:border-emerald-600 hover:text-emerald-300 disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                  >
                    {restoringId === reply.id ? "Restoring..." : "Restore"}
                  </button>
                </div>

                <p className="mb-4 whitespace-pre-wrap leading-relaxed text-zinc-400">
                  {reply.body}
                </p>

                <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
                  <span>
                    Deleted:{" "}
                    {reply.deleted_at
                      ? new Date(reply.deleted_at).toLocaleString()
                      : "Unknown"}
                  </span>

                  <span>
                    Reply ID: {reply.id}
                  </span>

                  {discussion && (
                    <Link
                      href={`/discussions/${discussion.id}`}
                      className="text-zinc-400 transition hover:text-white"
                    >
                      View discussion →
                    </Link>
                  )}
                </div>
              </div>
            );
          })}

          {!replies.length && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8">
              <h2 className="mb-3 text-2xl font-medium">
                No deleted replies.
              </h2>

              <p className="max-w-2xl text-zinc-500">
                Soft-deleted replies will appear here when a member or admin
                removes them from public discussion. Restored replies leave this queue.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
