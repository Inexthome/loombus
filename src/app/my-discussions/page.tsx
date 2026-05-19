"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { ProfileAvatar, getProfileDisplayName } from "@/components/profile-avatar";

type Discussion = {
  id: string;
  title: string;
  topic: string;
  body: string;
  created_at: string;
};

type Profile = {
  full_name: string | null;
  username: string | null;
};

export default function MyDiscussionsPage() {
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [replyCounts, setReplyCounts] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMyDiscussions() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        window.location.href = "/login";
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, username")
        .eq("id", userData.user.id)
        .maybeSingle();

      setCurrentProfile(profileData ?? null);

      const { data } = await supabase
        .from("discussions")
        .select("id, title, topic, body, created_at")
        .eq("user_id", userData.user.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      const loadedDiscussions = (data ?? []) as Discussion[];
      setDiscussions(loadedDiscussions);

      const discussionIds = loadedDiscussions.map((discussion) => discussion.id);

      if (discussionIds.length > 0) {
        const { data: replies } = await supabase
          .from("replies")
          .select("discussion_id")
          .in("discussion_id", discussionIds)
          .is("deleted_at", null);

        const counts: Record<string, number> = {};

        for (const reply of replies ?? []) {
          counts[reply.discussion_id] =
            (counts[reply.discussion_id] ?? 0) + 1;
        }

        setReplyCounts(counts);
      }

      setLoading(false);
    }

    loadMyDiscussions();
  }, []);

  const filteredDiscussions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return discussions;
    }

    return discussions.filter((discussion) => {
      return (
        discussion.title.toLowerCase().includes(query) ||
        discussion.topic.toLowerCase().includes(query) ||
        discussion.body.toLowerCase().includes(query)
      );
    });
  }, [discussions, searchQuery]);

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-5xl text-zinc-400">
          Loading your discussions...
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

        <div className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-4 text-sm uppercase tracking-[0.3em] text-zinc-500">
              My Activity
            </p>

            <h1 className="text-5xl font-semibold tracking-tight">
              My Discussions
            </h1>

            <p className="mt-4 text-zinc-500">
              Review the discussions you have started on Loombus.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <ProfileAvatar profile={currentProfile} size="xl" />

            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-600">
                Author
              </p>

              <p className="mt-1 text-sm text-zinc-300">
                {getProfileDisplayName(currentProfile)}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search your discussions by title, topic, or body..."
            className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-5 py-4 text-white outline-none transition placeholder:text-zinc-600 focus:border-zinc-600"
          />
        </div>

        <p className="mb-10 text-sm text-zinc-600">
          Showing {filteredDiscussions.length} of {discussions.length} discussions
        </p>

        {discussions.length === 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8">
            <h2 className="mb-3 text-2xl font-medium">
              You have not started any discussions yet.
            </h2>

            <p className="mb-6 text-zinc-400">
              Start a structured conversation around a meaningful idea.
            </p>

            <Link
              href="/create"
              className="inline-flex rounded-full bg-white px-5 py-3 text-sm text-black transition hover:bg-zinc-200"
            >
              Create Discussion
            </Link>
          </div>
        )}

        {discussions.length > 0 && filteredDiscussions.length === 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8">
            <h2 className="mb-3 text-2xl font-medium">
              No discussions found.
            </h2>

            <p className="text-zinc-400">
              No discussions match your current search.
            </p>
          </div>
        )}

        <div className="space-y-6">
          {filteredDiscussions.map((discussion) => (
            <div
              key={discussion.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 transition hover:border-zinc-700"
            >
              <Link href={`/discussions/${discussion.id}`} className="block">
                <p className="mb-3 text-sm text-zinc-500">
                  {discussion.topic}
                </p>

                <h2 className="mb-3 text-2xl font-medium">
                  {discussion.title}
                </h2>

                <p className="mb-5 line-clamp-3 leading-relaxed text-zinc-400">
                  {discussion.body}
                </p>
              </Link>

              <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-zinc-500">
                <span>
                  {new Date(discussion.created_at).toLocaleDateString()}
                </span>

                <span>
                  {replyCounts[discussion.id] ?? 0} replies
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
