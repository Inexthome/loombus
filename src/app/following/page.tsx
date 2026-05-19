"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Discussion = {
  id: string;
  user_id: string;
  title: string;
  topic: string;
  body: string;
  created_at: string;
};

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
};

function getProfileInitials(profile: Profile | undefined) {
  const label = profile?.full_name?.trim() || profile?.username?.trim() || "L";

  const parts = label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return parts
    .map((part) => part[0]?.toUpperCase())
    .join("") || "L";
}

function getProfileDisplayName(profile: Profile | undefined) {
  return profile?.username ? `@${profile.username}` : "Loombus member";
}

export default function FollowingPage() {
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [replyCounts, setReplyCounts] = useState<Record<string, number>>({});
  const [selectedTopic, setSelectedTopic] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFollowingFeed() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        window.location.href = "/login";
        return;
      }

      const { data: follows } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", userData.user.id);

      const followingIds =
        follows?.map((item) => item.following_id) ?? [];

      if (followingIds.length === 0) {
        setLoading(false);
        return;
      }

      const { data: discussionData } = await supabase
        .from("discussions")
        .select("*")
        .is("deleted_at", null)
        .in("user_id", followingIds)
        .order("created_at", { ascending: false });

      const discussions = discussionData ?? [];

      setDiscussions(discussions);

      const uniqueUserIds = [
        ...new Set(discussions.map((d) => d.user_id)),
      ];

      const profileMap: Record<string, Profile> = {};

      if (uniqueUserIds.length > 0) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .in("id", uniqueUserIds);

        for (const profile of profileData ?? []) {
          profileMap[profile.id] = profile;
        }
      }

      const discussionIds = discussions.map((d) => d.id);

      if (discussionIds.length > 0) {
        const { data: replyData } = await supabase
          .from("replies")
          .select("discussion_id")
          .in("discussion_id", discussionIds);

        const counts: Record<string, number> = {};

        for (const reply of replyData ?? []) {
          counts[reply.discussion_id] =
            (counts[reply.discussion_id] ?? 0) + 1;
        }

        setReplyCounts(counts);
      }

      setProfiles(profileMap);
      setLoading(false);
    }

    loadFollowingFeed();
  }, []);

  const topics = useMemo(() => {
    const uniqueTopics = [...new Set(discussions.map((discussion) => discussion.topic))];
    return ["All", ...uniqueTopics];
  }, [discussions]);

  const filteredDiscussions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return discussions.filter((discussion) => {
      const profile = profiles[discussion.user_id];

      const matchesTopic =
        selectedTopic === "All" || discussion.topic === selectedTopic;

      const matchesSearch =
        !query ||
        discussion.title.toLowerCase().includes(query) ||
        discussion.body.toLowerCase().includes(query) ||
        discussion.topic.toLowerCase().includes(query) ||
        (profile?.username ?? "").toLowerCase().includes(query) ||
        (profile?.full_name ?? "").toLowerCase().includes(query);

      return matchesTopic && matchesSearch;
    });
  }, [discussions, profiles, selectedTopic, searchQuery]);

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-5xl">

        <div className="mb-12">
          <h1 className="text-5xl font-semibold tracking-tight">
            Following
          </h1>

          <p className="mt-3 text-zinc-500">
            Discussions from people you follow.
          </p>
        </div>

        <div className="mb-8">
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search followed discussions, topics, or contributors..."
            className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-5 py-4 text-white outline-none transition placeholder:text-zinc-600 focus:border-zinc-600"
          />
        </div>

        <div className="mb-6 flex flex-wrap gap-3">
          {topics.map((topic) => (
            <button
              key={topic}
              onClick={() => setSelectedTopic(topic)}
              className={`rounded-full px-4 py-2 text-sm transition ${
                selectedTopic === topic
                  ? "bg-white text-black"
                  : "border border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-white"
              }`}
            >
              {topic}
            </button>
          ))}
        </div>

        {!loading && (
          <p className="mb-10 text-sm text-zinc-600">
            Showing {filteredDiscussions.length} of {discussions.length} followed discussions
          </p>
        )}

        {loading && (
          <p className="text-zinc-500">
            Loading following feed...
          </p>
        )}

        {!loading && discussions.length === 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <h2 className="mb-3 text-2xl font-medium">
              No followed discussions yet.
            </h2>

            <p className="text-zinc-400">
              Follow contributors to build a more personalized signal feed.
            </p>
          </div>
        )}

        {!loading && discussions.length > 0 && filteredDiscussions.length === 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <h2 className="mb-3 text-2xl font-medium">
              No followed discussions found.
            </h2>

            <p className="text-zinc-400">
              No followed discussions match the current search or topic filter.
            </p>
          </div>
        )}

        <div className="space-y-6">
          {filteredDiscussions.map((discussion) => {
            const profile = profiles[discussion.user_id];

            return (
              <div
                key={discussion.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 transition hover:border-zinc-700"
              >
                <Link
                  href={`/discussions/${discussion.id}`}
                  className="block"
                >
                  <p className="mb-3 text-sm text-zinc-500">
                    {discussion.topic}
                  </p>

                  <h2 className="mb-3 text-2xl font-medium">
                    {discussion.title}
                  </h2>

                  <p className="mb-4 line-clamp-2 leading-relaxed text-zinc-400">
                    {discussion.body}
                  </p>
                </Link>

                <div className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-black text-sm font-medium text-zinc-300">
                      {getProfileInitials(profile)}
                    </div>

                    <p className="min-w-0 text-sm text-zinc-600">
                      by{" "}
                      {profile?.username ? (
                        <Link
                          href={`/u/${profile.username}`}
                          className="text-zinc-400 transition hover:text-white"
                        >
                          {getProfileDisplayName(profile)}
                        </Link>
                      ) : (
                        "Loombus member"
                      )}{" "}
                      · {new Date(discussion.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <p className="shrink-0 text-sm text-zinc-500">
                    {replyCounts[discussion.id] ?? 0} replies
                  </p>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </main>
  );
}
