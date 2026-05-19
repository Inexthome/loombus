"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Reply = {
  id: string;
  body: string;
  discussion_id: string;
  created_at: string;
};

type Discussion = {
  id: string;
  title: string;
  topic: string;
  deleted_at: string | null;
};

export default function MyRepliesPage() {
  const [replies, setReplies] = useState<Reply[]>([]);
  const [discussions, setDiscussions] = useState<Record<string, Discussion>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMyReplies() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        window.location.href = "/login";
        return;
      }

      const { data } = await supabase
        .from("replies")
        .select("id, body, discussion_id, created_at")
        .eq("user_id", userData.user.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      const loadedReplies = (data ?? []) as Reply[];
      setReplies(loadedReplies);

      const discussionIds = [
        ...new Set(loadedReplies.map((reply) => reply.discussion_id)),
      ];

      if (discussionIds.length > 0) {
        const { data: discussionData } = await supabase
          .from("discussions")
          .select("id, title, topic, deleted_at")
          .in("id", discussionIds);

        const discussionMap: Record<string, Discussion> = {};

        for (const discussion of discussionData ?? []) {
          discussionMap[discussion.id] = discussion;
        }

        setDiscussions(discussionMap);
      }

      setLoading(false);
    }

    loadMyReplies();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-5xl text-zinc-400">
          Loading your replies...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/dashboard"
          className="mb-10 inline-block text-sm text-zinc-500 hover:text-white"
        >
          ← Back to dashboard
        </Link>

        <div className="mb-12">
          <p className="mb-4 text-sm uppercase tracking-[0.3em] text-zinc-500">
            My Activity
          </p>

          <h1 className="text-5xl font-semibold tracking-tight">
            My Replies
          </h1>

          <p className="mt-4 text-zinc-500">
            Review the replies you have contributed across Loombus.
          </p>
        </div>

        {replies.length === 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8">
            <h2 className="mb-3 text-2xl font-medium">
              You have not replied to any discussions yet.
            </h2>

            <p className="mb-6 text-zinc-400">
              Join a discussion and contribute with clarity, context, and signal.
            </p>

            <Link
              href="/discussions"
              className="inline-flex rounded-full bg-white px-5 py-3 text-sm text-black transition hover:bg-zinc-200"
            >
              Explore Discussions
            </Link>
          </div>
        )}

        <div className="space-y-6">
          {replies.map((reply) => {
            const discussion = discussions[reply.discussion_id];
            const discussionAvailable = discussion && !discussion.deleted_at;

            return (
              <div
                key={reply.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6"
              >
                <div className="mb-4">
                  <p className="mb-2 text-sm text-zinc-500">
                    {discussion?.topic ?? "Discussion"}
                  </p>

                  <h2 className="text-2xl font-medium">
                    {discussion?.title ?? "Discussion unavailable"}
                  </h2>
                </div>

                <p className="mb-5 whitespace-pre-wrap leading-relaxed text-zinc-400">
                  {reply.body}
                </p>

                <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-zinc-500">
                  <span>
                    {new Date(reply.created_at).toLocaleDateString()}
                  </span>

                  {discussionAvailable ? (
                    <Link
                      href={`/discussions/${reply.discussion_id}`}
                      className="text-zinc-300 transition hover:text-white"
                    >
                      Open discussion →
                    </Link>
                  ) : (
                    <span>
                      Discussion unavailable
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
