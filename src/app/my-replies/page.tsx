"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { ProfileAvatar, getProfileDisplayName } from "@/components/profile-avatar";

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

type Profile = {
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export default function MyRepliesPage() {
  const [replies, setReplies] = useState<Reply[]>([]);
  const [discussions, setDiscussions] = useState<Record<string, Discussion>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMyReplies() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        window.location.href = "/login";
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, username, avatar_url")
        .eq("id", userData.user.id)
        .maybeSingle();

      setCurrentProfile(profileData ?? null);

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

  const filteredReplies = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return replies;
    }

    return replies.filter((reply) => {
      const discussion = discussions[reply.discussion_id];

      return (
        reply.body.toLowerCase().includes(query) ||
        (discussion?.title ?? "").toLowerCase().includes(query) ||
        (discussion?.topic ?? "").toLowerCase().includes(query)
      );
    });
  }, [replies, discussions, searchQuery]);

  const activeMyRepliesSearch = searchQuery.trim();
  const hasActiveMyRepliesSearch = activeMyRepliesSearch.length > 0;

  function resetMyRepliesSearch() {
    setSearchQuery("");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-6xl text-zinc-400">
          Loading your replies...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/dashboard"
          className="mb-10 inline-block text-sm text-zinc-500 hover:text-white"
        >
          ← Back to dashboard
        </Link>

        <div className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-4 text-sm uppercase tracking-[0.3em] text-zinc-500">
              My Activity
            </p>

            <h1 className="text-5xl font-semibold tracking-tight md:text-6xl">
              My Replies
            </h1>

            <p className="mt-4 text-zinc-500">
              Review the replies you have contributed across Loombus.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <ProfileAvatar profile={currentProfile} size="xl" />

            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-600">
                Contributor
              </p>

              <p className="mt-1 text-sm text-zinc-300">
                {getProfileDisplayName(currentProfile)}
              </p>
            </div>
          </div>
        </div>

        <section className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex-1">
              <label htmlFor="my-replies-search" className="mb-2 block text-sm font-medium text-zinc-300">
                Search your replies
              </label>

              <input
                id="my-replies-search"
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search reply text, discussion titles, or topics..."
                className="w-full rounded-2xl border border-zinc-800 bg-black px-5 py-4 text-white outline-none transition placeholder:text-zinc-600 focus:border-zinc-600"
              />
            </div>

            {hasActiveMyRepliesSearch && (
              <button
                type="button"
                onClick={resetMyRepliesSearch}
                className="w-fit rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Clear search
              </button>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {hasActiveMyRepliesSearch ? (
              <span className="rounded-full border border-zinc-800 bg-black px-3 py-1.5 text-xs font-medium text-zinc-400">
                Search: “{activeMyRepliesSearch}”
              </span>
            ) : (
              <p className="text-sm text-zinc-600">
                Search scans your reply text plus the original discussion titles and topics.
              </p>
            )}
          </div>
        </section>

        <div className="mb-10 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-zinc-600">
            Showing {filteredReplies.length} of {replies.length} replies
          </p>

          {hasActiveMyRepliesSearch && (
            <button
              type="button"
              onClick={resetMyRepliesSearch}
              className="w-fit text-sm text-zinc-500 underline decoration-zinc-800 underline-offset-4 transition hover:text-white hover:decoration-white"
            >
              Reset view
            </button>
          )}
        </div>

        {replies.length === 0 && (
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
            <h2 className="mb-3 text-2xl font-medium">
              You have not replied to any discussions yet.
            </h2>

            <p className="mb-6 max-w-3xl text-zinc-400">
              Replies are where your perspective becomes part of the conversation.
              Start with one useful contribution: context, an example, experience,
              a counterpoint, or a sharper question.
            </p>

            <div className="mb-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-zinc-900 bg-black p-4">
                <p className="mb-2 text-sm font-medium text-zinc-300">
                  Add context
                </p>

                <p className="text-sm leading-relaxed text-zinc-600">
                  Explain what the discussion is missing or what background would help.
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-900 bg-black p-4">
                <p className="mb-2 text-sm font-medium text-zinc-300">
                  Share experience
                </p>

                <p className="text-sm leading-relaxed text-zinc-600">
                  Add a real example, lesson, or observation that other readers can use.
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-900 bg-black p-4">
                <p className="mb-2 text-sm font-medium text-zinc-300">
                  Improve the framing
                </p>

                <p className="text-sm leading-relaxed text-zinc-600">
                  Ask a better question, offer a counterpoint, or clarify the tradeoff.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/discussions"
                className="inline-flex rounded-full bg-white px-5 py-3 text-sm text-black transition hover:bg-zinc-200"
              >
                Find a discussion to reply to
              </Link>

              <Link
                href="/following"
                className="inline-flex rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Check following feed
              </Link>

              <Link
                href="/people"
                className="inline-flex rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Find people
              </Link>

              <Link
                href="/onboarding"
                className="inline-flex rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Open setup guide
              </Link>
            </div>
          </div>
        )}

        {replies.length > 0 && filteredReplies.length === 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8">
            <h2 className="mb-3 text-2xl font-medium">
              No replies found.
            </h2>

            <p className="mb-6 max-w-2xl text-zinc-400">
              No replies match your current search. Try a broader word, topic,
              or discussion title, or browse discussions to find where to contribute next.
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={resetMyRepliesSearch}
                className="inline-flex rounded-full bg-white px-5 py-3 text-sm text-black transition hover:bg-zinc-200"
              >
                Clear search
              </button>

              <Link
                href="/discussions"
                className="inline-flex rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Browse discussions
              </Link>
            </div>
          </div>
        )}

        <div className="space-y-5">
          {filteredReplies.map((reply) => {
            const discussion = discussions[reply.discussion_id];
            const discussionAvailable = discussion && !discussion.deleted_at;

            return (
              <div
                key={reply.id}
                className="rounded-3xl border border-zinc-800 bg-zinc-950 p-7 shadow-2xl shadow-black/30"
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
