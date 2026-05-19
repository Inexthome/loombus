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

      const { data } = await supabase
        .from("replies")
        .select("id, body, user_id, discussion_id, created_at, deleted_at, deleted_by")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });

      const loadedReplies = (data ?? []) as Reply[];
      setReplies(loadedReplies);

      const userIds = [
        ...new Set(
          loadedReplies
            .map((reply) => reply.user_id)
            .filter((id): id is string => Boolean(id))
        ),
      ];

      if (userIds.length > 0) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, username, full_name")
          .in("id", userIds);

        const profileMap: Record<string, Profile> = {};

        for (const item of profileData ?? []) {
          profileMap[item.id] = item;
        }

        setProfiles(profileMap);
      }

      const discussionIds = [
        ...new Set(
          loadedReplies
            .map((reply) => reply.discussion_id)
            .filter((id): id is string => Boolean(id))
        ),
      ];

      if (discussionIds.length > 0) {
        const { data: discussionData } = await supabase
          .from("discussions")
          .select("id, title, topic")
          .in("id", discussionIds);

        const discussionMap: Record<string, Discussion> = {};

        for (const item of discussionData ?? []) {
          discussionMap[item.id] = item;
        }

        setDiscussions(discussionMap);
      }

      setLoading(false);
    }

    loadDeletedReplies();
  }, []);

  async function restoreReply(replyId: string) {
    setMessage("");
    setRestoringId(replyId);

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      window.location.href = "/login";
      return;
    }

    const { error } = await supabase
      .from("replies")
      .update({
        deleted_at: null,
        deleted_by: null,
      })
      .eq("id", replyId);

    if (error) {
      setMessage(`Unable to restore reply: ${error.message}`);
      setRestoringId(null);
      return;
    }

    await supabase.from("audit_logs").insert({
      actor_id: userData.user.id,
      action: "reply.restored",
      target_type: "reply",
      target_id: replyId,
    });

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
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8 text-zinc-500">
              No deleted replies.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
